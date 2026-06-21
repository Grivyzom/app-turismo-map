package utils

import (
	"backend/models"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var JWTSecret []byte

func InitJWT() {
	secret := os.Getenv("JWT_SECRET")
	if len(secret) < 32 {
		log.Fatal("FATAL: JWT_SECRET no está configurado o es demasiado corto (mínimo 32 caracteres). " +
			"Genere uno con: openssl rand -base64 64")
	}
	JWTSecret = []byte(secret)
}

// GenerateToken genera un JWT para usuarios de la plataforma (ciudadanos y empresas).
// Las duraciones de la sesión varían por seguridad:
// - citizen: 720 horas (30 días) para máxima retención (fricción cero).
// - partner_owner / partner_worker: 4 horas (timeout agresivo por datos sensibles).
func GenerateToken(user models.User) (string, error) {
	var expDuration time.Duration
	var scope string

	if user.UserType == "citizen" {
		expDuration = time.Hour * 720 // 30 días
		scope = "citizen"
	} else if user.UserType == "partner_owner" || user.UserType == "partner_worker" {
		expDuration = time.Hour * 4 // 4 horas
		scope = "business"
	} else {
		// Fallback
		expDuration = time.Hour * 24
		scope = "user"
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":       user.ID,
		"email":    user.Email,
		"userType": user.UserType,
		"scope":    scope,
		"exp":      time.Now().Add(expDuration).Unix(),
		"iat":      time.Now().Unix(),
	})
	return token.SignedString(JWTSecret)
}

// GenerateAdminToken genera un JWT para administradores con duración corta (1h)
// y un scope explícito "admin" que el middleware verificará.
func GenerateAdminToken(admin models.AdminUser) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":    admin.ID,
		"email": admin.Email,
		"role":  admin.Role,
		"scope": "admin",
		"exp":   time.Now().Add(time.Hour * 1).Unix(),
		"iat":   time.Now().Unix(),
	})
	return token.SignedString(JWTSecret)
}
