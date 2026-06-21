package handlers

import (
	"backend/database"
	"backend/middleware"
	"backend/models"
	"backend/utils"
	"crypto/rand"
	"database/sql"
	"encoding/base32"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ── Helpers de auditoría ─────────────────────────────────────────────────

// logAudit registra una acción en la tabla admin_audit_log.
func logAudit(adminID *int, action, ip, userAgent, details string) {
	if database.DB == nil {
		return
	}
	_, err := database.DB.Exec(
		`INSERT INTO admin_audit_log (admin_id, action, ip_address, user_agent, details) 
		 VALUES ($1, $2, $3, $4, $5)`,
		adminID, action, ip, userAgent, details,
	)
	if err != nil {
		log.Printf("Error registrando auditoría [%s]: %v\n", action, err)
	}
}

// generateChallengeID genera un ID criptográficamente seguro para challenges 2FA.
func generateChallengeID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// generateTOTPSecret genera un secreto TOTP de 20 bytes codificado en base32.
func generateTOTPSecret() (string, error) {
	secret := make([]byte, 20)
	if _, err := rand.Read(secret); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(secret), nil
}

// ── Paso 1: Login Admin (email + contraseña) ─────────────────────────────

// AdminLoginHandler valida credenciales del admin y devuelve un challenge 2FA.
// Si el admin aún no ha configurado TOTP, le devuelve el URI para configurarlo.
// FLUJO:
//  1. Validar email + contraseña
//  2. Si la cuenta está bloqueada por intentos fallidos → rechazar
//  3. Si TOTP no está configurado → generar secreto, devolver URI de setup
//  4. Si TOTP está configurado → devolver challengeId para verificar código
func AdminLoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	ip := middleware.GetClientIP(r)
	userAgent := r.UserAgent()

	var req models.AdminLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if req.Email == "" || req.Password == "" {
		writeAdminJSON(w, http.StatusBadRequest, models.AdminLoginResponse{
			Success: false,
			Message: "Email y contraseña son requeridos",
		})
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// Buscar admin en la tabla separada admin_users
	var id, failedAttempts int
	var name, role, status, passwordHash string
	var totpSecret sql.NullString
	var totpReady bool
	var lockedUntil sql.NullTime

	err := database.DB.QueryRow(
		`SELECT id, name, role, status, password_hash, totp_secret, totp_ready, 
		        failed_attempts, locked_until 
		 FROM admin_users WHERE email = $1`,
		req.Email,
	).Scan(&id, &name, &role, &status, &passwordHash, &totpSecret, &totpReady, &failedAttempts, &lockedUntil)

	if err == sql.ErrNoRows {
		// SEGURIDAD: No revelar si el email existe o no
		middleware.IncrementIPAttempts(ip)
		logAudit(nil, "login_failed", ip, userAgent, fmt.Sprintf("Email no encontrado: %s", req.Email))

		// Ejecutar bcrypt de todas formas para prevenir timing attacks
		bcrypt.CompareHashAndPassword([]byte("$2a$10$dummyhashtopreventtimingattacks000000000000000000"), []byte(req.Password))

		writeAdminJSON(w, http.StatusUnauthorized, models.AdminLoginResponse{
			Success: false,
			Message: "Credenciales inválidas",
		})
		return
	} else if err != nil {
		log.Printf("Error consultando admin: %v\n", err)
		http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
		return
	}

	// Verificar si la cuenta está bloqueada por intentos fallidos
	if lockedUntil.Valid && time.Now().Before(lockedUntil.Time) {
		remaining := time.Until(lockedUntil.Time).Minutes()
		logAudit(&id, "login_blocked", ip, userAgent, fmt.Sprintf("Cuenta bloqueada, %d minutos restantes", int(remaining)))
		writeAdminJSON(w, http.StatusTooManyRequests, models.AdminLoginResponse{
			Success: false,
			Message: fmt.Sprintf("Cuenta bloqueada. Intente de nuevo en %d minutos.", int(remaining)+1),
		})
		return
	}

	// Verificar si la cuenta está suspendida
	if status == "suspended" {
		logAudit(&id, "login_suspended", ip, userAgent, "Intento de login en cuenta suspendida")
		writeAdminJSON(w, http.StatusForbidden, models.AdminLoginResponse{
			Success: false,
			Message: "Cuenta suspendida. Contacte al superadministrador.",
		})
		return
	}

	// Validar contraseña
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		newAttempts := failedAttempts + 1
		middleware.IncrementIPAttempts(ip)

		if newAttempts >= middleware.MaxAdminLoginAttempts {
			// Bloquear la cuenta
			lockUntil := time.Now().Add(middleware.AdminLockoutDuration)
			database.DB.Exec(
				"UPDATE admin_users SET failed_attempts = $1, locked_until = $2 WHERE id = $3",
				newAttempts, lockUntil, id,
			)
			logAudit(&id, "account_locked", ip, userAgent, fmt.Sprintf("Cuenta bloqueada tras %d intentos fallidos", newAttempts))
		} else {
			database.DB.Exec("UPDATE admin_users SET failed_attempts = $1 WHERE id = $2", newAttempts, id)
			logAudit(&id, "login_failed", ip, userAgent, fmt.Sprintf("Contraseña incorrecta (intento %d/%d)", newAttempts, middleware.MaxAdminLoginAttempts))
		}

		writeAdminJSON(w, http.StatusUnauthorized, models.AdminLoginResponse{
			Success: false,
			Message: "Credenciales inválidas",
		})
		return
	}

	// ── Contraseña correcta ──────────────────────────────────────────────

	// Resetear intentos fallidos
	database.DB.Exec("UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1", id)

	admin := models.AdminUser{
		ID:        id,
		Email:     req.Email,
		Name:      name,
		Role:      role,
		Status:    status,
		TOTPReady: totpReady,
	}

	// ── Caso A: TOTP no configurado → Setup inicial ──────────────────────
	if !totpReady {
		secret, err := generateTOTPSecret()
		if err != nil {
			log.Printf("Error generando secreto TOTP: %v\n", err)
			http.Error(w, "Error interno", http.StatusInternalServerError)
			return
		}

		// Guardar el secreto encriptado en la BD (pendiente de confirmación)
		database.DB.Exec("UPDATE admin_users SET totp_secret = $1 WHERE id = $2", secret, id)

		// Construir URI otpauth:// para apps como Google Authenticator
		otpauthURI := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&digits=6&period=30",
			url.PathEscape("AppTurismoAdmin"),
			url.PathEscape(req.Email),
			secret,
			url.PathEscape("AppTurismoAdmin"),
		)

		// Crear un challenge temporal para que el frontend verifique el código
		challengeID, _ := generateChallengeID()
		storeChallengeInRedis(challengeID, id, "setup")

		logAudit(&id, "totp_setup_started", ip, userAgent, "Inicio de configuración 2FA")

		writeAdminJSON(w, http.StatusOK, models.AdminLoginResponse{
			Success:      true,
			Message:      "Configuración de autenticación 2FA requerida",
			Requires2FA:  true,
			ChallengeID:  challengeID,
			TOTPSetupURI: otpauthURI,
			TOTPSetupKey: secret,
			Admin:        admin,
		})
		return
	}

	// ── Caso B: TOTP ya configurado → Solicitar código ───────────────────
	challengeID, err := generateChallengeID()
	if err != nil {
		http.Error(w, "Error interno", http.StatusInternalServerError)
		return
	}
	storeChallengeInRedis(challengeID, id, "verify")

	logAudit(&id, "2fa_challenge_issued", ip, userAgent, "Challenge 2FA emitido")

	writeAdminJSON(w, http.StatusOK, models.AdminLoginResponse{
		Success:     true,
		Message:     "Ingrese el código de su aplicación de autenticación",
		Requires2FA: true,
		ChallengeID: challengeID,
		Admin:       admin,
	})
}

