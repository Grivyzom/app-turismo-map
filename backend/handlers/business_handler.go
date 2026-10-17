package handlers

import (
	"backend/database"
	"backend/middleware"
	"backend/models"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type CompanyLocationResponse struct {
	Success         bool    `json:"success"`
	HasLocation     bool    `json:"hasLocation"`
	Latitude        float64 `json:"latitude"`
	Longitude       float64 `json:"longitude"`
	Address         string  `json:"address"`
	BranchName      string  `json:"branchName"`
	Description     string  `json:"description"`
	Category        string  `json:"category"`
	Phone           string  `json:"phone"`
	ImageUrl        string  `json:"imageUrl"`
	Whatsapp        string  `json:"whatsapp"`
	WhatsappMessage string  `json:"whatsappMessage"`
	WebsiteUrl      string  `json:"websiteUrl"`
	MenuPdfUrl      string  `json:"menuPdfUrl"`
	MenuPdfSize     int     `json:"menuPdfSize"`
	Message         string  `json:"message,omitempty"`
}

type UpdateLocationRequest struct {
	Latitude        float64 `json:"latitude"`
	Longitude       float64 `json:"longitude"`
	Address         string  `json:"address"`
	BranchName      string  `json:"branchName,omitempty"`
	Description     string  `json:"description"`
	Category        string  `json:"category"`
	Phone           string  `json:"phone"`
	ImageUrl        string  `json:"imageUrl"`
	Whatsapp        string  `json:"whatsapp"`
	WhatsappMessage string  `json:"whatsappMessage"`
	WebsiteUrl      string  `json:"websiteUrl"`
}

// GetCompanyLocationHandler devuelve la ubicación actual de la empresa vinculada al usuario con todos sus detalles
func GetCompanyLocationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "No autorizado",
		})
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "ID de usuario inválido en token",
		})
		return
	}
	userID := int(userIDFloat)

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// 1. Obtener el company_id del usuario
	var companyID int
	err := database.DB.QueryRow("SELECT company_id FROM company_members WHERE user_id = $1 LIMIT 1", userID).Scan(&companyID)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "El usuario no pertenece a ninguna empresa",
		})
		return
	} else if err != nil {
		log.Printf("Error al buscar membresía de empresa para usuario %d: %v\n", userID, err)
		http.Error(w, "Error de base de datos", http.StatusInternalServerError)
		return
	}

	// 2. Buscar la primera sucursal (main branch) de la empresa para ver si tiene coordenadas
	var branchID int
	var branchName string
	var description string
	var category string
	var address string
	var phone string
	var imageUrl string
	var whatsapp, whatsappMessage, websiteUrl, menuPdfUrl string
	var menuPdfSize int
	var lat, lng float64

	err = database.DB.QueryRow(`
		SELECT 
			id, 
			COALESCE(branch_name, ''), 
			COALESCE(description, ''), 
			COALESCE(category, 'gastronomia'), 
			COALESCE(address, ''), 
			COALESCE(phone, ''), 
			COALESCE(image_url, ''),
			COALESCE(whatsapp, ''),
			COALESCE(whatsapp_message, ''),
			COALESCE(website_url, ''),
			COALESCE(menu_pdf_url, ''),
			COALESCE(menu_pdf_size, 0),
			ST_Y(geom::geometry) as lat, 
			ST_X(geom::geometry) as lng
		FROM company_branches
		WHERE company_id = $1
		ORDER BY id ASC
		LIMIT 1`, companyID).Scan(&branchID, &branchName, &description, &category, &address, &phone, &imageUrl, &whatsapp, &whatsappMessage, &websiteUrl, &menuPdfUrl, &menuPdfSize, &lat, &lng)

	if err == sql.ErrNoRows {
		// La empresa no tiene sucursal / ubicación configurada
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(CompanyLocationResponse{
			Success:     true,
			HasLocation: false,
			Latitude:    -39.8142, // default Valdivia
			Longitude:   -73.2459, // default Valdivia
			Address:     "",
			BranchName:  "",
			Description: "",
			Category:    "gastronomia",
			Phone:       "",
			ImageUrl:    "",
		})
		return
	} else if err != nil {
		log.Printf("Error al buscar sucursal de empresa para company %d: %v\n", companyID, err)
		http.Error(w, "Error de base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(CompanyLocationResponse{
		Success:         true,
		HasLocation:     true,
		Latitude:        lat,
		Longitude:       lng,
		Address:         address,
		BranchName:      branchName,
		Description:     description,
		Category:        category,
		Phone:           phone,
		ImageUrl:        imageUrl,
		Whatsapp:        whatsapp,
		WhatsappMessage: whatsappMessage,
		WebsiteUrl:      websiteUrl,
		MenuPdfUrl:      menuPdfUrl,
		MenuPdfSize:     menuPdfSize,
	})
}

