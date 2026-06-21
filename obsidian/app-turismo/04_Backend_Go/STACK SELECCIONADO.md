# Backend Stack Seleccionado

## Core
- **Lenguaje:** Go 1.26.1
- **Router:** Standard Library `http.NewServeMux` (Minimalista y eficiente).
- **Base de Datos:** PostgreSQL 16+ con extensión **PostGIS**.
- **Caching & Rate Limiting:** Redis.

## Librerías Clave
- `github.com/jackc/pgx/v5`: Driver de PostgreSQL de alto rendimiento con soporte para pooling.
- `github.com/golang-jwt/jwt/v5`: Implementación de JSON Web Tokens para autenticación.
- `github.com/redis/go-redis/v9`: Cliente de Redis.
- `github.com/rs/cors`: Middleware para manejo de CORS.
- `golang.org/x/crypto`: Para hashing de contraseñas (Bcrypt).
- `google.golang.org/api`: Integración con servicios de Google.

## Arquitectura de Rutas (API v1)

### Públicas
- `/api/v1/weather`: Datos meteorológicos en tiempo real.
- `/api/v1/time`: Sincronización de hora del servidor.
- `/api/v1/survey`: Recolección de feedback de usuarios.

### Autenticación
- `/auth/google`: OAuth2 con Google.
- `/auth/register`: Registro de ciudadanos y socios propietarios.
- `/auth/login`: Autenticación local.

### Usuarios (Protegidas)
- `/api/v1/events/checkin`: Registro de visitas a eventos/lugares.
- `/api/v1/places/search`: Búsqueda espacial de puntos de interés.
- `/api/v1/recommendations`: Sugerencias personalizadas.
- `/api/v1/profile/preferences`: Gestión de intereses del usuario.
- `/api/v1/collections`: Gestión de listas personalizadas de lugares.

### Negocio & Catálogo
- `/api/v1/business/location`: Gestión de ubicación de empresas.
- `/api/v1/branches`: CRUD de sucursales.
- `/api/v1/branches/{id}/products`: Gestión de productos en catálogo.
- `/api/v1/branches/{id}/promotions`: Creación de promociones temporales.

### Administración (Protegidas con 2FA)
- `/admin/auth/login`: Paso 1 (Credenciales).
- `/admin/auth/verify-2fa`: Paso 2 (TOTP).
- `/admin/api/v1/audit-log`: Historial de acciones administrativas.
- `/admin/api/v1/kpis`: Métricas de negocio en tiempo real.
- `/admin/api/v1/trends`: Análisis de preferencias globales.
- `/admin/api/v1/companies`: Moderación y verificación de socios.
- `/admin/api/v1/zones`: Gestión de polígonos geoespaciales.

## Seguridad
- **JWT:** Tokens firmados con expiración.
- **2FA:** TOTP obligatorio para el rol de administrador.
- **Rate Limiting:** Protección contra fuerza bruta en auth.
- **Middlewares:** Recovery, Security Headers, Logging.