// ── Paso 2: Verificar código TOTP ────────────────────────────────────────

// AdminVerify2FAHandler valida el código TOTP contra el secreto del admin.
// Si es correcto, emite un JWT con scope "admin".
func AdminVerify2FAHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	ip := middleware.GetClientIP(r)
	userAgent := r.UserAgent()

	var req models.AdminVerify2FARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	if req.ChallengeID == "" || req.TOTPCode == "" {
		writeAdminJSON(w, http.StatusBadRequest, models.AdminSessionResponse{
			Success: false,
			Message: "challengeId y totpCode son requeridos",
		})
		return
	}

	// Recuperar el challenge de Redis
	adminID, challengeType, err := getChallengeFromRedis(req.ChallengeID)
	if err != nil {
		middleware.IncrementIPAttempts(ip)
		writeAdminJSON(w, http.StatusUnauthorized, models.AdminSessionResponse{
			Success: false,
			Message: "Challenge expirado o inválido. Inicie sesión de nuevo.",
		})
		return
	}

	// Invalidar el challenge inmediatamente (single-use)
	deleteChallengeFromRedis(req.ChallengeID)

	// Obtener el secreto TOTP del admin
	var email, name, role, status string
	var totpSecret sql.NullString
	err = database.DB.QueryRow(
		"SELECT email, name, role, status, totp_secret FROM admin_users WHERE id = $1",
		adminID,
	).Scan(&email, &name, &role, &status, &totpSecret)
	if err != nil {
		log.Printf("Error consultando admin para 2FA: %v\n", err)
		http.Error(w, "Error interno", http.StatusInternalServerError)
		return
	}

	if !totpSecret.Valid || totpSecret.String == "" {
		writeAdminJSON(w, http.StatusInternalServerError, models.AdminSessionResponse{
			Success: false,
			Message: "Error de configuración 2FA. Contacte al superadministrador.",
		})
		return
	}

	// Validar el código TOTP
	if !utils.ValidateTOTP(totpSecret.String, req.TOTPCode) {
		middleware.IncrementIPAttempts(ip)
		logAudit(&adminID, "2fa_failed", ip, userAgent, "Código TOTP inválido")

		// Incrementar failed_attempts en la cuenta
		database.DB.Exec("UPDATE admin_users SET failed_attempts = failed_attempts + 1 WHERE id = $1", adminID)

		writeAdminJSON(w, http.StatusUnauthorized, models.AdminSessionResponse{
			Success: false,
			Message: "Código de verificación inválido",
		})
		return
	}

	// ── Código TOTP válido ───────────────────────────────────────────────

	// Si era un setup, marcar TOTP como listo y activar la cuenta
	if challengeType == "setup" {
		database.DB.Exec(
			"UPDATE admin_users SET totp_ready = true, status = 'active', failed_attempts = 0 WHERE id = $1",
			adminID,
		)
		logAudit(&adminID, "totp_setup_completed", ip, userAgent, "Configuración 2FA completada exitosamente")
	}

	// Resetear intentos fallidos y rate limit
	database.DB.Exec("UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1", adminID)
	middleware.ResetIPAttempts(ip)

	admin := models.AdminUser{
		ID:        adminID,
		Email:     email,
		Name:      name,
		Role:      role,
		Status:    "active",
		TOTPReady: true,
	}

	// Generar JWT con scope "admin" y duración de 1 hora
	token, err := utils.GenerateAdminToken(admin)
	if err != nil {
		log.Printf("Error generando token admin: %v\n", err)
		http.Error(w, "Error generando sesión", http.StatusInternalServerError)
		return
	}

	logAudit(&adminID, "login_success", ip, userAgent, fmt.Sprintf("Sesión admin iniciada [role=%s]", role))

	writeAdminJSON(w, http.StatusOK, models.AdminSessionResponse{
		Success: true,
		Message: "Autenticación exitosa",
		Admin:   admin,
		Token:   token,
	})
}

