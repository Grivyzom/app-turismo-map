package handlers

import (
	"backend/database"
	"backend/internal/storage"
	"backend/middleware"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	menuMaxBytes     = 5 << 20 // 5 MB: suficiente para una carta, liviano en datos móviles
	menuContentType  = "application/pdf"
	menuUploadExpiry = 10 * time.Minute
)

// BranchLinksResponse es el detalle liviano que la app pide al abrir un comercio.
// Va en un endpoint aparte para no inflar el payload de pines del mapa.
type BranchLinksResponse struct {
	Success         bool   `json:"success"`
	Whatsapp        string `json:"whatsapp,omitempty"`
	WhatsappMessage string `json:"whatsappMessage,omitempty"`
	WebsiteUrl      string `json:"websiteUrl,omitempty"`
	MenuPdfUrl      string `json:"menuPdfUrl,omitempty"`
	MenuPdfSize     int    `json:"menuPdfSize,omitempty"`
}

// normalizeWhatsapp deja solo dígitos en formato internacional para wa.me.
// Un celular chileno de 9 dígitos (9XXXXXXXX) recibe el prefijo 56.
func normalizeWhatsapp(raw string) (string, bool) {
	var b strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	if digits == "" {
		return "", true
	}
	if len(digits) == 9 && digits[0] == '9' {
		digits = "56" + digits
	}
	if len(digits) < 10 || len(digits) > 15 {
		return "", false
	}
	return digits, true
}

// normalizeWebsite acepta "midominio.cl" o una URL http(s) completa.
func normalizeWebsite(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", true
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || !strings.Contains(u.Host, ".") {
		return "", false
	}
	return u.String(), true
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": msg})
}

// branchForUser resuelve la sucursal principal de la empresa del usuario autenticado.
// Responde el error al cliente y devuelve ok=false si no existe.
func branchForUser(w http.ResponseWriter, r *http.Request) (int, bool) {
	claims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "No autorizado")
		return 0, false
	}
	idFloat, ok := claims["id"].(float64)
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "ID de usuario inválido en token")
		return 0, false
	}
	if database.DB == nil {
		writeJSONError(w, http.StatusInternalServerError, "Base de datos no disponible")
		return 0, false
	}

	var branchID int
	err := database.DB.QueryRow(`
		SELECT b.id
		FROM company_members m
		JOIN company_branches b ON b.company_id = m.company_id
		WHERE m.user_id = $1
		ORDER BY b.id ASC
		LIMIT 1`, int(idFloat)).Scan(&branchID)
	if err == sql.ErrNoRows {
		writeJSONError(w, http.StatusConflict, "Primero guarda la ubicación de tu negocio")
		return 0, false
	} else if err != nil {
		log.Printf("Error buscando sucursal del usuario %d: %v\n", int(idFloat), err)
		writeJSONError(w, http.StatusInternalServerError, "Error de base de datos")
		return 0, false
	}
	return branchID, true
}

func storageOrUnavailable(w http.ResponseWriter) *storage.Client {
	c := storage.Default()
	if c == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "La subida de archivos no está habilitada en el servidor")
	}
	return c
}

func menuKeyPrefix(branchID int) string {
	return fmt.Sprintf("menus/%d/", branchID)
}

