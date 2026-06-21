package middleware

import (
	"backend/utils"
	"context"
	"encoding/json"
	"fmt"
	"github.com/golang-jwt/jwt/v5"
	"net/http"
)

// contextKey es un tipo privado para evitar colisiones en context.Value.
type contextKey string

const UserContextKey contextKey = "user"
const AdminContextKey contextKey = "admin"

// AuthMiddleware valida JWT para usuarios normales (scope: "user").
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, err := ExtractAndValidateToken(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// AdminMiddleware valida JWT con scope "admin" y verifica que el rol
// del administrador sea válido. Si el token no tiene scope admin, rechaza.
func AdminMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, err := ExtractAndValidateToken(r)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]interface{}{
				"success": false,
				"message": "Acceso denegado: " + err.Error(),
			})
			return
		}

		// Verificar que el scope del token sea explícitamente "admin"
		scope, _ := claims["scope"].(string)
		if scope != "admin" {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{
				"success": false,
				"message": "Acceso denegado: no tienes permisos de administrador",
			})
			return
		}

		// Verificar que el rol sea un rol admin válido
		role, _ := claims["role"].(string)
		if role != "superadmin" && role != "admin" && role != "moderator" {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{
				"success": false,
				"message": "Acceso denegado: rol de administrador inválido",
			})
			return
		}

		ctx := context.WithValue(r.Context(), AdminContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// SuperAdminMiddleware solo permite acceso a superadmins.
func SuperAdminMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return AdminMiddleware(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(AdminContextKey).(jwt.MapClaims)
		if !ok {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{
				"success": false,
				"message": "Acceso denegado",
			})
			return
		}

		role, _ := claims["role"].(string)
		if role != "superadmin" {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{
				"success": false,
				"message": "Se requiere rol de superadministrador",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ExtractAndValidateToken extrae y valida un JWT del header Authorization.
func ExtractAndValidateToken(r *http.Request) (jwt.MapClaims, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, fmt.Errorf("se requiere token de autenticación")
	}

	if len(authHeader) <= 7 || authHeader[:7] != "Bearer " {
		return nil, fmt.Errorf("formato de token inválido")
	}
	tokenString := authHeader[7:]

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de firma inesperado: %v", token.Header["alg"])
		}
		return utils.JWTSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("token inválido o expirado")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("claims inválidos en el token")
	}

	return claims, nil
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