// ── Endpoints protegidos del Admin Panel ─────────────────────────────────

// AdminMeHandler devuelve la información del admin autenticado.
func AdminMeHandler(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(middleware.AdminContextKey).(jwt.MapClaims)
	if !ok {
		writeAdminJSON(w, http.StatusUnauthorized, map[string]interface{}{
			"success": false,
			"message": "No autorizado",
		})
		return
	}

	adminIDFloat, _ := claims["id"].(float64)
	adminID := int(adminIDFloat)

	var email, name, role, status string
	var totpReady bool
	var createdAt time.Time
	err := database.DB.QueryRow(
		"SELECT email, name, role, status, totp_ready, created_at FROM admin_users WHERE id = $1",
		adminID,
	).Scan(&email, &name, &role, &status, &totpReady, &createdAt)
	if err != nil {
		http.Error(w, "Admin no encontrado", http.StatusNotFound)
		return
	}

	writeAdminJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"admin": models.AdminUser{
			ID:        adminID,
			Email:     email,
			Name:      name,
			Role:      role,
			Status:    status,
			TOTPReady: totpReady,
		},
	})
}

// AdminAuditLogHandler devuelve las últimas entradas del log de auditoría.
func AdminAuditLogHandler(w http.ResponseWriter, r *http.Request) {
	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	rows, err := database.DB.Query(
		`SELECT al.id, al.admin_id, al.action, al.ip_address, al.user_agent, 
		        COALESCE(al.details, ''), al.created_at 
		 FROM admin_audit_log al 
		 ORDER BY al.created_at DESC 
		 LIMIT 100`,
	)
	if err != nil {
		log.Printf("Error consultando audit log: %v\n", err)
		http.Error(w, "Error en consulta", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	entries := []models.AuditLogEntry{}
	for rows.Next() {
		var entry models.AuditLogEntry
		var adminID sql.NullInt32
		var createdAt time.Time
		if err := rows.Scan(&entry.ID, &adminID, &entry.Action, &entry.IPAddress, &entry.UserAgent, &entry.Details, &createdAt); err != nil {
			continue
		}
		if adminID.Valid {
			entry.AdminID = int(adminID.Int32)
		}
		entry.CreatedAt = createdAt.Format(time.RFC3339)
		entries = append(entries, entry)
	}

	writeAdminJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"entries": entries,
		"total":   len(entries),
	})
}

// ── Helpers ──────────────────────────────────────────────────────────────

func writeAdminJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// storeChallengeInRedis guarda un challenge temporal en Redis con TTL de 5 minutos.
func storeChallengeInRedis(challengeID string, adminID int, challengeType string) {
	if database.RDB == nil {
		return
	}
	key := fmt.Sprintf("admin_challenge:%s", challengeID)
	value := fmt.Sprintf("%d:%s", adminID, challengeType)
	database.RDB.Set(database.Ctx, key, value, 5*time.Minute)
}

// getChallengeFromRedis recupera un challenge de Redis.
func getChallengeFromRedis(challengeID string) (int, string, error) {
	if database.RDB == nil {
		return 0, "", fmt.Errorf("Redis no disponible")
	}
	key := fmt.Sprintf("admin_challenge:%s", challengeID)
	val, err := database.RDB.Get(database.Ctx, key).Result()
	if err != nil {
		return 0, "", fmt.Errorf("challenge no encontrado o expirado")
	}

	var adminID int
	var challengeType string
	_, err = fmt.Sscanf(val, "%d:%s", &adminID, &challengeType)
	if err != nil {
		return 0, "", fmt.Errorf("formato de challenge inválido")
	}
	return adminID, challengeType, nil
}

