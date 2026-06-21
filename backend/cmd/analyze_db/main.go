package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}
	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}
	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "turismo_user"
	}
	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "grivyzom@100110"
	}
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "app-turismo"
	}
	dbSSLMode := os.Getenv("DB_SSLMODE")
	if dbSSLMode == "" {
		dbSSLMode = "disable"
	}

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dbHost, dbPort, dbUser, dbPassword, dbName, dbSSLMode)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("Error conectando a la BD: %v", err)
	}
	defer db.Close()

	fmt.Println("====================================================")
	fmt.Println("   ANÁLISIS DE BASE DE DATOS - APP TURISMO")
	fmt.Println("====================================================")

	// 1. Estadísticas Generales (Conteos)
	printHeader("1. Estadísticas Generales")
	tables := []string{"users", "companies", "company_branches", "events", "map_reports", "products", "promotions", "admin_users", "collections"}
	for _, table := range tables {
		var count int
		err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", table)).Scan(&count)
		if err != nil {
			fmt.Printf("   [!] %s: Error - %v\n", table, err)
			continue
		}
		fmt.Printf("   - Total %-18s: %d\n", table, count)
	}

	// 2. Desglose de Usuarios
	printHeader("2. Desglose de Usuarios")
	rows, err := db.Query("SELECT user_type, status, COUNT(*) FROM users GROUP BY user_type, status")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var uType, status string
			var count int
			rows.Scan(&uType, &status, &count)
			fmt.Printf("   - %s (%s): %d\n", uType, status, count)
		}
	} else {
		fmt.Printf("   [!] Error en consulta de usuarios: %v\n", err)
	}

	// 3. Verificación de Empresas
	printHeader("3. Estado de Empresas")
	rows, err = db.Query("SELECT verification_status, COUNT(*) FROM companies GROUP BY verification_status")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var status string
			var count int
			rows.Scan(&status, &count)
			fmt.Printf("   - %-12s: %d\n", status, count)
		}
	} else {
		fmt.Printf("   [!] Error en consulta de empresas: %v\n", err)
	}

	// 4. Categorías de Sucursales (Top 5)
	printHeader("4. Categorías de Sucursales (Top 5)")
	rows, err = db.Query("SELECT category, COUNT(*) FROM company_branches WHERE category IS NOT NULL GROUP BY category ORDER BY COUNT(*) DESC LIMIT 5")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var category string
			var count int
			rows.Scan(&category, &count)
			fmt.Printf("   - %-15s: %d\n", category, count)
		}
	} else {
		fmt.Printf("   [!] Error en consulta de sucursales: %v\n", err)
	}

	// 5. Análisis Geográfico (PostGIS)
	printHeader("5. Análisis Geográfico")
	var branchesWithGeom, eventsWithGeom int
	err1 := db.QueryRow("SELECT COUNT(*) FROM company_branches WHERE geom IS NOT NULL").Scan(&branchesWithGeom)
	err2 := db.QueryRow("SELECT COUNT(*) FROM events WHERE geom IS NOT NULL").Scan(&eventsWithGeom)
	if err1 == nil && err2 == nil {
		fmt.Printf("   - Sucursales geolocalizadas: %d\n", branchesWithGeom)
		fmt.Printf("   - Eventos geolocalizados:    %d\n", eventsWithGeom)
	} else {
		fmt.Printf("   [!] Error en consulta geográfica\n")
	}

	// 6. Actividad de Administración Reciente
	printHeader("6. Últimas 5 Acciones de Auditoría")
	rows, err = db.Query("SELECT action, ip_address, created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 5")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var action, ip, createdAt string
			rows.Scan(&action, &ip, &createdAt)
			// Truncate createdAt for better display if it's long
			displayDate := createdAt
			if len(createdAt) > 10 {
				displayDate = createdAt[:10]
			}
			fmt.Printf("   - [%s] %-20s (IP: %s)\n", displayDate, action, ip)
		}
	} else {
		fmt.Printf("   [!] Error en consulta de auditoría: %v\n", err)
	}

	fmt.Println("\n====================================================")
	fmt.Println("   Fin del análisis.")
	fmt.Println("====================================================")
}

func printHeader(title string) {
	fmt.Printf("\n>>> %s\n", title)
}