// UpdateCompanyLocationHandler crea o actualiza la ubicación (sucursal principal) de la empresa
func UpdateCompanyLocationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "No autorizado",
		})
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "ID de usuario inválido en token",
		})
		return
	}
	userID := int(userIDFloat)

	var req UpdateLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Payload inválido",
		})
		return
	}

	if req.Latitude == 0 || req.Longitude == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Las coordenadas de latitud y longitud son requeridas",
		})
		return
	}

	whatsapp, ok := normalizeWhatsapp(req.Whatsapp)
	if !ok {
		writeJSONError(w, http.StatusBadRequest, "Número de WhatsApp inválido (ej. +56 9 1234 5678)")
		return
	}
	websiteUrl, ok := normalizeWebsite(req.WebsiteUrl)
	if !ok {
		writeJSONError(w, http.StatusBadRequest, "Sitio web inválido (ej. https://minegocio.cl)")
		return
	}
	whatsappMessage := strings.TrimSpace(req.WhatsappMessage)
	if len([]rune(whatsappMessage)) > 300 {
		writeJSONError(w, http.StatusBadRequest, "El mensaje de WhatsApp debe tener máximo 300 caracteres")
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// 1. Obtener el company_id del usuario
	var companyID int
	err := database.DB.QueryRow("SELECT company_id FROM company_members WHERE user_id = $1 LIMIT 1", userID).Scan(&companyID)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "El usuario no pertenece a ninguna empresa",
		})
		return
	} else if err != nil {
		log.Printf("Error al buscar membresía de empresa para usuario %d: %v\n", userID, err)
		http.Error(w, "Error de base de datos", http.StatusInternalServerError)
		return
	}

	// 2. Obtener datos de la empresa para completar datos de la sucursal en caso de creación
	var businessName string
	var defaultCategory string
	var defaultPhone string
	err = database.DB.QueryRow("SELECT business_name, COALESCE(category, 'gastronomia'), COALESCE(phone, '') FROM companies WHERE id = $1", companyID).Scan(&businessName, &defaultCategory, &defaultPhone)
	if err != nil {
		log.Printf("Error al buscar info de empresa %d: %v\n", companyID, err)
		http.Error(w, "Error al buscar información de la empresa", http.StatusInternalServerError)
		return
	}

	finalBranchName := req.BranchName
	if finalBranchName == "" {
		finalBranchName = businessName
	}

	finalCategory := req.Category
	if finalCategory == "" {
		finalCategory = defaultCategory
	}

	finalPhone := req.Phone
	if finalPhone == "" {
		finalPhone = defaultPhone
	}

	// 3. Verificar si ya existe una sucursal para actualizar, o si debemos crear una nueva
	var branchID int
	err = database.DB.QueryRow("SELECT id FROM company_branches WHERE company_id = $1 ORDER BY id ASC LIMIT 1", companyID).Scan(&branchID)

	if err == sql.ErrNoRows {
		// Crear nueva sucursal
		_, err = database.DB.Exec(`
			INSERT INTO company_branches (company_id, branch_name, description, category, address, phone, image_url, whatsapp, whatsapp_message, website_url, geom)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($10, ''), NULLIF($11, ''), NULLIF($12, ''), ST_SetSRID(ST_MakePoint($8, $9), 4326))`,
			companyID,
			finalBranchName,
			req.Description,
			finalCategory,
			req.Address,
			finalPhone,
			req.ImageUrl,
			req.Longitude,
			req.Latitude,
			whatsapp,
			whatsappMessage,
			websiteUrl,
		)
		if err != nil {
			log.Printf("Error creando sucursal de empresa %d: %v\n", companyID, err)
			http.Error(w, "Error al guardar la ubicación en la base de datos", http.StatusInternalServerError)
			return
		}
	} else if err == nil {
		// Actualizar sucursal existente
		_, err = database.DB.Exec(`
			UPDATE company_branches
			SET branch_name = $1,
			    address = $2,
			    description = $3,
			    category = $4,
			    phone = $5,
			    image_url = $6,
			    geom = ST_SetSRID(ST_MakePoint($7, $8), 4326),
			    whatsapp = NULLIF($10, ''),
			    whatsapp_message = NULLIF($11, ''),
			    website_url = NULLIF($12, '')
			WHERE id = $9`,
			finalBranchName,
			req.Address,
			req.Description,
			finalCategory,
			finalPhone,
			req.ImageUrl,
			req.Longitude,
			req.Latitude,
			branchID,
			whatsapp,
			whatsappMessage,
			websiteUrl,
		)
		if err != nil {
			log.Printf("Error actualizando sucursal %d de empresa %d: %v\n", branchID, companyID, err)
			http.Error(w, "Error al actualizar la ubicación en la base de datos", http.StatusInternalServerError)
			return
		}
	} else {
		log.Printf("Error al verificar sucursales de empresa %d: %v\n", companyID, err)
		http.Error(w, "Error de base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(CompanyLocationResponse{
		Success:         true,
		HasLocation:     true,
		Latitude:        req.Latitude,
		Longitude:       req.Longitude,
		Address:         req.Address,
		BranchName:      finalBranchName,
		Description:     req.Description,
		Category:        finalCategory,
		Phone:           finalPhone,
		ImageUrl:        req.ImageUrl,
		Whatsapp:        whatsapp,
		WhatsappMessage: whatsappMessage,
		WebsiteUrl:      websiteUrl,
		Message:         "Ubicación de la empresa guardada correctamente",
	})
}