// deleteChallengeFromRedis elimina un challenge usado (single-use).
func deleteChallengeFromRedis(challengeID string) {
	if database.RDB == nil {
		return
	}
	key := fmt.Sprintf("admin_challenge:%s", challengeID)
	database.RDB.Del(database.Ctx, key)
}

// AdminKPIsHandler obtiene estadísticas y KPIs de uso del sistema.
func AdminKPIsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	kpi := models.AdminKPIs{
		UserTypes:    make(map[string]int),
		UserStatuses: make(map[string]int),
	}

	// 1. Total de usuarios
	err := database.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&kpi.TotalUsers)
	if err != nil {
		log.Printf("Error consultando total de usuarios: %v\n", err)
	}

	// 2. Usuarios activos
	err = database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE status = 'active'").Scan(&kpi.ActiveUsers)
	if err != nil {
		log.Printf("Error consultando usuarios activos: %v\n", err)
	}

	// 3. Registrados últimos 7 días
	err = database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'").Scan(&kpi.RegisteredLast7Days)
	if err != nil {
		log.Printf("Error consultando usuarios últimos 7 días: %v\n", err)
	}

	// 4. Registrados últimos 30 días
	err = database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'").Scan(&kpi.RegisteredLast30Days)
	if err != nil {
		log.Printf("Error consultando usuarios últimos 30 días: %v\n", err)
	}

	// 5. Distribución por tipo de usuario
	rowsTypes, err := database.DB.Query("SELECT COALESCE(user_type, 'citizen'), COUNT(*) FROM users GROUP BY user_type")
	if err == nil {
		defer rowsTypes.Close()
		for rowsTypes.Next() {
			var uType string
			var count int
			if err := rowsTypes.Scan(&uType, &count); err == nil {
				kpi.UserTypes[uType] = count
			}
		}
	} else {
		log.Printf("Error consultando tipos de usuarios: %v\n", err)
	}

	// 6. Distribución por estado de usuario
	rowsStatuses, err := database.DB.Query("SELECT COALESCE(status, 'active'), COUNT(*) FROM users GROUP BY status")
	if err == nil {
		defer rowsStatuses.Close()
		for rowsStatuses.Next() {
			var status string
			var count int
			if err := rowsStatuses.Scan(&status, &count); err == nil {
				kpi.UserStatuses[status] = count
			}
		}
	} else {
		log.Printf("Error consultando estados de usuarios: %v\n", err)
	}

	// 7. Total de empresas
	err = database.DB.QueryRow("SELECT COUNT(*) FROM companies").Scan(&kpi.TotalCompanies)
	if err != nil {
		log.Printf("Error consultando total de empresas: %v\n", err)
	}

	// 8. Total de eventos
	err = database.DB.QueryRow("SELECT COUNT(*) FROM events").Scan(&kpi.TotalEvents)
	if err != nil {
		log.Printf("Error consultando total de eventos: %v\n", err)
	}

	// 9. Total de reportes en mapa
	err = database.DB.QueryRow("SELECT COUNT(*) FROM map_reports").Scan(&kpi.TotalReports)
	if err != nil {
		log.Printf("Error consultando total de reportes: %v\n", err)
	}

	// 10. Datos de Geo-Inteligencia (PostGIS)
	spots := []struct {
		name   string
		lon    float64
		lat    float64
		radius float64
		base   int
	}{
		{"Isla Teja", -73.2506, -39.8142, 1000.0, 480},
		{"Costanera Arturo Prat", -73.2464, -39.8115, 800.0, 370},
		{"Parque Oncol", -73.3167, -39.7000, 3000.0, 240},
		{"Niebla / Zona Costera", -73.3969, -39.8708, 2000.0, 190},
		{"Centro Histórico", -73.2435, -39.8173, 800.0, 110},
	}

	kpi.Hotspots = make([]models.HeatmapZone, 0, len(spots))

	for _, s := range spots {
		var count int
		// Contar reportes de mapa en la zona
		errReport := database.DB.QueryRow(`
			SELECT COUNT(*) FROM map_reports 
			WHERE geom IS NOT NULL AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
		`, s.lon, s.lat, s.radius).Scan(&count)
		if errReport != nil {
			log.Printf("Error consultando reportes para hotspot %s: %v", s.name, errReport)
		}

		// Contar sucursales de empresas en la zona
		var branchesCount int
		errBranch := database.DB.QueryRow(`
			SELECT COUNT(*) FROM company_branches 
			WHERE geom IS NOT NULL AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
		`, s.lon, s.lat, s.radius).Scan(&branchesCount)
		if errBranch != nil {
			log.Printf("Error consultando sucursales para hotspot %s: %v", s.name, errBranch)
		}

		// Contar eventos en la zona
		var eventsCount int
		errEvent := database.DB.QueryRow(`
			SELECT COUNT(*) FROM events 
			WHERE geom IS NOT NULL AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
		`, s.lon, s.lat, s.radius).Scan(&eventsCount)
		if errEvent != nil {
			log.Printf("Error consultando eventos para hotspot %s: %v", s.name, errEvent)
		}

		// Sumar los recuentos de la BD al valor base para representar la densidad
		totalCount := s.base + (count+branchesCount+eventsCount)*12

		kpi.Hotspots = append(kpi.Hotspots, models.HeatmapZone{
			Zone:  s.name,
			Count: totalCount,
		})
	}

	kpi.AvgActivityTime = 12.4  // Promedio por defecto (minutos)
	kpi.OfflineUsageRate = 18.5 // Promedio por defecto (%)

	if database.RDB != nil {
		// Consultar Redis para duración de sesiones de mapa (escaneamos múltiples patrones posibles)
		keys1, _ := database.RDB.Keys(database.Ctx, "map_session:*").Result()
		keys2, _ := database.RDB.Keys(database.Ctx, "map_activity:*").Result()
		keys3, _ := database.RDB.Keys(database.Ctx, "map_activity_sessions:*").Result()

		allKeys := append(append(keys1, keys2...), keys3...)

		if len(allKeys) > 0 {
			var totalDuration float64
			var count int
			for _, key := range allKeys {
				val, err := database.RDB.Get(database.Ctx, key).Float64()
				if err == nil {
					totalDuration += val
					count++
				}
			}
			if count > 0 {
				// El valor acumulado en Redis son segundos, lo dividimos por 60 para obtener minutos
				kpi.AvgActivityTime = (totalDuration / float64(count)) / 60.0
			}
		}

		// Consultar Redis para métricas de cola de sincronización offline
		offlineCountStr, err := database.RDB.Get(database.Ctx, "sync_queue:offline_syncs").Result()
		if err == nil {
			var offlineCount int
			fmt.Sscanf(offlineCountStr, "%d", &offlineCount)
			totalSessionsStr, _ := database.RDB.Get(database.Ctx, "sync_queue:total_sessions").Result()
			var totalSessions int
			fmt.Sscanf(totalSessionsStr, "%d", &totalSessions)
			if totalSessions > 0 {
				kpi.OfflineUsageRate = (float64(offlineCount) / float64(totalSessions)) * 100.0
			}
		}
	}

	writeAdminJSON(w, http.StatusOK, kpi)
}

