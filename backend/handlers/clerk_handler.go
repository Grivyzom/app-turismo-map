package handlers

import (
	"backend/database"
	"backend/models"
	"backend/utils"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2/jwt"
	clerkuser "github.com/clerk/clerk-sdk-go/v2/user"
)

// ClerkAuthHandler maneja el flujo de autenticación con Clerk.
// Valida el token de sesión emitido por Clerk, sincroniza la información
// del usuario en la base de datos PostgreSQL y retorna un token JWT interno.
func ClerkAuthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	clerkKey := os.Getenv("CLERK_SECRET_KEY")
	if clerkKey == "" {
		http.Error(w, "Configuración del servidor incompleta (falta CLERK_SECRET_KEY)", http.StatusInternalServerError)
		return
	}

	var req models.ClerkAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	if req.Token == "" {
		http.Error(w, "Token de sesión de Clerk requerido", http.StatusBadRequest)
		return
	}

	// 1. Verificar el JWT de sesión emitido por Clerk
	claims, err := jwt.Verify(r.Context(), &jwt.VerifyParams{
		Token: req.Token,
	})
	if err != nil {
		log.Printf("[Clerk] Token inválido o expirado: %v\n", err)
		http.Error(w, "Token inválido o expirado", http.StatusUnauthorized)
		return
	}

	clerkUserID := claims.Subject
	if clerkUserID == "" {
		http.Error(w, "Token no contiene identificador de usuario Clerk", http.StatusUnauthorized)
		return
	}

	// 2. Obtener detalles del usuario desde Clerk API
	cu, err := clerkuser.Get(r.Context(), clerkUserID)
	if err != nil {
		log.Printf("[Clerk] Error obteniendo usuario %s de Clerk API: %v\n", clerkUserID, err)
		http.Error(w, "Error comunicando con el servicio de autenticación", http.StatusInternalServerError)
		return
	}

	// Extraer email principal
	email := ""
	for _, em := range cu.EmailAddresses {
		if cu.PrimaryEmailAddressID != nil && em.ID == *cu.PrimaryEmailAddressID {
			email = em.EmailAddress
			break
		}
	}
	if email == "" && len(cu.EmailAddresses) > 0 {
		email = cu.EmailAddresses[0].EmailAddress
	}

	if email == "" {
		http.Error(w, "El usuario de Clerk no tiene un correo electrónico configurado", http.StatusBadRequest)
		return
	}

	// Construir nombre
	name := ""
	if cu.FirstName != nil {
		name = *cu.FirstName
	}
	if cu.LastName != nil {
		if name != "" {
			name += " " + *cu.LastName
		} else {
			name = *cu.LastName
		}
	}
	if name == "" && cu.Username != nil {
		name = *cu.Username
	}
	if name == "" {
		name = strings.Split(email, "@")[0]
	}

	picture := ""
	if cu.ImageURL != nil {
		picture = *cu.ImageURL
	}

	userType := req.UserType
	if userType == "" {
		userType = "citizen"
	}

	user := models.User{
		Email:    email,
		Name:     name,
		Picture:  picture,
		UserType: userType,
		ClerkID:  clerkUserID,
		Status:   "active",
	}

	// 3. Sincronizar o crear en la base de datos PostgreSQL
	if database.DB != nil {
		var dbID int
		var dbEmail string
		var dbName, dbPicture, dbUserType, dbClerkID sql.NullString

		err := database.DB.QueryRow(`
			SELECT id, email, name, picture, user_type, clerk_id
			FROM users
			WHERE clerk_id = $1 OR email = $2
			LIMIT 1
		`, clerkUserID, email).Scan(&dbID, &dbEmail, &dbName, &dbPicture, &dbUserType, &dbClerkID)

		if err == sql.ErrNoRows {
			log.Printf("[Clerk] Usuario %s (%s) no existe en la BD. Registrando...\n", email, clerkUserID)
			err = database.DB.QueryRow(`
				INSERT INTO users (email, name, picture, user_type, status, clerk_id)
				VALUES ($1, $2, $3, $4, 'active', $5)
				RETURNING id
			`, email, name, picture, userType, clerkUserID).Scan(&dbID)
			if err != nil {
				log.Printf("[Clerk] Error registrando usuario en la BD: %v\n", err)
				http.Error(w, "Error registrando usuario en base de datos", http.StatusInternalServerError)
				return
			}

			user.ID = dbID
			log.Printf("[Clerk] Usuario %s registrado con ID %d.\n", email, dbID)

			if userType == "citizen" || userType == "tourist" {
				profileType := "local"
				if userType == "tourist" {
					profileType = "tourist"
				}
				_, errProfile := database.DB.Exec(`
					INSERT INTO citizen_profiles (user_id, profile_type, current_view_mode)
					VALUES ($1, $2, $3)
					ON CONFLICT (user_id) DO NOTHING
				`, dbID, profileType, profileType)
				if errProfile != nil {
					log.Printf("[Clerk] Error creating citizen_profile for %s: %v\n", email, errProfile)
				}
			}
		} else if err != nil {
			log.Printf("[Clerk] Error consultando la base de datos: %v\n", err)
			http.Error(w, "Error consultando base de datos", http.StatusInternalServerError)
			return
		} else {
			log.Printf("[Clerk] Usuario %s ya existe en la BD (ID %d). Sincronizando...\n", email, dbID)
			user.ID = dbID
			if dbName.Valid && dbName.String != "" {
				user.Name = dbName.String
			}
			if dbPicture.Valid && dbPicture.String != "" {
				user.Picture = dbPicture.String
			} else if picture != "" {
				database.DB.Exec("UPDATE users SET picture = $1 WHERE id = $2", picture, dbID)
			}
			if dbUserType.Valid && dbUserType.String != "" {
				user.UserType = dbUserType.String
			}
			if !dbClerkID.Valid || dbClerkID.String == "" {
				database.DB.Exec("UPDATE users SET clerk_id = $1 WHERE id = $2", clerkUserID, dbID)
			}
		}
	} else {
		log.Println("[Clerk] Base de datos PostgreSQL no disponible. Omitiendo persistencia.")
	}

	// 4. Generar JWT de la aplicación con claims estandarizados
	token, err := utils.GenerateToken(user)
	if err != nil {
		http.Error(w, "Error generando token de aplicación", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.AuthResponse{
		Success: true,
		Message: "Autenticación exitosa con Clerk",
		User:    user,
		Token:   token,
	})
}
