package handlers

import (
	"backend/database"
	"backend/middleware"
	"backend/models"
	"backend/utils"
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/idtoken"
)

func GoogleAuthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req models.AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	webClientID := os.Getenv("GOOGLE_WEB_CLIENT_ID")
	if webClientID == "" {
		http.Error(w, "Configuración del servidor incompleta (falta GOOGLE_WEB_CLIENT_ID)", http.StatusInternalServerError)
		return
	}

	payload, err := idtoken.Validate(context.Background(), req.IDToken, webClientID)
	if err != nil {
		log.Printf("Token inválido o expirado: %v\n", err)
		http.Error(w, "Token inválido o expirado", http.StatusUnauthorized)
		return
	}

	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	picture, _ := payload.Claims["picture"].(string)

	log.Printf("Usuario autenticado exitosamente: %s (%s)\n", name, email)

	userType := req.UserType
	if userType == "" {
		userType = "citizen"
	}

	user := models.User{
		Email:    email,
		Name:     name,
		Picture:  picture,
		UserType: userType,
	}

	if database.DB != nil {
		var dbID int
		var dbEmail, dbName, dbPicture string
		err := database.DB.QueryRow("SELECT id, email, name, picture, user_type FROM users WHERE email = $1", email).Scan(&dbID, &dbEmail, &dbName, &dbPicture, &user.UserType)
		if err == sql.ErrNoRows {
			log.Printf("Usuario %s no existe en la BD. Registrando...\n", email)
			err = database.DB.QueryRow("INSERT INTO users (email, name, picture, user_type, status) VALUES ($1, $2, $3, $4, 'active') RETURNING id", email, name, picture, userType).Scan(&dbID)
			if err != nil {
				log.Printf("Error registrando usuario en la BD: %v\n", err)
			} else {
				log.Printf("Usuario %s registrado exitosamente en la BD con ID %d.\n", email, dbID)
				user.ID = dbID

				if userType == "citizen" || userType == "tourist" {
					profileType := "local"
					if userType == "tourist" {
						profileType = "tourist"
					}
					_, errProfile := database.DB.Exec("INSERT INTO citizen_profiles (user_id, profile_type, current_view_mode) VALUES ($1, $2, $3)", dbID, profileType, profileType)
					if errProfile != nil {
						log.Printf("Error creating citizen_profile for %s: %v\n", email, errProfile)
					}
				}
			}
		} else if err != nil {
			log.Printf("Error consultando la base de datos: %v\n", err)
		} else {
			log.Printf("Usuario %s ya existe en la BD. Iniciando sesión...\n", email)
			user.ID = dbID
			user.Name = dbName
			user.Picture = dbPicture
			if user.UserType == "" {
				user.UserType = "citizen"
			}
		}
	} else {
		log.Println("Base de datos PostgreSQL no disponible. Omitiendo persistencia.")
	}

	token, err := utils.GenerateToken(user)
	if err != nil {
		http.Error(w, "Error generando token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.AuthResponse{
		Success: true,
		Message: "Autenticación exitosa",
		User:    user,
		Token:   token,
	})
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" || req.Name == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Email, contraseña y nombre son requeridos",
		})
		return
	}

	if req.UserType == "" {
		req.UserType = "ciudadano"
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Error hasheando contraseña: %v\n", err)
		http.Error(w, "Error procesando contraseña", http.StatusInternalServerError)
		return
	}

	status := "active"
	if req.UserType == "partner_owner" {
		status = "pending"
	}

	entityType := req.EntityType
	if entityType == "" {
		entityType = "business"
	}

	var userID int
	var company *models.Company

	if database.DB != nil {
		err := database.DB.QueryRow(
			"INSERT INTO users (email, name, password_hash, user_type, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
			req.Email, req.Name, string(hashedPassword), req.UserType, status,
		).Scan(&userID)
		if err != nil {
			log.Printf("Error registrando usuario en la BD: %v\n", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(models.AuthResponse{
				Success: false,
				Message: "El email ya está registrado",
			})
			return
		}
		log.Printf("Usuario %s registrado exitosamente como %s\n", req.Email, req.UserType)

		if req.UserType == "citizen" || req.UserType == "tourist" {
			profileType := "local"
			if req.UserType == "tourist" {
				profileType = "tourist"
			}
			_, errProfile := database.DB.Exec("INSERT INTO citizen_profiles (user_id, profile_type, current_view_mode) VALUES ($1, $2, $3)", userID, profileType, profileType)
			if errProfile != nil {
				log.Printf("Error creating citizen_profile for %s: %v\n", req.Email, errProfile)
			}

			// Auto-follow all companies of type 'authority'
			_, errFollow := database.DB.Exec(
				"INSERT INTO user_follows (user_id, company_id) SELECT $1, id FROM companies WHERE entity_type = 'authority' ON CONFLICT DO NOTHING",
				userID,
			)
			if errFollow != nil {
				log.Printf("Error auto-following authorities for user %d: %v\n", userID, errFollow)
			}
		}

		if req.UserType == "partner_owner" {
			var companyID int
			businessName := req.BusinessName
			if businessName == "" {
				businessName = req.Name // Fallback for backwards compatibility
			}
			
			err = database.DB.QueryRow(
				"INSERT INTO companies (business_name, entity_type, verification_status, phone) VALUES ($1, $2, 'pending', $3) RETURNING id",
				businessName, entityType, req.Phone,
			).Scan(&companyID)
			
			if err == nil {
				_, err = database.DB.Exec("INSERT INTO company_members (user_id, company_id, role) VALUES ($1, $2, 'owner')", userID, companyID)
				if err != nil {
					log.Printf("Error vinculando owner a company: %v\n", err)
				} else {
					company = &models.Company{
						ID:                 companyID,
						BusinessName:       businessName,
						EntityType:         entityType,
						VerificationStatus: "pending",
						Phone:              req.Phone,
						Role:               "owner",
					}
				}
			} else {
				log.Printf("Error creando company para partner_owner: %v\n", err)
			}
		}
	}

	user := models.User{
		ID:       userID,
		Email:    req.Email,
		Name:     req.Name,
		UserType: req.UserType,
		Status:   status,
		Company:  company,
	}

	token, err := utils.GenerateToken(user)
	if err != nil {
		log.Printf("Error generando token: %v\n", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(models.AuthResponse{
		Success: true,
		Message: "Usuario registrado exitosamente",
		User:    user,
		Token:   token,
	})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if req.Email == "" || req.Password == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Email y contraseña son requeridos",
		})
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	var id int
	var name, userType, passwordHash string
	var picture sql.NullString
	err := database.DB.QueryRow(
		"SELECT id, name, picture, user_type, password_hash FROM users WHERE email = $1",
		req.Email,
	).Scan(&id, &name, &picture, &userType, &passwordHash)

	if err == sql.ErrNoRows {
		middleware.IncrementAuthAttempts(middleware.GetClientIP(r))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Email o contraseña incorrectos",
		})
		return
	} else if err != nil {
		log.Printf("Error consultando usuario: %v\n", err)
		http.Error(w, "Error en la base de datos", http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		middleware.IncrementAuthAttempts(middleware.GetClientIP(r))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Email o contraseña incorrectos",
		})
		return
	}

	log.Printf("Usuario %s inició sesión correctamente\n", req.Email)
	middleware.ResetAuthAttempts(middleware.GetClientIP(r))

	pictureValue := ""
	if picture.Valid {
		pictureValue = picture.String
	}

	var company *models.Company
	// Buscamos si el usuario pertenece a una compañía.
	// Si encontramos una membresía, el usuario tiene acceso al portal de empresas.
	var cID int
	var bName, eType, vStatus string
	var role string
	var phone sql.NullString

	errCompany := database.DB.QueryRow(`
		SELECT c.id, c.business_name, c.entity_type, c.verification_status, c.phone, cm.role
		FROM companies c
		JOIN company_members cm ON c.id = cm.company_id
		WHERE cm.user_id = $1 LIMIT 1
	`, id).Scan(&cID, &bName, &eType, &vStatus, &phone, &role)

	if errCompany == nil {
		phoneValue := ""
		if phone.Valid {
			phoneValue = phone.String
		}
		company = &models.Company{
			ID:                 cID,
			BusinessName:       bName,
			EntityType:         eType,
			VerificationStatus: vStatus,
			Phone:              phoneValue,
			Role:               role,
		}
		// Si tiene compañía pero su tipo base es ciudadano, lo tratamos como partner_worker
		// para que el frontend y los tokens reflejen su rol empresarial.
		if userType == "citizen" || userType == "" {
			userType = "partner_worker"
		}
	}

	user := models.User{
		ID:       id,
		Email:    req.Email,
		Name:     name,
		Picture:  pictureValue,
		UserType: userType,
		Company:  company,
	}

	token, err := utils.GenerateToken(user)
	if err != nil {
		http.Error(w, "Error generando token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.AuthResponse{
		Success: true,
		Message: "Login exitoso",
		User:    user,
		Token:   token,
	})
}
