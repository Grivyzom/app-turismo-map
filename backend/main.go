package main

import (
	"backend/database"
	"backend/handlers"
	"backend/internal/catalog"
	intdb "backend/internal/database"
	"backend/middleware"
	"backend/utils"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Aviso: No se encontró archivo .env (se usarán variables del sistema)")
	}

	database.InitDB()
	database.InitRedis()
	utils.InitJWT()

	// Inicializar pgxpool para el catálogo y promociones
	repo, err := intdb.NewRepository(context.Background())
	if err != nil {
		log.Printf("Advertencia: No se pudo conectar con pgxpool para el catálogo: %v\n", err)
	}

	// Crear el superadmin inicial si no existe ninguno en la BD.
	// Las credenciales se leen de variables de entorno para no hardcodear secretos.
	adminEmail := os.Getenv("ADMIN_SEED_EMAIL")
	adminPass := os.Getenv("ADMIN_SEED_PASSWORD")
	adminName := os.Getenv("ADMIN_SEED_NAME")
	if adminEmail != "" && adminPass != "" {
		if adminName == "" {
			adminName = "Super Administrador"
		}
		database.SeedDefaultAdmin(adminEmail, adminPass, adminName)
	}

	mux := http.NewServeMux()

	// ── Rutas públicas generales ─────────────────────────────────────────
	mux.HandleFunc("/api/v1/weather", handlers.GetWeatherHandler)
	mux.HandleFunc("/api/v1/time", handlers.GetTimeHandler)
	mux.HandleFunc("POST /api/v1/survey", handlers.CollectSurveyHandler)

	// ── Rutas públicas de autenticación (usuarios normales) ──────────────
	mux.HandleFunc("/auth/google", handlers.GoogleAuthHandler)
	mux.HandleFunc("/auth/register", middleware.AuthRateLimiter(handlers.RegisterHandler))
	mux.HandleFunc("/auth/login", middleware.AuthRateLimiter(handlers.LoginHandler))

	// ── Rutas protegidas de la API (usuarios autenticados) ───────────────
	mux.HandleFunc("/api/v1/events/checkin", middleware.AuthMiddleware(handlers.CheckinHandler))
	mux.HandleFunc("/api/v1/places/search", handlers.PlacesSearchHandler)
	mux.HandleFunc("/api/v1/recommendations", middleware.AuthMiddleware(handlers.RecommendationsHandler))
	mux.HandleFunc("GET /api/v1/profile/preferences", middleware.AuthMiddleware(handlers.GetPreferencesHandler))
	mux.HandleFunc("POST /api/v1/profile/preferences", middleware.AuthMiddleware(handlers.UpdatePreferencesHandler))
	mux.HandleFunc("PATCH /api/v1/profile/preferences", middleware.AuthMiddleware(handlers.UpdatePreferencesHandler))
	mux.HandleFunc("POST /api/v1/profile/view-mode", middleware.AuthMiddleware(handlers.UpdateViewModeHandler))
	mux.HandleFunc("/api/v1/business/location", middleware.AuthMiddleware(handlers.GetCompanyLocationHandler))
	mux.HandleFunc("/api/v1/business/location/update", middleware.AuthMiddleware(handlers.UpdateCompanyLocationHandler))
	mux.HandleFunc("/api/v1/events", middleware.AuthMiddleware(handlers.CreateEventHandler))
	mux.HandleFunc("GET /api/v1/zones", handlers.GetZonesHandler)
	mux.HandleFunc("POST /api/v1/zones", middleware.AuthMiddleware(handlers.CreateZoneHandler))
	mux.HandleFunc("GET /api/v1/routes", handlers.GetRoutesHandler)
	mux.HandleFunc("POST /api/v1/routes", middleware.AuthMiddleware(handlers.CreateRouteHandler))
	mux.HandleFunc("POST /api/v1/routes/{id}/rate", middleware.AuthMiddleware(handlers.RateRouteHandler))
	mux.HandleFunc("GET /api/v1/fauna-types", handlers.GetFaunaTypesHandler)
	mux.HandleFunc("POST /api/v1/fauna-types", middleware.AuthMiddleware(handlers.CreateFaunaTypeHandler))
	mux.HandleFunc("GET /api/v1/cycleways", handlers.GetCyclewaysHandler)

	// ── Rutas de Medios de Edificios e Indoor POIs ─────────────────────────
	mux.HandleFunc("GET /api/v1/zones/{id}/media", handlers.GetBuildingMediaHandler)
	mux.HandleFunc("POST /api/v1/zones/{id}/media", middleware.AuthMiddleware(handlers.CreateBuildingMediaHandler))
	mux.HandleFunc("GET /api/v1/zones/{id}/pois", handlers.GetIndoorPOIsHandler)
	mux.HandleFunc("POST /api/v1/zones/{id}/pois", middleware.AuthMiddleware(handlers.CreateIndoorPOIHandler))

	// ── Rutas de Colecciones y Ubicaciones (usuarios autenticados) ────────
	mux.HandleFunc("POST /api/v1/collections", middleware.AuthMiddleware(handlers.CreateCollectionHandler))
	mux.HandleFunc("GET /api/v1/collections", middleware.AuthMiddleware(handlers.GetCollectionsHandler))
	mux.HandleFunc("POST /api/v1/collections/locations", middleware.AuthMiddleware(handlers.SaveLocationHandler))
	mux.HandleFunc("GET /api/v1/collections/{id}/locations", middleware.AuthMiddleware(handlers.GetSavedLocationsHandler))

	// ── Rutas de Seguimiento (Follows) ───────────────────────────────────
	mux.HandleFunc("POST /api/v1/follows", middleware.AuthMiddleware(handlers.FollowCompanyHandler))
	mux.HandleFunc("DELETE /api/v1/follows/{id}", middleware.AuthMiddleware(handlers.UnfollowCompanyHandler))
	mux.HandleFunc("GET /api/v1/follows", middleware.AuthMiddleware(handlers.ListFollowedCompaniesHandler))

	// ── Rutas del Catálogo y Promociones ──────────────────────────────────
	if repo != nil {
		catalogHandler := catalog.NewHandler(repo.GetDB())
		mux.HandleFunc("POST /api/v1/branches/{id}/products", middleware.AuthMiddleware(catalogHandler.CreateProduct))
		mux.HandleFunc("GET /api/v1/branches/{id}/products", catalogHandler.ListProducts)
		mux.HandleFunc("POST /api/v1/branches/{id}/promotions", middleware.AuthMiddleware(catalogHandler.CreatePromotion))
	}

	// ── Rutas del Admin Panel ────────────────────────────────────────────
	// Login en 2 pasos (protegido con rate limiter)
	mux.HandleFunc("/admin/auth/login", middleware.AdminRateLimiter(handlers.AdminLoginHandler))
	mux.HandleFunc("/admin/auth/verify-2fa", middleware.AdminRateLimiter(handlers.AdminVerify2FAHandler))
	// Endpoints protegidos del panel (requieren JWT con scope admin)
	mux.HandleFunc("/admin/api/v1/me", middleware.AdminMiddleware(handlers.AdminMeHandler))
	mux.HandleFunc("/admin/api/v1/audit-log", middleware.AdminMiddleware(handlers.AdminAuditLogHandler))
	mux.HandleFunc("/admin/api/v1/kpis", middleware.AdminMiddleware(handlers.AdminKPIsHandler))
	mux.HandleFunc("/admin/api/v1/trends", middleware.AdminMiddleware(handlers.GlobalTrendsHandler))
	mux.HandleFunc("GET /admin/api/v1/companies", middleware.AdminMiddleware(handlers.AdminListCompaniesHandler))
	mux.HandleFunc("POST /admin/api/v1/companies/verify", middleware.AdminMiddleware(handlers.AdminUpdateCompanyVerificationHandler))
	mux.HandleFunc("GET /admin/api/v1/events", middleware.AdminMiddleware(handlers.AdminListEventsHandler))
	mux.HandleFunc("POST /admin/api/v1/events/delete", middleware.AdminMiddleware(handlers.AdminDeleteEventHandler))
	mux.HandleFunc("POST /admin/api/v1/events/live", middleware.AdminMiddleware(handlers.AdminToggleLiveEventHandler))
	mux.HandleFunc("POST /admin/api/v1/events", middleware.AdminMiddleware(handlers.AdminCreateEventHandler))
	mux.HandleFunc("POST /admin/api/v1/branches", middleware.AdminMiddleware(handlers.AdminCreateBranchHandler))
	mux.HandleFunc("GET /admin/api/v1/branches", middleware.AdminMiddleware(handlers.AdminListBranchesHandler))
	mux.HandleFunc("POST /admin/api/v1/branches/delete", middleware.AdminMiddleware(handlers.AdminDeleteBranchHandler))
	mux.HandleFunc("GET /admin/api/v1/zones", middleware.AdminMiddleware(handlers.AdminListZonesHandler))
	mux.HandleFunc("POST /admin/api/v1/zones/toggle", middleware.AdminMiddleware(handlers.AdminToggleZoneHandler))
	mux.HandleFunc("GET /admin/api/v1/fauna-types", middleware.AdminMiddleware(handlers.GetFaunaTypesHandler))
	mux.HandleFunc("POST /admin/api/v1/fauna-types", middleware.AdminMiddleware(handlers.CreateFaunaTypeHandler))
	mux.HandleFunc("POST /admin/api/v1/cycleways", middleware.AdminMiddleware(handlers.AdminSaveCyclewayHandler))
	mux.HandleFunc("POST /admin/api/v1/cycleways/delete", middleware.AdminMiddleware(handlers.AdminDeleteCyclewayHandler))

	// ── Google Places API sync ────────────────────────────────────────────
	mux.HandleFunc("POST /admin/api/v1/places/sync-google", middleware.AdminMiddleware(handlers.SyncGooglePlacesHandler))
	mux.HandleFunc("GET /admin/api/v1/places/external-stats", middleware.AdminMiddleware(handlers.GetExternalPlacesStatsHandler))

	// ── Rutas de Perfil de Ciudadano ─────────────────────────────────────
	mux.HandleFunc("GET /api/v1/profile/me", middleware.AuthMiddleware(handlers.GetMyProfileHandler))
	mux.HandleFunc("PATCH /api/v1/profile", middleware.AuthMiddleware(handlers.UpdateProfileHandler))
	mux.HandleFunc("POST /api/v1/profile/avatar", middleware.AuthMiddleware(handlers.UploadAvatarHandler))

	// ── Rutas de Usuarios Ciudadanos (búsqueda y seguimiento) ─────────────
	mux.HandleFunc("GET /api/v1/users/search", middleware.AuthMiddleware(handlers.SearchUsersHandler))
	mux.HandleFunc("GET /api/v1/users/{id}/profile", middleware.OptionalAuthMiddleware(handlers.GetPublicProfileHandler))
	mux.HandleFunc("POST /api/v1/users/{id}/follow", middleware.AuthMiddleware(handlers.FollowUserHandler))
	mux.HandleFunc("DELETE /api/v1/users/{id}/follow", middleware.AuthMiddleware(handlers.UnfollowUserHandler))
	mux.HandleFunc("POST /api/v1/search/history", middleware.AuthMiddleware(handlers.SaveSearchHistoryHandler))

	// Serve static SVG icons for both web and mobile
	svgDir := "./assets/svg"
	if _, err := os.Stat(svgDir); os.IsNotExist(err) {
		svgDir = "../app-turismo/assets/svg"
	}
	mux.Handle("/assets/svg/", http.StripPrefix("/assets/svg/", http.FileServer(http.Dir(svgDir))))

	// Serve uploaded avatars
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./uploads"))))

	// ── Ruta de prueba ───────────────────────────────────────────────────
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "¡Backend Go de Turismo funcionando!")
	})

	// Configurar CORS — solo orígenes permitidos (hardening de seguridad)
	allowedOrigins := map[string]bool{
		"https://admin.turismomap.com":    true,
		"https://turismomap.com":          true,
		"https://www.turismomap.com":      true,
		"https://api-turismo.broco.dev":   true,
		"https://app.broco.dev":           true,
	}
	if os.Getenv("ENV") == "development" {
		allowedOrigins["http://localhost:3000"] = true
		allowedOrigins["http://localhost:5173"] = true
		allowedOrigins["http://localhost:8082"] = true
	}
	c := cors.New(cors.Options{
		AllowOriginFunc: func(origin string) bool {
			return allowedOrigins[origin]
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Requested-With"},
		AllowCredentials: true,
		MaxAge:           300,
	})
	handler := middleware.SecurityHeadersMiddleware(
		middleware.RecoveryMiddleware(c.Handler(mux)),
	)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: handler,
	}

	// Canal para escuchar señales de parada del SO
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Servidor backend corriendo en http://localhost:%s\n", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Error iniciando el servidor: %v", err)
		}
	}()

	// Esperar señal de parada
	<-stop
	log.Println("Señal de parada recibida. Iniciando cierre ordenado...")

	// Cierre de conexiones del pool de bases de datos
	if repo != nil {
		if err := repo.Close(); err != nil {
			log.Printf("Error al cerrar el repositorio: %v\n", err)
		}
	}

	// Cerrar servidor HTTP con un timeout de 5 segundos
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Error durante el cierre del servidor HTTP: %v\n", err)
	}

	log.Println("Servidor backend cerrado exitosamente")
}
