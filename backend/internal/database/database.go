package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Repository define la interfaz para interactuar con las conexiones de bases de datos.
type Repository interface {
	GetDB() *pgxpool.Pool
	GetCache() *redis.Client
	Close() error
}

// repoImpl es la implementación concreta de Repository.
type repoImpl struct {
	db    *pgxpool.Pool
	cache *redis.Client
}

// GetDB retorna el pool de conexiones de PostgreSQL.
func (r *repoImpl) GetDB() *pgxpool.Pool {
	return r.db
}

// GetCache retorna el cliente de Redis.
func (r *repoImpl) GetCache() *redis.Client {
	return r.cache
}

// Close realiza un cierre ordenado (graceful shutdown) de las conexiones.
func (r *repoImpl) Close() error {
	var errs []error

	if r.cache != nil {
		log.Println("Cerrando la conexión con Redis...")
		if err := r.cache.Close(); err != nil {
			errs = append(errs, fmt.Errorf("error al cerrar Redis: %w", err))
		}
	}

	if r.db != nil {
		log.Println("Cerrando el pool de conexiones de PostgreSQL...")
		r.db.Close()
	}

	if len(errs) > 0 {
		return fmt.Errorf("errores durante el cierre graceful: %v", errs)
	}

	log.Println("Conexiones de base de datos cerradas exitosamente")
	return nil
}

// NewRepository inicializa PostgreSQL (pgxpool) y Redis.
func NewRepository(ctx context.Context) (Repository, error) {
	dbPool, err := initPostgreSQL(ctx)
	if err != nil {
		return nil, fmt.Errorf("fallo al inicializar PostgreSQL: %w", err)
	}

	redisClient, err := initRedis(ctx)
	if err != nil {
		// Cerramos el pool de PG si Redis falla para evitar fugas de recursos
		dbPool.Close()
		return nil, fmt.Errorf("fallo al inicializar Redis: %w", err)
	}

	return &repoImpl{
		db:    dbPool,
		cache: redisClient,
	}, nil
}

// initPostgreSQL configura e inicializa el pool de conexiones pgxpool.
func initPostgreSQL(ctx context.Context) (*pgxpool.Pool, error) {
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "turismo_user")
	pass := getEnv("DB_PASSWORD", "grivyzom@100110")
	name := getEnv("DB_NAME", "app-turismo")
	sslMode := getEnv("DB_SSLMODE", "disable")

	// DSN en formato keyword/value compatible con pgx
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s", host, port, user, pass, name, sslMode)

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("error al parsear el DSN: %w", err)
	}

	// Configuración de concurrencia y límites del pool
	maxConns, _ := strconv.Atoi(getEnv("DB_MAX_CONNS", "50"))
	minConns, _ := strconv.Atoi(getEnv("DB_MIN_CONNS", "10"))
	config.MaxConns = int32(maxConns)
	config.MinConns = int32(minConns)

	// Tiempos de vida y reutilización de conexiones para alta concurrencia
	maxConnLifetime, err := time.ParseDuration(getEnv("DB_MAX_CONN_LIFETIME", "30m"))
	if err == nil {
		config.MaxConnLifetime = maxConnLifetime
	}
	maxConnIdleTime, err := time.ParseDuration(getEnv("DB_MAX_CONN_IDLE_TIME", "15m"))
	if err == nil {
		config.MaxConnIdleTime = maxConnIdleTime
	}
	healthCheckPeriod, err := time.ParseDuration(getEnv("DB_HEALTH_CHECK_PERIOD", "1m"))
	if err == nil {
		config.HealthCheckPeriod = healthCheckPeriod
	}

	// Inicialización del pool
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("error al crear el pool con la configuración dada: %w", err)
	}

	// Validamos la conexión inicial
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("error al verificar conexión ping con PostgreSQL: %w", err)
	}

	log.Printf("Pool de conexiones de PostgreSQL (pgxpool) inicializado. MaxConns: %d, MinConns: %d", maxConns, minConns)
	return pool, nil
}

// initRedis configura e inicializa el cliente de Redis v9.
func initRedis(ctx context.Context) (*redis.Client, error) {
	addr := getEnv("REDIS_ADDR", "localhost:6379")
	pass := getEnv("REDIS_PASSWORD", "")
	dbNum, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))

	poolSize, _ := strconv.Atoi(getEnv("REDIS_POOL_SIZE", "100"))
	minIdleConns, _ := strconv.Atoi(getEnv("REDIS_MIN_IDLE_CONNS", "10"))

	opts := &redis.Options{
		Addr:         addr,
		Password:     pass,
		DB:           dbNum,
		PoolSize:     poolSize,
		MinIdleConns: minIdleConns,
	}

	client := redis.NewClient(opts)

	// Validamos la conexión inicial
	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return nil, fmt.Errorf("error al conectar con Redis en %s: %w", addr, err)
	}

	log.Printf("Cliente de Redis inicializado en %s (PoolSize: %d, MinIdleConns: %d)", addr, poolSize, minIdleConns)
	return client, nil
}

// getEnv obtiene una variable de entorno o un valor por defecto.
func getEnv(key, defaultVal string) string {
	if val, exists := os.LookupEnv(key); exists && val != "" {
		return val
	}
	return defaultVal
}
