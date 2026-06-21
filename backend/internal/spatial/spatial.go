package spatial

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"time"

	"backend/internal/database"
)

// Point representa un punto geográfico con latitud y longitud.
// Implementa la interfaz sql.Scanner para mapear tipos espaciales de PostGIS.
type Point struct {
	Lat float64 `json:"latitude"`
	Lng float64 `json:"longitude"`
}

// Scan decodifica la representación EWKB (Extended Well-Known Binary)
// o WKB (Well-Known Binary) de PostGIS obtenida desde el driver de la base de datos.
func (p *Point) Scan(val interface{}) error {
	if val == nil {
		return nil
	}

	var data []byte
	switch v := val.(type) {
	case []byte:
		data = v
	case string:
		// En algunos entornos, el driver puede entregar los datos en formato hexadecimal.
		var err error
		data, err = hex.DecodeString(v)
		if err != nil {
			data = []byte(v)
		}
	default:
		return fmt.Errorf("tipo de dato no soportado para escanear Point: %T", val)
	}

	if len(data) < 21 {
		return fmt.Errorf("datos WKB inválidos: longitud menor a 21 bytes")
	}

	// El primer byte define el orden de lectura (Endianness)
	byteOrder := data[0]
	var order binary.ByteOrder
	if byteOrder == 1 {
		order = binary.LittleEndian
	} else if byteOrder == 0 {
		order = binary.BigEndian
	} else {
		return fmt.Errorf("orden de bytes inválido en WKB: %d", byteOrder)
	}

	// Leer el tipo de geometría (4 bytes)
	geomType := order.Uint32(data[1:5])

	// Constantes de PostGIS para Point y EWKB con flag de SRID
	const (
		wkbPoint  = 1
		ewkbPoint = 0x20000001
	)

	var offset int
	if geomType == wkbPoint {
		offset = 5
	} else if geomType == ewkbPoint || (geomType&0x20000000) != 0 {
		// EWKB incluye 4 bytes adicionales correspondientes al SRID (e.g. 4326)
		if len(data) < 25 {
			return fmt.Errorf("datos EWKB insuficientes para decodificar SRID")
		}
		offset = 9
	} else {
		return fmt.Errorf("geometría WKB no soportada: tipo %d", geomType)
	}

	if len(data) < offset+16 {
		return fmt.Errorf("datos WKB incompletos para coordenadas X e Y")
	}

	// En PostGIS, el eje X representa la Longitud y el eje Y representa la Latitud
	lngBits := order.Uint64(data[offset : offset+8])
	latBits := order.Uint64(data[offset+8 : offset+16])

	p.Lng = math.Float64frombits(lngBits)
	p.Lat = math.Float64frombits(latBits)

	return nil
}

