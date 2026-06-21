package middleware

import (
	"log"
	"net/http"
	"runtime/debug"
)

// RecoveryMiddleware recupera de pánicos en los handlers HTTP para evitar que el servidor se caiga
func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[PANIC RECOVERY] Ocurrió un pánico: %v\nStack Trace:\n%s", err, debug.Stack())
				
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"success":false,"message":"Error interno del servidor"}`))
			}
		}()
		next.ServeHTTP(w, r)
	})
}
