# Especificaciones Técnicas de Analytics y Recomendaciones

Documentación técnica de los endpoints y lógica de implementación para los algoritmos de análisis.

## Endpoints de API

### 1. Global Trends
- **Ruta:** `GET /admin/api/v1/trends`
- **Middleware:** `AdminMiddleware` (Requiere rol admin/superadmin)
- **Handler:** `handlers.GlobalTrendsHandler` (en `backend/handlers/analytics_handler.go`)
- **Respuesta:** Objeto `GlobalTrends` que incluye top categorías, estilos de viaje, duraciones y tipos de perfil.

**SQL Principal (Categorías):**
```sql
SELECT cat, COUNT(*) 
FROM citizen_profiles, 
jsonb_array_elements_text(preferences->'categories') AS cat 
GROUP BY cat 
ORDER BY count DESC 
LIMIT 10
```

### 2. Recomendaciones
- **Ruta:** `GET /api/v1/recommendations`
- **Middleware:** `AuthMiddleware` (Requiere usuario autenticado)
- **Handler:** `handlers.RecommendationsHandler` (en `backend/handlers/recommendations_handler.go`)
- **Respuesta:** `PlacesResponse` con una lista de hasta 10 lugares y eventos aleatorios basados en el algoritmo.

## Lógica del Algoritmo de Recomendación (Go)

1.  **Identificación de Intereses:**
    *   Se extraen las categorías del `citizen_profiles` del usuario.
    *   Si no existen, se ejecuta una subconsulta para encontrar las categorías más frecuentes en toda la base de datos (Global Trends).
2.  **Consulta Híbrida (Lugares + Eventos):**
    *   Se realiza un `UNION ALL` entre `company_branches` y `events`.
    *   Se filtran eventos cuya `end_time` sea mayor a `NOW()`.
    *   Se filtran por `category = ANY($1)` donde `$1` es el array de categorías identificadas.
    *   Se utiliza `ORDER BY RANDOM()` para variar las sugerencias en cada carga.

## Modelos Relacionados (`models/models.go`)
- `CategoryTrend`: Representa un par categoría-conteo.
- `GlobalTrends`: Estructura agregada para la respuesta de analítica.
- `Place`: Modelo estándar para lugares y eventos (reutilizado de `places_handler.go`).
