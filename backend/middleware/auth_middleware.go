package middleware

import (
	"backend/database"
	"backend/utils"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	clerkjwt "github.com/clerk/clerk-sdk-go/v2/jwt"
	clerkuser "github.com/clerk/clerk-sdk-go/v2/user"
	"github.com/golang-jwt/jwt/v5"
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

// OptionalAuthMiddleware intenta extraer el token JWT pero no falla si no está presente.
// Si el token es válido, inyecta los claims en el contexto igual que AuthMiddleware.
func OptionalAuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, err := ExtractAndValidateToken(r)
		if err == nil {
			r = r.WithContext(context.WithValue(r.Context(), UserContextKey, claims))
		}
		next.ServeHTTP(w, r)
	}
}

// ExtractAndValidateToken extrae y valida un JWT del header Authorization.
// Soporta tanto tokens HMAC de la aplicación como tokens de sesión nativos de Clerk.
func ExtractAndValidateToken(r *http.Request) (jwt.MapClaims, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, fmt.Errorf("se requiere token de autenticación")
	}

	if len(authHeader) <= 7 || authHeader[:7] != "Bearer " {
		return nil, fmt.Errorf("formato de token inválido")
	}
	tokenString := authHeader[7:]

	// 1. Intentar validar primero con HMAC local de la aplicación
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de firma no es HMAC")
		}
		return utils.JWTSecret, nil
	})

	if err == nil && token.Valid {
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			return claims, nil
		}
	}

	// 2. Si falla y CLERK_SECRET_KEY está configurado, validar como token de Clerk
	if os.Getenv("CLERK_SECRET_KEY") != "" {
		clerkClaims, clerkErr := clerkjwt.Verify(r.Context(), &clerkjwt.VerifyParams{
			Token: tokenString,
		})
		if clerkErr == nil && clerkClaims != nil && clerkClaims.Subject != "" {
			clerkUserID := clerkClaims.Subject
			claims := jwt.MapClaims{
				"sub":      clerkUserID,
				"scope":    "citizen",
				"clerk_id": clerkUserID,
			}

			if database.DB != nil {
				var dbID int
				var dbEmail, dbUserType string
				qErr := database.DB.QueryRow(`
					SELECT id, email, user_type FROM users WHERE clerk_id = $1 LIMIT 1
				`, clerkUserID).Scan(&dbID, &dbEmail, &dbUserType)
				if qErr == nil {
					claims["id"] = float64(dbID)
					claims["email"] = dbEmail
					claims["userType"] = dbUserType
					return claims, nil
				}

				// Si el usuario no existe en PostgreSQL, obtener datos desde Clerk API y registrarlo
				cu, uErr := clerkuser.Get(r.Context(), clerkUserID)
				if uErr == nil && cu != nil {
					email := ""
					for _, em := range cu.EmailAddresses {
						if cu.PrimaryEmailAddressID != nil && em.ID == *cu.PrimaryEmailAddressID {
							email = em.EmailAddress
							break
						}
					}
					if email == "" && len(cu.EmailAddresses) > 0 {
						email = cu.EmailAddresses[0].EmailAddress
					}

					name := ""
					if cu.FirstName != nil {
						name = *cu.FirstName
					}
					if cu.LastName != nil {
						if name != "" {
							name += " " + *cu.LastName
						} else {
							name = *cu.LastName
						}
					}
					if name == "" && cu.Username != nil {
						name = *cu.Username
					}
					if name == "" {
						name = strings.Split(email, "@")[0]
					}
					picture := ""
					if cu.ImageURL != nil {
						picture = *cu.ImageURL
					}

					qErr = database.DB.QueryRow(`
						SELECT id, email, user_type FROM users WHERE email = $1 LIMIT 1
					`, email).Scan(&dbID, &dbEmail, &dbUserType)
					if qErr == sql.ErrNoRows {
						insErr := database.DB.QueryRow(`
							INSERT INTO users (email, name, picture, user_type, status, clerk_id)
							VALUES ($1, $2, $3, 'citizen', 'active', $4)
							RETURNING id
						`, email, name, picture, clerkUserID).Scan(&dbID)
						if insErr == nil {
							database.DB.Exec("INSERT INTO citizen_profiles (user_id, profile_type, current_view_mode) VALUES ($1, 'local', 'local') ON CONFLICT DO NOTHING", dbID)
							claims["id"] = float64(dbID)
							claims["email"] = email
							claims["userType"] = "citizen"
							return claims, nil
						}
					} else if qErr == nil {
						database.DB.Exec("UPDATE users SET clerk_id = $1 WHERE id = $2", clerkUserID, dbID)
						claims["id"] = float64(dbID)
						claims["email"] = dbEmail
						claims["userType"] = dbUserType
						return claims, nil
					}
				}
			}

			return claims, nil
		}
	}

	return nil, fmt.Errorf("token inválido o expirado")
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
