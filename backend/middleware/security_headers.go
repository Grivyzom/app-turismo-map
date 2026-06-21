package middleware

import "net/http"

// SecurityHeadersMiddleware añade headers de seguridad a todas las respuestas HTTP.
// Protege contra: clickjacking (X-Frame-Options), MIME sniffing (X-Content-Type-Options),
// información de referrer (Referrer-Policy), y fuerza HTTPS (HSTS).
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Prevenir que el admin panel se cargue en iframes (anti-clickjacking)
		w.Header().Set("X-Frame-Options", "DENY")
		// Prevenir que el navegador interprete archivos con MIME incorrecto
		w.Header().Set("X-Content-Type-Options", "nosniff")
		// CSP: solo permite scripts y estilos del propio dominio + Google Fonts
		w.Header().Set("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self'; "+
				"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "+
				"font-src 'self' https://fonts.gstatic.com; "+
				"img-src 'self' data: https:; "+
				"connect-src 'self'; "+
				"frame-ancestors 'none'")
		// Controlar qué información de referrer se envía
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		// Forzar HTTPS por 1 año (solo efectivo con TLS)
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		// Desactivar APIs del navegador que no necesitamos
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)")
		// Prevenir caching de respuestas sensibles del admin
		if len(r.URL.Path) > 6 && r.URL.Path[:7] == "/admin/" {
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
			w.Header().Set("Pragma", "no-cache")
		}

		next.ServeHTTP(w, r)
	})
}
