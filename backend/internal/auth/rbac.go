package auth

import (
	"backend/database"
	"net/http"
	"strconv"

	"github.com/golang-jwt/jwt/v5"
)

// RBACMiddleware retorna un middleware que intercepta la petición y verifica
// si el usuario tiene el permiso requerido en la empresa actual.
func RBACMiddleware(requiredPermission string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// Obtener el ID del usuario desde el contexto
			claims, ok := r.Context().Value(UserContextKey).(jwt.MapClaims)
			if !ok {
				http.Error(w, "No autorizado: contexto sin usuario", http.StatusUnauthorized)
				return
			}

			userIDFloat, ok := claims["id"].(float64)
			if !ok {
				http.Error(w, "ID de usuario inválido en token", http.StatusUnauthorized)
				return
			}
			userID := int(userIDFloat)

			// Obtener el ID de la empresa (asumiendo que viene en el header)
			companyIDStr := r.Header.Get("X-Company-ID")
			if companyIDStr == "" {
				http.Error(w, "Falta header X-Company-ID", http.StatusBadRequest)
				return
			}
			companyID, err := strconv.Atoi(companyIDStr)
			if err != nil {
				http.Error(w, "X-Company-ID inválido", http.StatusBadRequest)
				return
			}

			// Verificar el permiso en la base de datos a través de las tablas RBAC
			query := `
				SELECT 1
				FROM company_members cm
				JOIN company_roles cr ON cm.role = cr.name
				JOIN role_permissions rp ON cr.id = rp.role_id
				WHERE cm.user_id = $1 AND cm.company_id = $2 AND rp.permission = $3
			`
			
			var exists int
			err = database.DB.QueryRow(query, userID, companyID, requiredPermission).Scan(&exists)
			if err != nil {
				// sql.ErrNoRows u otro error implicarán que no tiene permiso
				http.Error(w, "Acceso denegado: se requiere permiso "+requiredPermission, http.StatusForbidden)
				return
			}

			// Si llegamos aquí, el usuario tiene el permiso, continuar
			next.ServeHTTP(w, r)
		}
	}
}
