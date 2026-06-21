package auth

import (
	"backend/database"
	"fmt"
)

// AcceptInvitation procesa la lógica de negocio para aceptar una invitación a una empresa.
func AcceptInvitation(userID int, companyID int) error {
	var count int
	
	// Consulta estricta para contar el número de negocios en los que participa el usuario
	query := "SELECT COUNT(*) FROM company_members WHERE user_id = $1"
	err := database.DB.QueryRow(query, userID).Scan(&count)
	if err != nil {
		return fmt.Errorf("error al verificar el límite de negocios del usuario: %w", err)
	}

	// Regla de negocio crítica: máximo 10 negocios
	if count >= 10 {
		return fmt.Errorf("403 Forbidden: se alcanzó el límite máximo de negocios administrados")
	}

	// Lógica para añadir al usuario a la empresa.
	// Nota: Un sistema completo también verificaría el estado de la invitación,
	// pero nos enfocamos en el requerimiento del conteo de registros.
	insertQuery := `
		INSERT INTO company_members (user_id, company_id, role)
		VALUES ($1, $2, 'worker')
		ON CONFLICT (user_id, company_id) DO NOTHING
	`
	_, err = database.DB.Exec(insertQuery, userID, companyID)
	if err != nil {
		return fmt.Errorf("error al registrar al usuario en la empresa: %w", err)
	}

	return nil
}
