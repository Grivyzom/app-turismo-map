package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"github.com/rs/cors"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/idtoken"
)

var rdb *redis.Client
var db *sql.DB
var ctx = context.Background()

type User struct {
	ID       int    `json:"id,omitempty"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Picture  string `json:"picture,omitempty"`
	UserType string `json:"userType,omitempty"` // "citizen", "partner_owner", "partner_worker"
	Status   string `json:"status,omitempty"`   // "active", "pending"
}

type RegisterRequest struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	Name       string `json:"name"`
	UserType   string `json:"userType"`   // "citizen", "partner_owner"
	EntityType string `json:"entityType"` // "business", "media", "creator"
	Phone      string `json:"phone"`      // Teléfono de contacto
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthRequest struct {
	IDToken string `json:"idToken"`
}

type AuthResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	User    User   `json:"user"`
	Token   string `json:"token,omitempty"`
}

func googleAuthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	webClientID := os.Getenv("GOOGLE_WEB_CLIENT_ID")
	if webClientID == "" {
		http.Error(w, "Configuración del servidor incompleta (falta GOOGLE_WEB_CLIENT_ID)", http.StatusInternalServerError)
		return
	}

	// Valida el token digitalmente usando las llaves públicas de Google
	payload, err := idtoken.Validate(context.Background(), req.IDToken, webClientID)
	if err != nil {
		log.Printf("Token inválido o expirado: %v\n", err)
		http.Error(w, "Token inválido o expirado", http.StatusUnauthorized)
		return
	}

	// Extraer la información validada del perfil de Google
	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	picture, _ := payload.Claims["picture"].(string)

	log.Printf("Usuario autenticado exitosamente: %s (%s)\n", name, email)

	user := User{
		Email:   email,
		Name:    name,
		Picture: picture,
	}

	// Persistencia en la base de datos PostgreSQL
	if db != nil {
		var dbEmail, dbName, dbPicture string
		// 1. Buscar si el usuario existe (email).
		err := db.QueryRow("SELECT email, name, picture FROM users WHERE email = $1", email).Scan(&dbEmail, &dbName, &dbPicture)
		if err == sql.ErrNoRows {
			// 2. Si no existe, insertarlo (Registro).
			log.Printf("Usuario %s no existe en la BD. Registrando...\n", email)
			_, err = db.Exec("INSERT INTO users (email, name, picture) VALUES ($1, $2, $3)", email, name, picture)
			if err != nil {
				log.Printf("Error registrando usuario en la BD: %v\n", err)
			} else {
				log.Printf("Usuario %s registrado exitosamente en la BD.\n", email)
			}
		} else if err != nil {
			log.Printf("Error consultando la base de datos: %v\n", err)
		} else {
			log.Printf("Usuario %s ya existe en la BD. Iniciando sesión...\n", email)
			// Actualizamos el objeto user con los datos reales guardados en la BD
			user.Name = dbName
			user.Picture = dbPicture
		}
	} else {
		log.Println("Base de datos PostgreSQL no disponible. Omitiendo persistencia.")
	}

	// Respondemos al frontend con los datos.
	// En una app real, aquí enviarías tu JWT generado en lugar de "token-de-sesion-ficticio".
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		Success: true,
		Message: "Autenticación exitosa",
		User:    user,
		Token:   "token-de-sesion-ficticio",
	})
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	// Validar campos obligatorios
	if req.Email == "" || req.Password == "" || req.Name == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(AuthResponse{
			Success: false,
			Message: "Email, contraseña y nombre son requeridos",
		})
		return
	}

	if req.UserType == "" {
		req.UserType = "ciudadano" // Por defecto
	}

	// Hash de la contraseña
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
		entityType = "business" // Por defecto
	}

	// Persistencia en la base de datos PostgreSQL
	if db != nil {
		var userID int
		err := db.QueryRow(
			"INSERT INTO users (email, name, password_hash, user_type, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
			req.Email, req.Name, string(hashedPassword), req.UserType, status,
		).Scan(&userID)
		if err != nil {
			log.Printf("Error registrando usuario en la BD: %v\n", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(AuthResponse{
				Success: false,
				Message: "El email ya está registrado",
			})
			return
		}
		log.Printf("Usuario %s registrado exitosamente como %s\n", req.Email, req.UserType)

		// Si es dueño/creador, instanciar su empresa/marca personal
		if req.UserType == "partner_owner" {
			var companyID int
			err = db.QueryRow(
				"INSERT INTO companies (business_name, entity_type, verification_status, phone) VALUES ($1, $2, 'pending', $3) RETURNING id",
				req.Name, entityType, req.Phone,
			).Scan(&companyID)
			if err == nil {
				_, err = db.Exec("INSERT INTO company_members (user_id, company_id, role) VALUES ($1, $2, 'owner')", userID, companyID)
				if err != nil {
					log.Printf("Error vinculando owner a company: %v\n", err)
				}
			} else {
				log.Printf("Error creando company para partner_owner: %v\n", err)
			}
		}
	}

	user := User{
		Email:    req.Email,
		Name:     req.Name,
		UserType: req.UserType,
		Status:   status,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(AuthResponse{
		Success: true,
		Message: "Usuario registrado exitosamente",
		User:    user,
		Token:   "token-de-sesion-ficticio",
	})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(AuthResponse{
			Success: false,
			Message: "Email y contraseña son requeridos",
		})
		return
	}

	if db == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// Buscar usuario por email
	var id int
	var name, userType, passwordHash string
	var picture sql.NullString // Usar NullString para campos que pueden ser NULL
	err := db.QueryRow(
		"SELECT id, name, picture, user_type, password_hash FROM users WHERE email = $1",
		req.Email,
	).Scan(&id, &name, &picture, &userType, &passwordHash)

	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(AuthResponse{
			Success: false,
			Message: "Email o contraseña incorrectos",
		})
		return
	} else if err != nil {
		log.Printf("Error consultando usuario: %v\n", err)
		http.Error(w, "Error en la base de datos", http.StatusInternalServerError)
		return
	}

	// Validar contraseña
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(AuthResponse{
			Success: false,
			Message: "Email o contraseña incorrectos",
		})
		return
	}

	log.Printf("Usuario %s inició sesión correctamente\n", req.Email)

	// Convertir NullString a string normal
	pictureValue := ""
	if picture.Valid {
		pictureValue = picture.String
	}

	user := User{
		ID:       id,
		Email:    req.Email,
		Name:     name,
		Picture:  pictureValue,
		UserType: userType,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		Success: true,
		Message: "Login exitoso",
		User:    user,
		Token:   "token-de-sesion-ficticio",
	})
}

func initDB() {
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}
	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}
	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "app-turismo"
	}
	dbSSLMode := os.Getenv("DB_SSLMODE")
	if dbSSLMode == "" {
		dbSSLMode = "disable"
	}

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dbHost, dbPort, dbUser, dbPassword, dbName, dbSSLMode)

	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("Error configurando la conexión a PostgreSQL: %v\n", err)
		return
	}

	// Verificar conexión con Ping
	if err = db.Ping(); err != nil {
		log.Printf("ADVERTENCIA: No se pudo conectar a la base de datos PostgreSQL en %s:%s (¿Contraseña incorrecta o puerto cerrado?): %v\n", dbHost, dbPort, err)
		log.Println("La aplicación continuará corriendo pero las funciones de base de datos fallarán hasta que se configure correctamente.")
		return
	}

	log.Println("Conexión exitosa a la base de datos PostgreSQL")

	// Habilitar PostGIS para consultas geoespaciales veloces
	if _, err := db.Exec("CREATE EXTENSION IF NOT EXISTS postgis;"); err != nil {
		log.Printf("Aviso: No se pudo crear la extensión PostGIS (puede que ya exista o falten permisos): %v\n", err)
	}

	// Crear las tablas del sistema de perfiles y entidades
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			picture TEXT,
			password_hash VARCHAR(255),
			user_type VARCHAR(50) DEFAULT 'citizen',
			status VARCHAR(20) DEFAULT 'active',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS citizen_profiles (
			user_id INT PRIMARY KEY REFERENCES users(id),
			phone VARCHAR(50),
			country VARCHAR(100),
			preferences JSONB
		);`,
		`CREATE TABLE IF NOT EXISTS companies (
			id SERIAL PRIMARY KEY,
			business_name VARCHAR(255) NOT NULL,
			entity_type VARCHAR(50) DEFAULT 'business',
			category VARCHAR(100),
			is_verified_badge BOOLEAN DEFAULT false,
			tax_id VARCHAR(50),
			verification_status VARCHAR(50) DEFAULT 'pending',
			phone VARCHAR(50),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS company_branches (
			id SERIAL PRIMARY KEY,
			company_id INT REFERENCES companies(id),
			branch_name VARCHAR(255),
			description TEXT,
			category VARCHAR(100),
			address VARCHAR(255),
			phone VARCHAR(50),
			geom GEOGRAPHY(Point, 4326),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS company_members (
			user_id INT REFERENCES users(id),
			company_id INT REFERENCES companies(id),
			branch_id INT REFERENCES company_branches(id),
			role VARCHAR(50) DEFAULT 'worker',
			PRIMARY KEY (user_id, company_id)
		);`,
		`CREATE TABLE IF NOT EXISTS invitations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			company_id INT REFERENCES companies(id),
			email VARCHAR(255) NOT NULL,
			token_hash VARCHAR(255) NOT NULL,
			status VARCHAR(50) DEFAULT 'pending',
			expires_at TIMESTAMP NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS events (
			id SERIAL PRIMARY KEY,
			title VARCHAR(255),
			description TEXT,
			start_time TIMESTAMP,
			end_time TIMESTAMP,
			category VARCHAR(100),
			geom GEOGRAPHY(Point, 4326),
			emitter_type VARCHAR(50),
			user_emitter_id INT,
			branch_emitter_id INT,
			created_at TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS map_reports (
			id SERIAL PRIMARY KEY,
			user_id INT,
			report_type VARCHAR(50),
			description TEXT,
			geom GEOGRAPHY(Point, 4326),
			upvotes INT,
			expires_at TIMESTAMP,
			created_at TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS company_branches_geom_idx ON company_branches USING GIST (geom);`,
		`CREATE INDEX IF NOT EXISTS events_geom_idx ON events USING GIST (geom);`,
		`CREATE INDEX IF NOT EXISTS map_reports_geom_idx ON map_reports USING GIST (geom);`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			log.Fatalf("Error creando tablas: %v\nQuery: %s", err, query)
		}
	}
	log.Println("Estructura de Base de Datos y Entidades verificada/creada exitosamente en PostgreSQL")
}