// MenuUploadURLHandler firma una subida directa del PDF al bucket.
// El backend no recibe los bytes: solo valida y firma.
func MenuUploadURLHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ContentType string `json:"contentType"`
		Size        int64  `json:"size"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "Payload inválido")
		return
	}
	if req.ContentType != menuContentType {
		writeJSONError(w, http.StatusBadRequest, "La carta debe ser un archivo PDF")
		return
	}
	if req.Size <= 0 || req.Size > menuMaxBytes {
		writeJSONError(w, http.StatusBadRequest, "La carta debe pesar como máximo 5 MB")
		return
	}

	branchID, ok := branchForUser(w, r)
	if !ok {
		return
	}
	store := storageOrUnavailable(w)
	if store == nil {
		return
	}

	rnd := make([]byte, 12)
	if _, err := rand.Read(rnd); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "No se pudo generar la subida")
		return
	}
	key := menuKeyPrefix(branchID) + hex.EncodeToString(rnd) + ".pdf"

	uploadURL, headers, err := store.PresignPut(r.Context(), key, menuContentType, menuUploadExpiry)
	if err != nil {
		log.Printf("Error firmando subida de carta para sucursal %d: %v\n", branchID, err)
		writeJSONError(w, http.StatusInternalServerError, "No se pudo generar la subida")
		return
	}

	flat := map[string]string{}
	for k := range headers {
		flat[k] = headers.Get(k)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"uploadUrl": uploadURL,
		"headers":   flat,
		"key":       key,
	})
}

// MenuConfirmHandler verifica el objeto subido y lo asocia a la sucursal,
// borrando la carta anterior.
func MenuConfirmHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Key string `json:"key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "Payload inválido")
		return
	}

	branchID, ok := branchForUser(w, r)
	if !ok {
		return
	}
	store := storageOrUnavailable(w)
	if store == nil {
		return
	}

	// La key debe ser de esta sucursal: evita que alguien confirme archivos ajenos.
	if !strings.HasPrefix(req.Key, menuKeyPrefix(branchID)) || !strings.HasSuffix(req.Key, ".pdf") || strings.Contains(req.Key, "..") {
		writeJSONError(w, http.StatusBadRequest, "Archivo inválido")
		return
	}

	info, err := store.Stat(r.Context(), req.Key)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "No se encontró el archivo subido")
		return
	}
	// La URL firmada no limita el tamaño: se valida acá y se descarta si excede.
	if info.Size > menuMaxBytes || info.ContentType != menuContentType {
		_ = store.Delete(r.Context(), req.Key)
		writeJSONError(w, http.StatusBadRequest, "La carta debe ser un PDF de máximo 5 MB")
		return
	}

	var previous sql.NullString
	err = database.DB.QueryRow(`
		UPDATE company_branches b
		SET menu_pdf_url = $1, menu_pdf_size = $2, menu_updated_at = NOW()
		FROM (SELECT menu_pdf_url FROM company_branches WHERE id = $3) old
		WHERE b.id = $3
		RETURNING old.menu_pdf_url`,
		store.PublicURL(req.Key), info.Size, branchID).Scan(&previous)
	if err != nil {
		log.Printf("Error guardando carta de sucursal %d: %v\n", branchID, err)
		writeJSONError(w, http.StatusInternalServerError, "Error de base de datos")
		return
	}

	if oldKey := store.KeyFromPublicURL(previous.String); oldKey != "" && oldKey != req.Key {
		if err := store.Delete(r.Context(), oldKey); err != nil {
			log.Printf("Aviso: no se pudo borrar carta anterior %s: %v\n", oldKey, err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"menuPdfUrl":  store.PublicURL(req.Key),
		"menuPdfSize": info.Size,
	})
}

// MenuDeleteHandler quita la carta de la sucursal y borra el archivo.
func MenuDeleteHandler(w http.ResponseWriter, r *http.Request) {
	branchID, ok := branchForUser(w, r)
	if !ok {
		return
	}

	var previous sql.NullString
	err := database.DB.QueryRow(`
		UPDATE company_branches b
		SET menu_pdf_url = NULL, menu_pdf_size = NULL, menu_updated_at = NOW()
		FROM (SELECT menu_pdf_url FROM company_branches WHERE id = $1) old
		WHERE b.id = $1
		RETURNING old.menu_pdf_url`, branchID).Scan(&previous)
	if err != nil {
		log.Printf("Error quitando carta de sucursal %d: %v\n", branchID, err)
		writeJSONError(w, http.StatusInternalServerError, "Error de base de datos")
		return
	}

	if store := storage.Default(); store != nil {
		if oldKey := store.KeyFromPublicURL(previous.String); oldKey != "" {
			if err := store.Delete(r.Context(), oldKey); err != nil {
				log.Printf("Aviso: no se pudo borrar carta %s: %v\n", oldKey, err)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// GetBranchLinksHandler es público: WhatsApp, web y carta de un comercio.
// Se cachea unos minutos para absorber picos sin tocar la BD.
func GetBranchLinksHandler(w http.ResponseWriter, r *http.Request) {
	branchID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || branchID <= 0 {
		writeJSONError(w, http.StatusBadRequest, "ID de sucursal inválido")
		return
	}
	if database.DB == nil {
		writeJSONError(w, http.StatusInternalServerError, "Base de datos no disponible")
		return
	}

	resp := BranchLinksResponse{Success: true}
	err = database.DB.QueryRow(`
		SELECT COALESCE(whatsapp, ''), COALESCE(whatsapp_message, ''), COALESCE(website_url, ''),
		       COALESCE(menu_pdf_url, ''), COALESCE(menu_pdf_size, 0)
		FROM company_branches
		WHERE id = $1`, branchID).
		Scan(&resp.Whatsapp, &resp.WhatsappMessage, &resp.WebsiteUrl, &resp.MenuPdfUrl, &resp.MenuPdfSize)
	if err == sql.ErrNoRows {
		writeJSONError(w, http.StatusNotFound, "Sucursal no encontrada")
		return
	} else if err != nil {
		log.Printf("Error leyendo enlaces de sucursal %d: %v\n", branchID, err)
		writeJSONError(w, http.StatusInternalServerError, "Error de base de datos")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=300")
	json.NewEncoder(w).Encode(resp)
}