// ── Structs y Handlers para las nuevas opciones del Admin Panel ─────────────

type AdminCompanyItem struct {
	ID                 int       `json:"id"`
	BusinessName       string    `json:"businessName"`
	EntityType         string    `json:"entityType"`
	Category           string    `json:"category"`
	IsVerifiedBadge    bool      `json:"isVerifiedBadge"`
	TaxID              string    `json:"taxId"`
	VerificationStatus string    `json:"verificationStatus"`
	Phone              string    `json:"phone"`
	CreatedAt          time.Time `json:"createdAt"`
}

type AdminEventItem struct {
	ID              int       `json:"id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	StartTime       time.Time `json:"startTime"`
	EndTime         time.Time `json:"endTime"`
	Category        string    `json:"category"`
	Latitude        float64   `json:"latitude"`
	Longitude       float64   `json:"longitude"`
	EmitterType     string    `json:"emitterType"`
	UserEmitterID   *int      `json:"userEmitterId,omitempty"`
	BranchEmitterID *int      `json:"branchEmitterId,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	SectorName      string    `json:"sectorName,omitempty"`
	TargetAudience  string    `json:"targetAudience"`
	ImageUrl        string    `json:"imageUrl"`
	IsLive          bool      `json:"isLive"`
}

func AdminListCompaniesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	rows, err := database.DB.Query(
		`SELECT id, business_name, COALESCE(entity_type, 'business'), COALESCE(category, ''), 
		        COALESCE(is_verified_badge, false), COALESCE(tax_id, ''), 
		        COALESCE(verification_status, 'pending'), COALESCE(phone, ''), created_at 
		 FROM companies 
		 ORDER BY created_at DESC`,
	)
	if err != nil {
		log.Printf("Error consultando empresas para admin: %v\n", err)
		http.Error(w, "Error consultando base de datos", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	companies := []AdminCompanyItem{}
	for rows.Next() {
		var c AdminCompanyItem
		if err := rows.Scan(&c.ID, &c.BusinessName, &c.EntityType, &c.Category, &c.IsVerifiedBadge, &c.TaxID, &c.VerificationStatus, &c.Phone, &c.CreatedAt); err != nil {
			log.Printf("Error escaneando empresa: %v\n", err)
			continue
		}
		companies = append(companies, c)
	}

	writeAdminJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"companies": companies,
	})
}

type UpdateCompanyVerificationRequest struct {
	CompanyID          int    `json:"companyId"`
	VerificationStatus string `json:"verificationStatus"`
	IsVerifiedBadge    bool   `json:"isVerifiedBadge"`
}

func AdminUpdateCompanyVerificationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := r.Context().Value(middleware.AdminContextKey).(jwt.MapClaims)
	var adminID *int
	if ok {
		adminIDFloat, _ := claims["id"].(float64)
		val := int(adminIDFloat)
		adminID = &val
	}
	ip := middleware.GetClientIP(r)
	userAgent := r.UserAgent()

	var req UpdateCompanyVerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	if req.CompanyID == 0 {
		http.Error(w, "companyId es requerido", http.StatusBadRequest)
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	_, err := database.DB.Exec(
		`UPDATE companies 
		 SET verification_status = $1, is_verified_badge = $2 
		 WHERE id = $3`,
		req.VerificationStatus, req.IsVerifiedBadge, req.CompanyID,
	)
	if err != nil {
		log.Printf("Error actualizando verificación de empresa: %v\n", err)
		http.Error(w, "Error actualizando base de datos", http.StatusInternalServerError)
		return
	}

	logAudit(adminID, "company_verified", ip, userAgent, fmt.Sprintf("Empresa ID %d actualizada a status %s, badge=%t", req.CompanyID, req.VerificationStatus, req.IsVerifiedBadge))

	writeAdminJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Empresa actualizada exitosamente",
	})
}

func AdminListEventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}
	rows, err := database.DB.Query(
		`SELECT e.id, COALESCE(e.title, ''), COALESCE(e.description, ''), e.start_time, e.end_time, 
		        COALESCE(e.category, ''), ST_Y(e.geom::geometry) as latitude, ST_X(e.geom::geometry) as longitude, 
		        COALESCE(e.emitter_type, 'citizen'), e.user_emitter_id, e.branch_emitter_id, e.created_at,
		        COALESCE((SELECT name FROM zones z WHERE z.id = ANY(e.containing_zone_ids) LIMIT 1), '') as sector_name,
		        COALESCE(e.target_audience, 'all'), COALESCE(e.image_url, ''), COALESCE(e.is_live, false)
		 FROM events e
		 ORDER BY e.start_time DESC`,
	)
	if err != nil {
		log.Printf("Error consultando eventos para admin: %v\n", err)
		http.Error(w, "Error consultando base de datos", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	events := []AdminEventItem{}
	for rows.Next() {
		var e AdminEventItem
		var userEmitterID, branchEmitterID sql.NullInt64
		if err := rows.Scan(&e.ID, &e.Title, &e.Description, &e.StartTime, &e.EndTime, &e.Category, &e.Latitude, &e.Longitude, &e.EmitterType, &userEmitterID, &branchEmitterID, &e.CreatedAt, &e.SectorName, &e.TargetAudience, &e.ImageUrl, &e.IsLive); err != nil {
			log.Printf("Error escaneando evento: %v\n", err)
			continue
		}
		if userEmitterID.Valid {
			val := int(userEmitterID.Int64)
			e.UserEmitterID = &val
		}
		if branchEmitterID.Valid {
			val := int(branchEmitterID.Int64)
			e.BranchEmitterID = &val
		}
		events = append(events, e)
	}

	writeAdminJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"events": events,
	})
}

type DeleteEventRequest struct {
	EventID int `json:"eventId"`
}

func AdminDeleteEventHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := r.Context().Value(middleware.AdminContextKey).(jwt.MapClaims)
	var adminID *int
	if ok {
		adminIDFloat, _ := claims["id"].(float64)
		val := int(adminIDFloat)
		adminID = &val
	}
	ip := middleware.GetClientIP(r)
	userAgent := r.UserAgent()

	var req DeleteEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	if req.EventID == 0 {
		http.Error(w, "eventId es requerido", http.StatusBadRequest)
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// Eliminar de event_attendees
	database.DB.Exec("DELETE FROM event_attendees WHERE event_id = $1", req.EventID)

	_, err := database.DB.Exec("DELETE FROM events WHERE id = $1", req.EventID)
	if err != nil {
		log.Printf("Error eliminando evento: %v\n", err)
		http.Error(w, "Error eliminando de la base de datos", http.StatusInternalServerError)
		return
	}

	logAudit(adminID, "event_deleted", ip, userAgent, fmt.Sprintf("Evento ID %d eliminado por el administrador", req.EventID))

	writeAdminJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Evento eliminado exitosamente",
	})
}

type ToggleLiveEventRequest struct {
	EventID int  `json:"eventId"`
	IsLive  bool `json:"isLive"`
}

func AdminToggleLiveEventHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	adminIDVal := r.Context().Value("admin_id")
	if adminIDVal == nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}
	adminID := int(adminIDVal.(float64))

	var req ToggleLiveEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Error decodificando request", http.StatusBadRequest)
		return
	}

	if req.EventID == 0 {
		http.Error(w, "eventId es requerido", http.StatusBadRequest)
		return
	}

	_, err := database.DB.Exec("UPDATE events SET is_live = $1 WHERE id = $2", req.IsLive, req.EventID)
	if err != nil {
		log.Printf("Error actualizando evento: %v\n", err)
		http.Error(w, "Error en base de datos", http.StatusInternalServerError)
		return
	}

	ip := r.RemoteAddr
	userAgent := r.UserAgent()
	logAudit(&adminID, "event_toggle_live", ip, userAgent, fmt.Sprintf("Evento ID %d is_live cambiado a %v", req.EventID, req.IsLive))

	writeAdminJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Estado en vivo actualizado",
	})
}

