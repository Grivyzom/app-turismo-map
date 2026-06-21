package middleware

import (
	"backend/database"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	// MaxAdminLoginAttempts es el número máximo de intentos fallidos antes de bloquear.
	MaxAdminLoginAttempts = 5
	// AdminLockoutDuration es el tiempo de bloqueo tras exceder los intentos.
	AdminLockoutDuration = 15 * time.Minute
	// RateLimitWindow es la ventana de tiempo para el conteo de intentos por IP.
	RateLimitWindow = 10 * time.Minute
	// MaxIPAttempts es el máximo de intentos por IP en la ventana de tiempo.
	MaxIPAttempts = 10
)

// AdminRateLimiter protege el endpoint de login admin contra fuerza bruta
// usando Redis para tracking por IP. Si Redis no está disponible, permite
// el acceso (fail-open) pero registra una advertencia.
func AdminRateLimiter(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := GetClientIP(r)
		key := fmt.Sprintf("admin_ratelimit:%s", ip)

		// Si Redis está disponible, verificar rate limit por IP
		if database.RDB != nil {
			count, err := database.RDB.Get(database.Ctx, key).Int()
			if err == nil && count >= MaxIPAttempts {
				ttl, _ := database.RDB.TTL(database.Ctx, key).Result()
				writeJSON(w, http.StatusTooManyRequests, map[string]interface{}{
					"success":    false,
					"message":    "Demasiados intentos. Intente de nuevo más tarde.",
					"retryAfter": int(ttl.Seconds()),
				})
				return
			}
		}

		next.ServeHTTP(w, r)
	}
}

// IncrementIPAttempts incrementa el contador de intentos fallidos para una IP.
func IncrementIPAttempts(ip string) {
	if database.RDB == nil {
		return
	}
	key := fmt.Sprintf("admin_ratelimit:%s", ip)
	pipe := database.RDB.Pipeline()
	pipe.Incr(database.Ctx, key)
	pipe.Expire(database.Ctx, key, RateLimitWindow)
	pipe.Exec(database.Ctx)
}

// ResetIPAttempts limpia el contador de intentos tras un login exitoso.
func ResetIPAttempts(ip string) {
	if database.RDB == nil {
		return
	}
	key := fmt.Sprintf("admin_ratelimit:%s", ip)
	database.RDB.Del(database.Ctx, key)
}

// trustedProxies contiene las IPs de proxies de confianza (nginx, Docker network).
// Solo se leen headers X-Forwarded-For / X-Real-IP si la conexión viene de uno de estos.
var trustedProxies = map[string]bool{
	"127.0.0.1":      true,
	"::1":            true,
	"172.17.0.1":     true, // Docker bridge default
	"172.18.0.1":     true, // Docker compose network
	"10.0.0.1":       true, // Red privada
	"host.docker.internal": true,
}

// GetClientIP extrae la IP real del cliente, considerando proxies reversos.
// SEGURIDAD: Solo confía en headers de proxy si la conexión viene de un proxy conocido.
func GetClientIP(r *http.Request) string {
	// Extraer la IP directa de la conexión (sin puerto)
	directIP := r.RemoteAddr
	if idx := strings.LastIndex(directIP, ":"); idx != -1 {
		directIP = directIP[:idx]
	}
	// Limpiar brackets de IPv6
	directIP = strings.TrimPrefix(strings.TrimSuffix(directIP, "]"), "[")

	// Solo confiar en headers de proxy si la conexión viene de un proxy conocido
	if trustedProxies[directIP] {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			// Tomar la IP del cliente (primera en la cadena)
			clientIP := strings.TrimSpace(parts[0])
			if clientIP != "" {
				return clientIP
			}
		}
		if xri := r.Header.Get("X-Real-IP"); xri != "" {
			return strings.TrimSpace(xri)
		}
	}

	return directIP
}

// AuthRateLimiter protege los endpoints de autenticación pública (login/registro) contra fuerza bruta y spam.
func AuthRateLimiter(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := GetClientIP(r)
		key := fmt.Sprintf("auth_ratelimit:%s", ip)

		if database.RDB != nil {
			count, err := database.RDB.Get(database.Ctx, key).Int()
			// Permitimos un máximo de 20 intentos por IP cada 10 minutos para rutas de login/registro público
			if err == nil && count >= 20 {
				ttl, _ := database.RDB.TTL(database.Ctx, key).Result()
				writeJSON(w, http.StatusTooManyRequests, map[string]interface{}{
					"success":    false,
					"message":    "Demasiados intentos de acceso desde esta IP. Intente de nuevo más tarde.",
					"retryAfter": int(ttl.Seconds()),
				})
				return
			}
		}

		next.ServeHTTP(w, r)
	}
}

// IncrementAuthAttempts incrementa el contador de intentos fallidos de auth para una IP.
func IncrementAuthAttempts(ip string) {
	if database.RDB == nil {
		return
	}
	key := fmt.Sprintf("auth_ratelimit:%s", ip)
	pipe := database.RDB.Pipeline()
	pipe.Incr(database.Ctx, key)
	pipe.Expire(database.Ctx, key, RateLimitWindow)
	pipe.Exec(database.Ctx)
}

// ResetAuthAttempts limpia el contador de intentos de auth para una IP tras un login exitoso.
func ResetAuthAttempts(ip string) {
	if database.RDB == nil {
		return
	}
	key := fmt.Sprintf("auth_ratelimit:%s", ip)
	database.RDB.Del(database.Ctx, key)
}
