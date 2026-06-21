package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://turismo_user:grivyzom@100110@localhost:5432/app-turismo?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Error connecting to DB: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Error pinging DB: %v", err)
	}

	businesses := []struct {
		email      string
		name       string
		phone      string
		entityType string
	}{
		{
			email:      "independiente@turismo.local",
			name:       "Independiente Test",
			phone:      "555-0001",
			entityType: "independiente",
		},
		{
			email:      "pymes@turismo.local",
			name:       "PyMES Test",
			phone:      "555-0002",
			entityType: "pymes",
		},
		{
			email:      "empresas@turismo.local",
			name:       "Empresas Test",
			phone:      "555-0003",
			entityType: "empresas",
		},
	}

	password := "password123"
	hashedPwd, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Error hashing password: %v", err)
	}

	for _, biz := range businesses {
		// Create user
		var userID int
		err := db.QueryRow(
			"INSERT INTO users (email, name, password_hash, user_type, status) VALUES ($1, $2, $3, 'partner_owner', 'active') RETURNING id",
			biz.email, biz.name, string(hashedPwd),
		).Scan(&userID)
		if err != nil {
			log.Printf("Error creating user %s: %v", biz.email, err)
			continue
		}

		// Create company
		var companyID int
		err = db.QueryRow(
			"INSERT INTO companies (business_name, entity_type, verification_status, phone) VALUES ($1, $2, 'verified', $3) RETURNING id",
			biz.name, biz.entityType, biz.phone,
		).Scan(&companyID)
		if err != nil {
			log.Printf("Error creating company for %s: %v", biz.email, err)
			continue
		}

		// Link user to company
		_, err = db.Exec(
			"INSERT INTO company_members (user_id, company_id, role) VALUES ($1, $2, 'owner')",
			userID, companyID,
		)
		if err != nil {
			log.Printf("Error linking user %d to company %d: %v", userID, companyID, err)
			continue
		}

		fmt.Printf("✓ Created %s (%s) - User ID: %d, Company ID: %d\n", biz.name, biz.entityType, userID, companyID)
	}

	fmt.Printf("\nAll accounts created with password: %s\n", password)
}
