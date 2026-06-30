package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client
var DB *sql.DB
var Ctx = context.Background()

func InitDB() {
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
		dbUser = "turismo_user"
	}
	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "grivyzom@100110"
	}
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
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("Error configurando la conexión a PostgreSQL: %v\n", err)
		return
	}

	if err = DB.Ping(); err != nil {
		log.Printf("ADVERTENCIA: No se pudo conectar a PostgreSQL en %s:%s: %v\n", dbHost, dbPort, err)
		log.Println("La aplicación continuará corriendo pero las funciones de BD fallarán.")
		return
	}

	log.Println("Conexión exitosa a la base de datos PostgreSQL")

	if _, err := DB.Exec("CREATE EXTENSION IF NOT EXISTS postgis;"); err != nil {
		log.Printf("Aviso: No se pudo crear la extensión PostGIS: %v\n", err)
	}

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
			preferences JSONB,
			profile_type VARCHAR(50) DEFAULT 'local' CHECK (profile_type IN ('local', 'tourist')),
			current_view_mode VARCHAR(50) DEFAULT 'local' CHECK (current_view_mode IN ('local', 'tourist'))
		);`,
		`CREATE TABLE IF NOT EXISTS companies (
			id SERIAL PRIMARY KEY,
			business_name VARCHAR(255) NOT NULL,
			entity_type VARCHAR(50) DEFAULT 'business' CHECK (entity_type IN ('business', 'independent', 'authority', 'independiente', 'pymes', 'empresas')),
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
			image_url TEXT,
			target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('local', 'tourist', 'all')),
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
			target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('local', 'tourist', 'all')),
			image_url TEXT,
			created_at TIMESTAMP
		);`,
		`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;`,
		`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;`,
		`CREATE TABLE IF NOT EXISTS fauna_types (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) UNIQUE NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`INSERT INTO fauna_types (name) VALUES ('Lobo Marino'), ('Pudú'), ('Cisne de Cuello Negro') ON CONFLICT DO NOTHING;`,
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
		`CREATE TABLE IF NOT EXISTS products (
			id SERIAL PRIMARY KEY,
			branch_id INT NOT NULL REFERENCES company_branches(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			price NUMERIC(10, 2) NOT NULL,
			image_url TEXT NOT NULL DEFAULT '',
			category VARCHAR(100) NOT NULL DEFAULT '',
			is_available BOOLEAN NOT NULL DEFAULT true,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS promotions (
			id SERIAL PRIMARY KEY,
			branch_id INT NOT NULL REFERENCES company_branches(id) ON DELETE CASCADE,
			title VARCHAR(255) NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			end_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			is_active BOOLEAN NOT NULL DEFAULT true,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS company_branches_geom_idx ON company_branches USING GIST (geom);`,
		`CREATE INDEX IF NOT EXISTS events_geom_idx ON events USING GIST (geom);`,
		`CREATE INDEX IF NOT EXISTS map_reports_geom_idx ON map_reports USING GIST (geom);`,
		`CREATE INDEX IF NOT EXISTS products_branch_id_idx ON products (branch_id);`,
		`CREATE INDEX IF NOT EXISTS promotions_branch_id_idx ON promotions (branch_id);`,
		`CREATE INDEX IF NOT EXISTS promotions_is_active_idx ON promotions (is_active);`,
		`CREATE INDEX IF NOT EXISTS idx_citizen_view_mode ON citizen_profiles (current_view_mode);`,
		`CREATE INDEX IF NOT EXISTS idx_events_audience ON events (target_audience);`,
		`CREATE INDEX IF NOT EXISTS idx_branches_audience ON company_branches (target_audience);`,
		`CREATE INDEX IF NOT EXISTS idx_routes_audience ON routes (target_audience);`,

		// ── Tablas del Sistema de Administración ──────────────────────────
		`CREATE TABLE IF NOT EXISTS admin_users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			role VARCHAR(50) NOT NULL DEFAULT 'admin',
			status VARCHAR(20) NOT NULL DEFAULT 'pending_2fa',
			totp_secret VARCHAR(255),
			totp_ready BOOLEAN DEFAULT false,
			failed_attempts INT DEFAULT 0,
			locked_until TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS admin_audit_log (
			id SERIAL PRIMARY KEY,
			admin_id INT REFERENCES admin_users(id),
			action VARCHAR(100) NOT NULL,
			ip_address VARCHAR(45) NOT NULL,
			user_agent TEXT,
			details TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx ON admin_audit_log (admin_id);`,
		`CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON admin_audit_log (action);`,
		`CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);`,

		// ── Tablas para Sistema de Colecciones y Guardado ──────────────────────────
		`CREATE TABLE IF NOT EXISTS collections (
			id SERIAL PRIMARY KEY,
			user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			visibility VARCHAR(50) DEFAULT 'private',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS saved_locations (
			id SERIAL PRIMARY KEY,
			collection_id INT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
			location_type VARCHAR(50) NOT NULL,
			ref_id VARCHAR(100),
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			title VARCHAR(255),
			notes TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS collections_user_id_idx ON collections (user_id);`,
		`CREATE INDEX IF NOT EXISTS saved_locations_collection_id_idx ON saved_locations (collection_id);`,

		// ── Tablas para Delimitación de Zonas (Polígonos) ──────────────────────────
		`CREATE TABLE IF NOT EXISTS zones (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			category VARCHAR(100) DEFAULT 'Sector',
			color VARCHAR(50) DEFAULT '#10B981',
			geom GEOGRAPHY(MULTIPOLYGON, 4326),
			is_active BOOLEAN DEFAULT true,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS zones_geom_idx ON zones USING GIST (geom);`,
		`ALTER TABLE zones ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`,
		`ALTER TABLE zones ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1);`,
		`ALTER TABLE zones ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';`,
		`ALTER TABLE zones ADD COLUMN IF NOT EXISTS opening_hours VARCHAR(255);`,
		`ALTER TABLE zones ADD COLUMN IF NOT EXISTS park_type VARCHAR(100);`,

		// ── Tablas para Sistema de Rutas (Geo-Router) ──────────────────────────
		`CREATE TABLE IF NOT EXISTS routes (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			route_type VARCHAR(50) NOT NULL, -- 'direct', 'single_target', 'multi_target'
			category VARCHAR(50) DEFAULT 'turistica', -- 'cervecera', 'reto', 'turistica', 'exploracion'
			business_id INT NOT NULL, -- Attribution to the business that created it
			target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('local', 'tourist', 'all')),
			is_featured BOOLEAN DEFAULT false, -- Expert feature: highlighted routes
			rating_avg DECIMAL(3,2) DEFAULT 0.0, -- Expert feature: user ratings
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS route_points (
			id SERIAL PRIMARY KEY,
			route_id INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			order_index INT NOT NULL,
			point_type VARCHAR(50) NOT NULL, -- 'origin', 'destination', 'target', 'waypoint'
			name VARCHAR(255),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS route_points_route_id_idx ON route_points (route_id);`,

		// ── Tabla para Calificaciones de Rutas (Rating System) ────────────────
		`CREATE TABLE IF NOT EXISTS route_ratings (
			id SERIAL PRIMARY KEY,
			route_id INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
			user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
			comment TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(route_id, user_id) -- Un voto por usuario por ruta
		);`,

		// ── Tabla de Seguidores ("Follows") ──────────────────────────────────
		`CREATE TABLE IF NOT EXISTS user_follows (
			user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, company_id)
		);`,
		`CREATE INDEX IF NOT EXISTS idx_user_follows_company ON user_follows (company_id);`,

		// ── Tabla de Seguimiento entre Ciudadanos ─────────────────────────────
		`CREATE TABLE IF NOT EXISTS user_user_follows (
			follower_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			followed_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (follower_id, followed_id)
		);`,
		`CREATE INDEX IF NOT EXISTS idx_uuf_followed ON user_user_follows (followed_id);`,

		// ── Bio en perfil de ciudadano ────────────────────────────────────────
		`ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';`,

		// Asegurar restricciones de tipo de entidad en base de datos existente
		`ALTER TABLE companies DROP CONSTRAINT IF EXISTS chk_entity_type;`,
		`ALTER TABLE companies ADD CONSTRAINT chk_entity_type CHECK (entity_type IN ('business', 'independent', 'authority', 'independiente', 'pymes', 'empresas'));`,

		// Función y Trigger para limitar anticipación de creación de eventos (máximo 14 días)
		`CREATE OR REPLACE FUNCTION check_event_start_time()
		RETURNS TRIGGER AS $$
		BEGIN
			IF NEW.start_time > (CURRENT_TIMESTAMP + INTERVAL '14 days') THEN
				RAISE EXCEPTION 'No se pueden crear eventos con más de 14 días de anticipación.';
			END IF;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;`,
		`DROP TRIGGER IF EXISTS trg_check_event_start_time ON events;`,
		`CREATE TRIGGER trg_check_event_start_time
		BEFORE INSERT OR UPDATE ON events
		FOR EACH ROW
		EXECUTE FUNCTION check_event_start_time();`,

		// ── Tablas para Ciclovías ────────────────────────────────────────────────
		`CREATE TABLE IF NOT EXISTS cycleways (
			id VARCHAR(50) PRIMARY KEY,
			eje VARCHAR(255) NOT NULL,
			inicio VARCHAR(255) NOT NULL DEFAULT '',
			fin VARCHAR(255) NOT NULL DEFAULT '',
			km NUMERIC(10, 2) NOT NULL DEFAULT 0,
			coordinates JSONB NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,

		// ── Columnas de Zonas en company_branches y events ──
		`ALTER TABLE company_branches ADD COLUMN IF NOT EXISTS zone_id INT REFERENCES zones(id) ON DELETE SET NULL;`,
		`ALTER TABLE company_branches ADD COLUMN IF NOT EXISTS containing_zone_ids INT[] DEFAULT '{}';`,
		`ALTER TABLE events ADD COLUMN IF NOT EXISTS containing_zone_ids INT[] DEFAULT '{}';`,

		// ── Índices para las nuevas columnas ──
		`CREATE INDEX IF NOT EXISTS company_branches_containing_zones_idx ON company_branches USING GIN (containing_zone_ids);`,
		`CREATE INDEX IF NOT EXISTS events_containing_zones_idx ON events USING GIN (containing_zone_ids);`,
		`CREATE INDEX IF NOT EXISTS idx_company_branches_zone_id ON company_branches (zone_id);`,
		`CREATE INDEX IF NOT EXISTS idx_events_zone_id ON events (zone_id);`,

		// ── Función de asignación automática de zonas (para inserts/updates de puntos) ──
		`CREATE OR REPLACE FUNCTION fn_automatic_zone_assignment()
		RETURNS TRIGGER AS $$
		BEGIN
			-- Buscar todas las zonas que contienen el punto
			NEW.containing_zone_ids := ARRAY(
				SELECT id
				FROM public.zones z
				WHERE ST_Intersects(NEW.geom, z.geom)
			);
			
			-- Asignar el primer zone_id si hay alguno
			IF array_length(NEW.containing_zone_ids, 1) > 0 THEN
				NEW.zone_id := NEW.containing_zone_ids[1];
			ELSE
				NEW.zone_id := NULL;
			END IF;
			
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;`,

		// ── Triggers para company_branches y events ──
		`DROP TRIGGER IF EXISTS trg_assign_zone_branches ON company_branches;`,
		`CREATE TRIGGER trg_assign_zone_branches
		BEFORE INSERT OR UPDATE OF geom ON company_branches
		FOR EACH ROW
		EXECUTE FUNCTION fn_automatic_zone_assignment();`,

		`DROP TRIGGER IF EXISTS trg_assign_zone_events ON events;`,
		`CREATE TRIGGER trg_assign_zone_events
		BEFORE INSERT OR UPDATE OF geom ON events
		FOR EACH ROW
		EXECUTE FUNCTION fn_automatic_zone_assignment();`,

		// ── Función y Trigger para recalcular todo si cambian las zonas (geometría o al borrar/crear) ──
		`CREATE OR REPLACE FUNCTION fn_recalculate_all_zones()
		RETURNS TRIGGER AS $$
		BEGIN
			-- Recalcular para todos los company_branches
			UPDATE public.company_branches
			SET containing_zone_ids = ARRAY(
				SELECT id
				FROM public.zones z
				WHERE ST_Intersects(company_branches.geom, z.geom)
			);
			
			UPDATE public.company_branches
			SET zone_id = CASE 
				WHEN array_length(containing_zone_ids, 1) > 0 THEN containing_zone_ids[1]
				ELSE NULL
			END;

			-- Recalcular para todos los eventos
			UPDATE public.events
			SET containing_zone_ids = ARRAY(
				SELECT id
				FROM public.zones z
				WHERE ST_Intersects(events.geom, z.geom)
			);
			
			UPDATE public.events
			SET zone_id = CASE 
				WHEN array_length(containing_zone_ids, 1) > 0 THEN containing_zone_ids[1]
				ELSE NULL
			END;

			RETURN NULL;
		END;
		$$ LANGUAGE plpgsql;`,

		`DROP TRIGGER IF EXISTS trg_recalculate_zones ON zones;`,
		`CREATE TRIGGER trg_recalculate_zones
		AFTER INSERT OR UPDATE OF geom OR DELETE ON zones
		FOR EACH ROW
		EXECUTE FUNCTION fn_recalculate_all_zones();`,

		// ── Inicializar/Recalcular datos existentes ──
		`UPDATE public.company_branches
		SET containing_zone_ids = ARRAY(
			SELECT id
			FROM public.zones z
			WHERE ST_Intersects(company_branches.geom, z.geom)
		)
		WHERE containing_zone_ids IS NULL OR containing_zone_ids = '{}';`,

		`UPDATE public.company_branches
		SET zone_id = containing_zone_ids[1]
		WHERE zone_id IS NULL AND array_length(containing_zone_ids, 1) > 0;`,

		`UPDATE public.events
		SET containing_zone_ids = ARRAY(
			SELECT id
			FROM public.zones z
			WHERE ST_Intersects(events.geom, z.geom)
		)
		WHERE containing_zone_ids IS NULL OR containing_zone_ids = '{}';`,

		`UPDATE public.events
		SET zone_id = containing_zone_ids[1]
		WHERE zone_id IS NULL AND array_length(containing_zone_ids, 1) > 0;`,

		// ── Tabla de Lugares Externos (Google Places cache) ─────────────────
		`CREATE TABLE IF NOT EXISTS external_places (
			id SERIAL PRIMARY KEY,
			google_place_id VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			category VARCHAR(100) NOT NULL DEFAULT 'gastronomia',
			address TEXT,
			phone VARCHAR(50),
			rating DECIMAL(3,1),
			lat DOUBLE PRECISION NOT NULL,
			lng DOUBLE PRECISION NOT NULL,
			geom GEOGRAPHY(Point, 4326),
			image_url TEXT,
			containing_zone_ids INT[] DEFAULT '{}',
			zone_id INT REFERENCES zones(id) ON DELETE SET NULL,
			synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			target_audience VARCHAR(50) DEFAULT 'all'
		);`,
		`CREATE INDEX IF NOT EXISTS external_places_geom_idx ON external_places USING GIST (geom);`,
		`CREATE INDEX IF NOT EXISTS external_places_google_id_idx ON external_places (google_place_id);`,
		`CREATE INDEX IF NOT EXISTS external_places_containing_zones_idx ON external_places USING GIN (containing_zone_ids);`,
		`DROP TRIGGER IF EXISTS trg_assign_zone_external_places ON external_places;`,
		`CREATE TRIGGER trg_assign_zone_external_places
		BEFORE INSERT OR UPDATE OF geom ON external_places
		FOR EACH ROW
		EXECUTE FUNCTION fn_automatic_zone_assignment();`,

		// Extender fn_recalculate_all_zones para incluir external_places
		`CREATE OR REPLACE FUNCTION fn_recalculate_all_zones()
		RETURNS TRIGGER AS $$
		BEGIN
			UPDATE public.company_branches
			SET containing_zone_ids = ARRAY(SELECT id FROM public.zones z WHERE ST_Intersects(company_branches.geom, z.geom));
			UPDATE public.company_branches
			SET zone_id = CASE WHEN array_length(containing_zone_ids, 1) > 0 THEN containing_zone_ids[1] ELSE NULL END;
			UPDATE public.events
			SET containing_zone_ids = ARRAY(SELECT id FROM public.zones z WHERE ST_Intersects(events.geom, z.geom));
			UPDATE public.events
			SET zone_id = CASE WHEN array_length(containing_zone_ids, 1) > 0 THEN containing_zone_ids[1] ELSE NULL END;
			UPDATE public.external_places
			SET containing_zone_ids = ARRAY(SELECT id FROM public.zones z WHERE ST_Intersects(external_places.geom, z.geom));
			UPDATE public.external_places
			SET zone_id = CASE WHEN array_length(containing_zone_ids, 1) > 0 THEN containing_zone_ids[1] ELSE NULL END;
			RETURN NULL;
		END;
		$$ LANGUAGE plpgsql;`,
	}

	for _, query := range queries {
		if _, err := DB.Exec(query); err != nil {
			log.Fatalf("Error creando tablas: %v\nQuery: %s", err, query)
		}
	}
	log.Println("Estructura de Base de Datos y Entidades verificada/creada exitosamente en PostgreSQL")

	if err := os.MkdirAll("uploads/avatars", 0755); err != nil {
		log.Printf("Aviso: No se pudo crear directorio de avatares: %v", err)
	}

	SeedCycleways()
}

func InitRedis() {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	RDB = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: "", // sin contraseña por defecto
		DB:       0,  // base de datos por defecto
	})

	if err := RDB.Ping(Ctx).Err(); err != nil {
		log.Printf("Aviso: No se pudo conectar a Redis en %s: %v", redisAddr, err)
	} else {
		log.Printf("Conexión exitosa a Redis en %s", redisAddr)
	}
}

func SeedCycleways() {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM cycleways").Scan(&count)
	if err != nil {
		log.Printf("Error checking cycleways count: %v", err)
		return
	}

	if count > 0 {
		return
	}

	log.Println("Seeding cycleways database from json seed file...")

	seedPath := "database/ciclovias_seed.json"
	if _, err := os.Stat(seedPath); os.IsNotExist(err) {
		seedPath = "backend/database/ciclovias_seed.json"
	}

	data, err := os.ReadFile(seedPath)
	if err != nil {
		log.Printf("Error reading cycleways seed file: %v", err)
		return
	}

	type SeedItem struct {
		ID          string          `json:"id"`
		Eje         string          `json:"eje"`
		Inicio      string          `json:"inicio"`
		Fin         string          `json:"fin"`
		KM          float64         `json:"km"`
		Coordinates json.RawMessage `json:"coordinates"`
	}

	var items []SeedItem
	if err := json.Unmarshal(data, &items); err != nil {
		log.Printf("Error unmarshaling cycleways seed data: %v", err)
		return
	}

	tx, err := DB.Begin()
	if err != nil {
		log.Printf("Error beginning seed transaction: %v", err)
		return
	}

	stmt, err := tx.Prepare("INSERT INTO cycleways (id, eje, inicio, fin, km, coordinates) VALUES ($1, $2, $3, $4, $5, $6)")
	if err != nil {
		log.Printf("Error preparing seed statement: %v", err)
		tx.Rollback()
		return
	}
	defer stmt.Close()

	for _, item := range items {
		_, err = stmt.Exec(item.ID, item.Eje, item.Inicio, item.Fin, item.KM, string(item.Coordinates))
		if err != nil {
			log.Printf("Error seeding item %s: %v", item.ID, err)
			tx.Rollback()
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing seed transaction: %v", err)
		return
	}

	log.Printf("Successfully seeded %d cycleways into database.", len(items))
}