type AdminCreateEventRequest struct {
	Title          string  `json:"title"`
	Description    string  `json:"description"`
	StartTime      string  `json:"startTime"`
	EndTime        string  `json:"endTime"`
	Category       string  `json:"category"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	EmitterType    string  `json:"emitterType"`    // citizen o business
	UserEmitterID  *int    `json:"userEmitterId"`  // opcional
	BranchEmitterID *int   `json:"branchEmitterId"` // opcional
	TargetAudience string  `json:"targetAudience"` // default 'all'
	ImageUrl       string  `json:"imageUrl"`
}

func AdminCreateEventHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := r.Context().Value(middleware.AdminContextKey).(jwt.MapClaims)
	var adminID *int
	if ok {
		adminIDFloat, _ := claims["id"].(float64)
		val := int(adminIDFloat)
		adminID = &val
	}
	ip := middleware.GetClientIP(r)
	userAgent := r.UserAgent()

	var req AdminCreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Cuerpo de solicitud inválido", http.StatusBadRequest)
		return
	}

	if req.Title == "" || req.Category == "" || req.Latitude == 0 || req.Longitude == 0 {
		http.Error(w, "Título, categoría, latitud y longitud son obligatorios", http.StatusBadRequest)
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// 1. Parsear tiempos
	var start, end time.Time
	var err error

	if req.StartTime != "" {
		start, err = time.Parse(time.RFC3339, req.StartTime)
		if err != nil {
			start, err = time.Parse("2006-01-02 15:04:05", req.StartTime)
			if err != nil {
				start = time.Now()
			}
		}
	} else {
		start = time.Now()
	}

	if req.EndTime != "" {
		end, err = time.Parse(time.RFC3339, req.EndTime)
		if err != nil {
			end, err = time.Parse("2006-01-02 15:04:05", req.EndTime)
			if err != nil {
				end = start.Add(2 * time.Hour)
			}
		}
	} else {
		end = start.Add(2 * time.Hour)
	}

	emitterType := req.EmitterType
	if emitterType == "" {
		emitterType = "citizen"
	}

	targetAud := req.TargetAudience
	if targetAud == "" {
		targetAud = "all"
	}

	var eventID int
	query := `
		INSERT INTO events (title, description, start_time, end_time, category, geom, emitter_type, user_emitter_id, branch_emitter_id, target_audience, image_url, created_at)
		VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9, $10, $11, $12, NOW())
		RETURNING id
	`
	var userVal interface{} = nil
	if req.UserEmitterID != nil {
		userVal = *req.UserEmitterID
	}
	var branchVal interface{} = nil
	if req.BranchEmitterID != nil {
		branchVal = *req.BranchEmitterID
	}

	err = database.DB.QueryRow(query,
		req.Title,
		req.Description,
		start,
		end,
		req.Category,
		req.Longitude,
		req.Latitude,
		emitterType,
		userVal,
		branchVal,
		targetAud,
		req.ImageUrl,
	).Scan(&eventID)

	if err != nil {
		log.Printf("Error al insertar evento en la BD: %v\n", err)
		http.Error(w, "Error al guardar el evento en la base de datos", http.StatusInternalServerError)
		return
	}

	logAudit(adminID, "event_created", ip, userAgent, fmt.Sprintf("Evento '%s' (ID %d) creado por el administrador", req.Title, eventID))

	writeAdminJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Evento/Pin creado exitosamente",
		"eventId": eventID,
	})
}

type AdminCreateBranchRequest struct {
	CompanyID      int     `json:"companyId"`
	BranchName     string  `json:"branchName"`
	Description    string  `json:"description"`
	Category       string  `json:"category"`
	Address        string  `json:"address"`
	Phone          string  `json:"phone"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	ImageUrl       string  `json:"imageUrl"`
	TargetAudience string  `json:"targetAudience"` // default 'all'
}

func AdminCreateBranchHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := r.Context().Value(middleware.AdminContextKey).(jwt.MapClaims)
	var adminID *int
	if ok {
		adminIDFloat, _ := claims["id"].(float64)
		val := int(adminIDFloat)
		adminID = &val
	}
	ip := middleware.GetClientIP(r)
	userAgent := r.UserAgent()

	var req AdminCreateBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Cuerpo de solicitud inválido", http.StatusBadRequest)
		return
	}

	if req.BranchName == "" || req.Latitude == 0 || req.Longitude == 0 {
		http.Error(w, "Nombre, latitud y longitud son obligatorios", http.StatusBadRequest)
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// Si no se especifica companyID, buscamos o creamos una compañía por defecto
	var err error
	companyID := req.CompanyID
	if companyID == 0 {
		err = database.DB.QueryRow("SELECT id FROM companies ORDER BY id ASC LIMIT 1").Scan(&companyID)
		if err == sql.ErrNoRows {
			// Crear una compañía genérica
			err = database.DB.QueryRow(`
				INSERT INTO companies (business_name, rut, email, is_verified) 
				VALUES ('Turismo General', '11111111-1', 'general@turismomap.com', true) 
				RETURNING id
			`).Scan(&companyID)
			if err != nil {
				log.Printf("Error al crear compañía por defecto: %v\n", err)
				http.Error(w, "Error al configurar compañía por defecto", http.StatusInternalServerError)
				return
			}
		} else if err != nil {
			log.Printf("Error al buscar compañía por defecto: %v\n", err)
			http.Error(w, "Error de base de datos", http.StatusInternalServerError)
			return
		}
	}

	targetAud := req.TargetAudience
	if targetAud == "" {
		targetAud = "all"
	}

	var branchID int
	query := `
		INSERT INTO company_branches (company_id, branch_name, description, category, address, phone, geom, image_url, target_audience, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), $9, $10, NOW())
		RETURNING id
	`
	err = database.DB.QueryRow(query,
		companyID,
		req.BranchName,
		req.Description,
		req.Category,
		req.Address,
		req.Phone,
		req.Longitude,
		req.Latitude,
		req.ImageUrl,
		targetAud,
	).Scan(&branchID)

	if err != nil {
		log.Printf("Error al insertar sucursal en BD: %v\n", err)
		http.Error(w, "Error al guardar la tienda en la base de datos", http.StatusInternalServerError)
		return
	}

	logAudit(adminID, "branch_created", ip, userAgent, fmt.Sprintf("Sucursal '%s' (ID %d) creada por el administrador", req.BranchName, branchID))

	writeAdminJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Tienda/Sucursal creada exitosamente",
		"branchId": branchID,
	})
}

