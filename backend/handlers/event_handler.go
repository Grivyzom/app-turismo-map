package handlers

import (
	"backend/database"
	"backend/middleware"
	"backend/models"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type CreateEventRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	StartTime   string  `json:"startTime"` // formato RFC3339 "2026-06-08T10:00:00Z" o similar
	EndTime     string  `json:"endTime"`
	Category    string  `json:"category"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	TargetAudience string  `json:"targetAudience"`
	ImageUrl       string  `json:"imageUrl"`
}

type CreateEventResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	EventID int    `json:"eventId,omitempty"`
}

func CreateEventHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
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
			Message: "ID de usuario inválido en el token",
		})
		return
	}
	userID := int(userIDFloat)

	userType, _ := userClaims["userType"].(string)

	var req CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Cuerpo de solicitud inválido",
		})
		return
	}

	if req.Title == "" || req.Category == "" || req.Latitude == 0 || req.Longitude == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Los campos título, categoría, latitud y longitud son obligatorios",
		})
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

	// Validar que el evento no se programe con más de 14 días de anticipación
	maxAnticipation := time.Now().Add(14 * 24 * time.Hour)
	if start.After(maxAnticipation) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "No se pueden crear eventos con más de 14 días de anticipación",
		})
		return
	}

	// 2. Resolver si es empresa y buscar branch_id
	var emitterType string = "citizen"
	var branchID sql.NullInt64

	if userType == "partner_owner" || userType == "partner_worker" {
		emitterType = "business"
		var companyID int
		err = database.DB.QueryRow("SELECT company_id, branch_id FROM company_members WHERE user_id = $1 LIMIT 1", userID).Scan(&companyID, &branchID)
		if err == nil {
			if !branchID.Valid {
				var bID int
				err = database.DB.QueryRow("SELECT id FROM company_branches WHERE company_id = $1 ORDER BY id ASC LIMIT 1", companyID).Scan(&bID)
				if err == nil {
					branchID.Valid = true
					branchID.Int64 = int64(bID)
				}
			}
		}
	}

	// 3. Insertar el evento
	query := `
		INSERT INTO events (title, description, start_time, end_time, category, geom, emitter_type, user_emitter_id, branch_emitter_id, target_audience, image_url, created_at)
		VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9, $10, $11, $12, NOW())
		RETURNING id
	`

	var eventID int
	target := req.TargetAudience
	if target == "" {
		target = "all"
	}
	
	var branchVal interface{}
	if branchID.Valid {
		branchVal = branchID.Int64
	} else {
		branchVal = nil
	}
	
	err = database.DB.QueryRow(query, req.Title, req.Description, start, end, req.Category, req.Longitude, req.Latitude, emitterType, userID, branchVal, target, req.ImageUrl).Scan(&eventID)

	if err != nil {
		log.Printf("Error al insertar evento en la BD: %v\n", err)
		http.Error(w, "Error al guardar el evento en la base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(CreateEventResponse{
		Success: true,
		Message: "Evento creado exitosamente",
		EventID: eventID,
	})
}
