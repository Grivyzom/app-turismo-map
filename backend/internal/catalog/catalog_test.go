package catalog

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCreateProduct_Validation(t *testing.T) {
	handler := NewHandler(nil) // nil DB since we expect it to fail before querying
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/branches/{id}/products", handler.CreateProduct)

	tests := []struct {
		name           string
		url            string
		body           interface{}
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "Invalid Branch ID",
			url:            "/api/v1/branches/abc/products",
			body:           CreateProductRequest{Name: "Test Product", Price: 10.0},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "ID de sucursal inválido",
		},
		{
			name:           "Negative Branch ID",
			url:            "/api/v1/branches/-5/products",
			body:           CreateProductRequest{Name: "Test Product", Price: 10.0},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "ID de sucursal inválido",
		},
		{
			name:           "Empty Product Name",
			url:            "/api/v1/branches/10/products",
			body:           CreateProductRequest{Name: "", Price: 10.0},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "El nombre del producto es obligatorio",
		},
		{
			name:           "Negative Product Price",
			url:            "/api/v1/branches/10/products",
			body:           CreateProductRequest{Name: "Test Product", Price: -1.0},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "El precio no puede ser negativo",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bodyBytes, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, tt.url, bytes.NewBuffer(bodyBytes))
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}

			var resp map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if resp["error"] != tt.expectedError {
				t.Errorf("expected error %q, got %q", tt.expectedError, resp["error"])
			}
		})
	}
}

func TestCreatePromotion_Validation(t *testing.T) {
	handler := NewHandler(nil)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/branches/{id}/promotions", handler.CreatePromotion)

	// Test dates
	now := time.Now()
	past := now.Add(-24 * time.Hour)
	future := now.Add(24 * time.Hour)

	tests := []struct {
		name           string
		url            string
		body           interface{}
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "Invalid Branch ID",
			url:            "/api/v1/branches/abc/promotions",
			body:           CreatePromotionRequest{Title: "Promo", DiscountPercent: 15.0, EndDate: future},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "ID de sucursal inválido",
		},
		{
			name:           "Empty Promotion Title",
			url:            "/api/v1/branches/10/promotions",
			body:           CreatePromotionRequest{Title: "", DiscountPercent: 15.0, EndDate: future},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "El título de la promoción es obligatorio",
		},
		{
			name:           "Negative Discount Percent",
			url:            "/api/v1/branches/10/promotions",
			body:           CreatePromotionRequest{Title: "Promo", DiscountPercent: -5.0, EndDate: future},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "El porcentaje de descuento debe estar entre 0 y 100",
		},
		{
			name:           "Discount Percent Exceeding 100",
			url:            "/api/v1/branches/10/promotions",
			body:           CreatePromotionRequest{Title: "Promo", DiscountPercent: 105.0, EndDate: future},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "El porcentaje de descuento debe estar entre 0 y 100",
		},
		{
			name:           "Missing End Date",
			url:            "/api/v1/branches/10/promotions",
			body:           CreatePromotionRequest{Title: "Promo", DiscountPercent: 15.0},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "La fecha de fin de la promoción es obligatoria",
		},
		{
			name:           "End Date Before Start Date",
			url:            "/api/v1/branches/10/promotions",
			body:           CreatePromotionRequest{Title: "Promo", DiscountPercent: 15.0, StartDate: future, EndDate: past},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "La fecha de fin no puede ser anterior a la fecha de inicio",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bodyBytes, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, tt.url, bytes.NewBuffer(bodyBytes))
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}

			var resp map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if resp["error"] != tt.expectedError {
				t.Errorf("expected error %q, got %q", tt.expectedError, resp["error"])
			}
		})
	}
}
