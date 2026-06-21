package catalog

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Product representa la entidad de un producto en la base de datos.
type Product struct {
	ID          int       `json:"id"`
	BranchID    int       `json:"branchId"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	ImageURL    string    `json:"imageUrl"`
	Category    string    `json:"category"`
	IsAvailable bool      `json:"isAvailable"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// CreateProductRequest define la estructura para crear un producto.
type CreateProductRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	ImageURL    string  `json:"imageUrl"`
	Category    string  `json:"category"`
	IsAvailable *bool   `json:"isAvailable"` // Usamos puntero para distinguir entre omitido y false
}

// Promotion representa la entidad de una promoción en la base de datos.
type Promotion struct {
	ID              int       `json:"id"`
	BranchID        int       `json:"branchId"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	DiscountPercent float64   `json:"discountPercent"`
	StartDate       time.Time `json:"startDate"`
	EndDate         time.Time `json:"endDate"`
	IsActive        bool      `json:"isActive"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// CreatePromotionRequest define la estructura para crear una promoción.
type CreatePromotionRequest struct {
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	DiscountPercent float64   `json:"discountPercent"`
	StartDate       time.Time `json:"startDate"`
	EndDate         time.Time `json:"endDate"`
}

// Handler contiene las dependencias para los controladores del catálogo.
type Handler struct {
	db *pgxpool.Pool
}

// NewHandler crea e inicializa un nuevo Handler de catálogo.
func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

// CreateProduct crea un nuevo producto en una sucursal.
// POST /api/v1/branches/{id}/products
func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Método no permitido")
		return
	}

	branchIDStr := r.PathValue("id")
	branchID, err := strconv.Atoi(branchIDStr)
	if err != nil || branchID <= 0 {
		writeJSONError(w, http.StatusBadRequest, "ID de sucursal inválido")
		return
	}

	var req CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "Cuerpo de solicitud inválido")
		return
	}

	// Validaciones de entrada
	if req.Name == "" {
		writeJSONError(w, http.StatusBadRequest, "El nombre del producto es obligatorio")
		return
	}
	if req.Price < 0 {
		writeJSONError(w, http.StatusBadRequest, "El precio no puede ser negativo")
		return
	}

	isAvailable := true
	if req.IsAvailable != nil {
		isAvailable = *req.IsAvailable
	}

	var p Product
	query := `
		INSERT INTO products (branch_id, name, description, price, image_url, category, is_available)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, branch_id, name, description, price, image_url, category, is_available, created_at, updated_at
	`

	err = h.db.QueryRow(r.Context(), query, branchID, req.Name, req.Description, req.Price, req.ImageURL, req.Category, isAvailable).Scan(
		&p.ID, &p.BranchID, &p.Name, &p.Description, &p.Price, &p.ImageURL, &p.Category, &p.IsAvailable, &p.CreatedAt, &p.UpdatedAt,
	)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			writeJSONError(w, http.StatusNotFound, "La sucursal especificada no existe")
			return
		}
		log.Printf("Error al crear producto: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "Error interno del servidor al crear el producto")
		return
	}

	writeJSON(w, http.StatusCreated, p)
}

// ListProducts lista los productos de una sucursal.
// GET /api/v1/branches/{id}/products
func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "Método no permitido")
		return
	}

	branchIDStr := r.PathValue("id")
	branchID, err := strconv.Atoi(branchIDStr)
	if err != nil || branchID <= 0 {
		writeJSONError(w, http.StatusBadRequest, "ID de sucursal inválido")
		return
	}

	// Parámetros opcionales de query para paginación y filtros
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	availableOnlyStr := r.URL.Query().Get("available_only")

	limit := 100
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}
	offset := 0
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	query := `
		SELECT id, branch_id, name, description, price, image_url, category, is_available, created_at, updated_at
		FROM products
		WHERE branch_id = $1
	`
	args := []interface{}{branchID}
	paramCount := 2

	if availableOnlyStr == "true" {
		query += " AND is_available = true"
	}

	query += " ORDER BY created_at DESC LIMIT $" + strconv.Itoa(paramCount)
	args = append(args, limit)
	paramCount++

	query += " OFFSET $" + strconv.Itoa(paramCount)
	args = append(args, offset)

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		log.Printf("Error al listar productos: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "Error interno del servidor al listar los productos")
		return
	}
	defer rows.Close()

	products := []Product{}
	for rows.Next() {
		var p Product
		err := rows.Scan(
			&p.ID, &p.BranchID, &p.Name, &p.Description, &p.Price, &p.ImageURL, &p.Category, &p.IsAvailable, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			log.Printf("Error al escanear producto: %v", err)
			writeJSONError(w, http.StatusInternalServerError, "Error interno del servidor al procesar la lista de productos")
			return
		}
		products = append(products, p)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error durante iteración de productos: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "Error interno del servidor al iterar los productos")
		return
	}

	writeJSON(w, http.StatusOK, products)
}

// CreatePromotion crea una promoción activa en una sucursal.
// POST /api/v1/branches/{id}/promotions
func (h *Handler) CreatePromotion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Método no permitido")
		return
	}

	branchIDStr := r.PathValue("id")
	branchID, err := strconv.Atoi(branchIDStr)
	if err != nil || branchID <= 0 {
		writeJSONError(w, http.StatusBadRequest, "ID de sucursal inválido")
		return
	}

	var req CreatePromotionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "Cuerpo de solicitud inválido")
		return
	}

	// Validaciones de entrada
	if req.Title == "" {
		writeJSONError(w, http.StatusBadRequest, "El título de la promoción es obligatorio")
		return
	}
	if req.DiscountPercent < 0 || req.DiscountPercent > 100 {
		writeJSONError(w, http.StatusBadRequest, "El porcentaje de descuento debe estar entre 0 y 100")
		return
	}
	if req.StartDate.IsZero() {
		req.StartDate = time.Now()
	}
	if req.EndDate.IsZero() {
		writeJSONError(w, http.StatusBadRequest, "La fecha de fin de la promoción es obligatoria")
		return
	}
	if req.EndDate.Before(req.StartDate) {
		writeJSONError(w, http.StatusBadRequest, "La fecha de fin no puede ser anterior a la fecha de inicio")
		return
	}

	var promo Promotion
	query := `
		INSERT INTO promotions (branch_id, title, description, discount_percent, start_date, end_date, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, branch_id, title, description, discount_percent, start_date, end_date, is_active, created_at, updated_at
	`

	// Forzamos que sea una promoción activa
	isActive := true

	err = h.db.QueryRow(r.Context(), query, branchID, req.Title, req.Description, req.DiscountPercent, req.StartDate, req.EndDate, isActive).Scan(
		&promo.ID, &promo.BranchID, &promo.Title, &promo.Description, &promo.DiscountPercent, &promo.StartDate, &promo.EndDate, &promo.IsActive, &promo.CreatedAt, &promo.UpdatedAt,
	)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			writeJSONError(w, http.StatusNotFound, "La sucursal especificada no existe")
			return
		}
		log.Printf("Error al crear promoción: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "Error interno del servidor al crear la promoción")
		return
	}

	writeJSON(w, http.StatusCreated, promo)
}

// Helpers internos de respuesta JSON

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error codificando respuesta JSON: %v", err)
	}
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