// BranchResult representa una sucursal encontrada dentro del radio de búsqueda.
type BranchResult struct {
	ID          int    `json:"id"`
	CompanyID   int    `json:"company_id"`
	BranchName  string `json:"branch_name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Address     string `json:"address"`
	Phone       string `json:"phone"`
	Geom        Point  `json:"geom"`
}

// EventResult representa un evento encontrado dentro del radio de búsqueda.
type EventResult struct {
	ID              int        `json:"id"`
	Title           string     `json:"title"`
	Description     string     `json:"description"`
	StartTime       *time.Time `json:"start_time"`
	EndTime         *time.Time `json:"end_time"`
	Category        string     `json:"category"`
	EmitterType     string     `json:"emitter_type"`
	UserEmitterID   *int       `json:"user_emitter_id,omitempty"`
	BranchEmitterID *int       `json:"branch_emitter_id,omitempty"`
	CreatedAt       *time.Time `json:"created_at"`
	Geom            Point      `json:"geom"`
}

// NearbyResponse representa la respuesta JSON devuelta al cliente.
type NearbyResponse struct {
	Branches []BranchResult `json:"branches"`
	Events   []EventResult  `json:"events"`
}

// SpatialService administra las consultas espaciales exponiendo handlers HTTP.
type SpatialService struct {
	repo database.Repository
}

// NewSpatialService inicializa una nueva instancia de SpatialService.
func NewSpatialService(repo database.Repository) *SpatialService {
	return &SpatialService{repo: repo}
}

// NearbyHandler busca sucursales y eventos dentro de un radio geográfico.
// GET /api/v1/map/nearby?lat=-39.814&lng=-73.245&radius=5
func (s *SpatialService) NearbyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// 1. Obtener y parsear parámetros de la URL
	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	radiusStr := r.URL.Query().Get("radius")

	if latStr == "" || lngStr == "" || radiusStr == "" {
		http.Error(w, "Parámetros lat, lng y radius son requeridos", http.StatusBadRequest)
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		http.Error(w, "Latitud inválida", http.StatusBadRequest)
		return
	}

	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		http.Error(w, "Longitud inválida", http.StatusBadRequest)
		return
	}

	radiusKm, err := strconv.ParseFloat(radiusStr, 64)
	if err != nil || radiusKm < 0 {
		http.Error(w, "Radio inválido (debe ser un valor numérico positivo)", http.StatusBadRequest)
		return
	}

	// PostGIS ST_DWithin utiliza metros para datos de tipo Geography
	radiusMeters := radiusKm * 1000.0
	ctx := r.Context()
	db := s.repo.GetDB()

	if db == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// Canales para recibir datos de consultas en paralelo
	branchChan := make(chan []BranchResult, 1)
	eventChan := make(chan []EventResult, 1)
	errChan := make(chan error, 2)

	// Consulta de sucursales en segundo plano
	go func() {
		branches, err := s.queryNearbyBranches(ctx, lng, lat, radiusMeters)
		if err != nil {
			errChan <- fmt.Errorf("error al consultar sucursales: %w", err)
			return
		}
		branchChan <- branches
	}()

	// Consulta de eventos en segundo plano
	go func() {
		events, err := s.queryNearbyEvents(ctx, lng, lat, radiusMeters)
		if err != nil {
			errChan <- fmt.Errorf("error al consultar eventos: %w", err)
			return
		}
		eventChan <- events
	}()

	// Recolección de resultados
	var branches []BranchResult
	var events []EventResult

	for i := 0; i < 2; i++ {
		select {
		case err := <-errChan:
			log.Printf("[SpatialService] Error en búsqueda geoespacial: %v", err)
			http.Error(w, "Error interno al ejecutar la consulta espacial", http.StatusInternalServerError)
			return
		case b := <-branchChan:
			branches = b
		case e := <-eventChan:
			events = e
		}
	}

	// 3. Devolución de la respuesta en formato JSON
	response := NearbyResponse{
		Branches: branches,
		Events:   events,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("[SpatialService] Error al serializar JSON: %v", err)
	}
}

// queryNearbyBranches ejecuta la consulta SQL exacta para obtener sucursales dentro del radio.
func (s *SpatialService) queryNearbyBranches(ctx context.Context, lng, lat, radiusMeters float64) ([]BranchResult, error) {
	query := `
		SELECT 
			id, 
			company_id, 
			COALESCE(branch_name, ''), 
			COALESCE(description, ''), 
			COALESCE(category, ''), 
			COALESCE(address, ''), 
			COALESCE(phone, ''), 
			geom 
		FROM company_branches 
		WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
		LIMIT 200;
	`
	rows, err := s.repo.GetDB().Query(ctx, query, lng, lat, radiusMeters)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []BranchResult
	for rows.Next() {
		var b BranchResult
		// Escaneamos la columna geom de tipo GEOGRAPHY directamente al struct Point (que implementa sql.Scanner)
		err := rows.Scan(
			&b.ID,
			&b.CompanyID,
			&b.BranchName,
			&b.Description,
			&b.Category,
			&b.Address,
			&b.Phone,
			&b.Geom,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, b)
	}

	return results, nil
}

// queryNearbyEvents ejecuta la consulta SQL exacta para obtener eventos dentro del radio.
func (s *SpatialService) queryNearbyEvents(ctx context.Context, lng, lat, radiusMeters float64) ([]EventResult, error) {
	query := `
		SELECT 
			id, 
			COALESCE(title, ''), 
			COALESCE(description, ''), 
			start_time, 
			end_time, 
			COALESCE(category, ''), 
			COALESCE(emitter_type, ''), 
			user_emitter_id, 
			branch_emitter_id, 
			created_at, 
			geom 
		FROM events 
		WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
		LIMIT 200;
	`
	rows, err := s.repo.GetDB().Query(ctx, query, lng, lat, radiusMeters)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []EventResult
	for rows.Next() {
		var e EventResult
		// Escaneamos la columna geom de tipo GEOGRAPHY directamente al struct Point (que implementa sql.Scanner)
		err := rows.Scan(
			&e.ID,
			&e.Title,
			&e.Description,
			&e.StartTime,
			&e.EndTime,
			&e.Category,
			&e.EmitterType,
			&e.UserEmitterID,
			&e.BranchEmitterID,
			&e.CreatedAt,
			&e.Geom,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, e)
	}

	return results, nil
}