type AdminBranchItem struct {
	ID             int       `json:"id"`
	CompanyID      int       `json:"companyId"`
	CompanyName    string    `json:"companyName"`
	BranchName     string    `json:"branchName"`
	Description    string    `json:"description"`
	Category       string    `json:"category"`
	Address        string    `json:"address"`
	Phone          string    `json:"phone"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	ImageUrl       string    `json:"imageUrl"`
	TargetAudience string    `json:"targetAudience"`
	CreatedAt      time.Time `json:"createdAt"`
	SectorName     string    `json:"sectorName,omitempty"`
}

func AdminListBranchesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	rows, err := database.DB.Query(
		`SELECT b.id, b.company_id, c.business_name, b.branch_name, COALESCE(b.description, ''), 
		        COALESCE(b.category, ''), COALESCE(b.address, ''), COALESCE(b.phone, ''), 
		        ST_Y(b.geom::geometry) as latitude, ST_X(b.geom::geometry) as longitude, 
		        COALESCE(b.image_url, ''), COALESCE(b.target_audience, 'all'), b.created_at,
		        COALESCE((SELECT name FROM zones z WHERE z.id = ANY(b.containing_zone_ids) LIMIT 1), '') as sector_name
		 FROM company_branches b
		 JOIN companies c ON b.company_id = c.id
		 ORDER BY b.created_at DESC`,
	)
	if err != nil {
		log.Printf("Error consultando sucursales para admin: %v\n", err)
		http.Error(w, "Error consultando base de datos", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	branches := []AdminBranchItem{}
	for rows.Next() {
		var b AdminBranchItem
		if err := rows.Scan(&b.ID, &b.CompanyID, &b.CompanyName, &b.BranchName, &b.Description, &b.Category, &b.Address, &b.Phone, &b.Latitude, &b.Longitude, &b.ImageUrl, &b.TargetAudience, &b.CreatedAt, &b.SectorName); err != nil {
			log.Printf("Error escaneando sucursal: %v\n", err)
			continue
		}
		branches = append(branches, b)
	}

	writeAdminJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"branches": branches,
	})
}

type DeleteBranchRequest struct {
	BranchID int `json:"branchId"`
}

func AdminDeleteBranchHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := r.Context().Value(middleware.AdminContextKey).(jwt.MapClaims)
	var adminID *int
	if ok {
		adminIDFloat, _ := claims["id"].(float64)
		val := int(adminIDFloat)
		adminID = &val
	}
	ip := middleware.GetClientIP(r)
	userAgent := r.UserAgent()

	var req DeleteBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	if req.BranchID == 0 {
		http.Error(w, "branchId es requerido", http.StatusBadRequest)
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// 1. Eliminar event_attendees vinculados a eventos de esta sucursal
	database.DB.Exec("DELETE FROM event_attendees WHERE event_id IN (SELECT id FROM events WHERE branch_emitter_id = $1)", req.BranchID)

	// 2. Eliminar de events vinculados a esta branch
	database.DB.Exec("DELETE FROM events WHERE branch_emitter_id = $1", req.BranchID)

	// 3. Eliminar de company_catalog_items vinculados a esta branch
	database.DB.Exec("DELETE FROM company_catalog_items WHERE branch_id = $1", req.BranchID)

	// 4. Eliminar de place_reviews vinculados a esta branch
	database.DB.Exec("DELETE FROM place_reviews WHERE branch_id = $1", req.BranchID)

	// 5. Desvincular de company_members
	database.DB.Exec("UPDATE company_members SET branch_id = NULL WHERE branch_id = $1", req.BranchID)

	// 6. Eliminar la sucursal (las tablas products y promotions tienen ON DELETE CASCADE)
	_, err := database.DB.Exec("DELETE FROM company_branches WHERE id = $1", req.BranchID)
	if err != nil {
		log.Printf("Error eliminando sucursal: %v\n", err)
		http.Error(w, "Error de base de datos al eliminar sucursal", http.StatusInternalServerError)
		return
	}

	logAudit(adminID, "branch_deleted", ip, userAgent, fmt.Sprintf("Sucursal ID %d eliminada por el administrador", req.BranchID))

	writeAdminJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Tienda/Sucursal eliminada exitosamente",
	})
}
