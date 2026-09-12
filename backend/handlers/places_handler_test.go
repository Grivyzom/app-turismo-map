package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"backend/database"
)

func TestPlacesSearchHandler_NoDatabase(t *testing.T) {
	originalDB := database.DB
	database.DB = nil
	defer func() { database.DB = originalDB }()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/places/search", nil)
	rec := httptest.NewRecorder()

	PlacesSearchHandler(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Base de datos no disponible") {
		t.Fatalf("expected body to mention 'Base de datos no disponible', got %q", rec.Body.String())
	}
}
