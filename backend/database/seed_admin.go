package database

import (
	"log"

	"golang.org/x/crypto/bcrypt"
)

// SeedDefaultAdmin crea el superadmin inicial si no existe ningún admin en el sistema.
// La contraseña por defecto DEBE cambiarse inmediatamente tras el primer login.
// En el primer inicio de sesión, se le pedirá al admin configurar su 2FA.
func SeedDefaultAdmin(email, password, name string) {
	if DB == nil {
		log.Println("Aviso: No se puede crear admin seed — BD no disponible")
		return
	}

	// Verificar si ya existe al menos un admin
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM admin_users").Scan(&count)
	if err != nil {
		log.Printf("Error verificando admins existentes: %v\n", err)
		return
	}

	if count > 0 {
		log.Printf("Ya existen %d administradores en el sistema. Omitiendo seed.\n", count)
		return
	}

	// Hashear la contraseña inicial
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost+2) // Cost 12 para admins
	if err != nil {
		log.Printf("Error hasheando contraseña del admin seed: %v\n", err)
		return
	}

	_, err = DB.Exec(
		`INSERT INTO admin_users (email, name, password_hash, role, status, totp_ready) 
		 VALUES ($1, $2, $3, 'superadmin', 'pending_2fa', false)`,
		email, name, string(hashedPassword),
	)
	if err != nil {
		log.Printf("Error creando admin seed: %v\n", err)
		return
	}

	log.Println("═══════════════════════════════════════════════════════════════")
	log.Println("  SUPERADMIN INICIAL CREADO")
	log.Printf("  Email: %s\n", email)
	log.Println("  ⚠️  Inicie sesión para configurar la autenticación 2FA")
	log.Println("  ⚠️  Cambie la contraseña por defecto inmediatamente")
	log.Println("═══════════════════════════════════════════════════════════════")
}