func main() {
	// Carga las variables del archivo .env si existe
	if err := godotenv.Load(); err != nil {
		log.Println("Aviso: No se encontró archivo .env (se usarán variables del sistema)")
	}

	// Inicializar PostgreSQL
	initDB()

	// Configuración de Redis
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	rdb = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: "", // sin contraseña por defecto
		DB:       0,  // base de datos por defecto
	})

	// Verificar conexión con Redis
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("Aviso: No se pudo conectar a Redis en %s: %v", redisAddr, err)
	} else {
		log.Printf("Conexión exitosa a Redis en %s", redisAddr)
	}

	mux := http.NewServeMux()

	// Rutas de autenticación
	mux.HandleFunc("/auth/google", googleAuthHandler)
	mux.HandleFunc("/auth/register", registerHandler)
	mux.HandleFunc("/auth/login", loginHandler)

	// Rutas de eventos
	mux.HandleFunc("/api/v1/events/checkin", checkinHandler)

	// Rutas de lugares (Places)
	mux.HandleFunc("/api/v1/places/search", placesSearchHandler)

	// Ruta de prueba
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "¡Backend Go de Turismo funcionando!")
	})

	// Configurar CORS para permitir que tu frontend consulte a esta API sin bloqueos
	handler := cors.Default().Handler(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Puerto por defecto
	}

	log.Printf("Servidor backend corriendo en http://localhost:%s\n", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Error iniciando el servidor: %v", err)
	}
}
