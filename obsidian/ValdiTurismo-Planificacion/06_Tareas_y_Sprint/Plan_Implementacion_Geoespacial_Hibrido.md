# 🗺️ Plan de Implementación: Arquitectura Geoespacial Híbrida (Valdivia)

Este plan de desarrollo técnico detalla la migración de nuestra infraestructura hacia un enfoque híbrido: **MapLibre** en el renderizado, **CARTO** como servidor de capas vectoriales complejas (humedales, trekking, riesgos), y **Google Places API REST** para búsqueda semántica e ingesta ágil de datos de valor comercial.

---

## 🛠️ Objetivos del Sprint

1. **Eficiencia de Costos:** Eliminar el renderizado pesado del SDK de Google Maps en móviles/web, reduciendo el cobro por visualización a prácticamente $0 USD.
2. **Premium Visuals (Wow Factor):** Lograr control cartográfico absoluto en MapLibre con las capas estilizadas vectoriales de CARTO (Selva Valdiviana, humedales, senderos).
3. **Optimización SIG (Ciencia de Información Geográfica):** 
   - Transicionar de cálculos rígidos a buffers dinámicos con `accuracy` de GPS en PostGIS.
   - Implementar caché de telemetría geoespacial en tiempo real con Redis GEO.

---

## 📐 Detalles del Flujo Técnico

El sistema operará bajo la siguiente secuencia cuando un usuario interactúe con el mapa:

```mermaid
graph TD
    %% Componentes
    CLIENT[App Expo / Web - MapLibre]
    GO[Backend API - Go]
    DB[(PostgreSQL + PostGIS)]
    RD[(Redis Cache GEO)]
    CART[Servidor CARTO Vector Tiles]
    GG[Google Places REST API]

    %% Flujos
    CLIENT -->|1. Pide Capas de Humedales / Caminos| CART
    CART -->|2. Retorna Vector Tiles MVT (Selva Valdiviana Style)| CLIENT

    CLIENT -->|3. Busca "Café Kunstmann"| GO
    GO -->|4. HTTP GET Request (No-Visual)| GG
    GG -->|5. Retorna Lat/Lng + Metadatos| GO
    GO -->|6. Guarda en DB / Cachea| DB
    GO -->|7. Retorna POI con Coordenadas| CLIENT
    CLIENT -->|8. Dibuja Pin circular customizado| CLIENT

    CLIENT -->|9. GPS Check-in (Lat, Lng, Accuracy)| GO
    GO -->|10. Consulta espacial ST_DWithin adaptativa| DB
    DB -->|11. Retorna Validación| GO
    GO -->|12. Confirma Asistencia| CLIENT
```

---

## 📂 Desglose de Componentes a Desarrollar

### 🗄️ Componente A: Infraestructura de Datos (PostGIS + Redis)
*   **Migración SQL:** Crear migración física para habilitar `CREATE EXTENSION IF NOT EXISTS postgis;` en PostgreSQL.
*   **Esquema de Tablas:**
    *   `events.geom` de tipo `GEOMETRY(Point, 4326)` con índice espacial `GiST` para búsquedas ultrarrápidas de eventos cercanos.
    *   `map_reports.geom` de tipo `GEOMETRY(Point, 4326)` con índice espacial `GiST` e integración en Redis GEO.
    *   `company_branches.geom` para comercios ingeridos desde Google Places.
*   **Integración en Redis:** Configuración de comandos `GEOADD` para capturar la telemetría rápida (reportes de tráfico, congestión de senderos) y `GEORADIUS` para búsquedas en vivo basadas en la escala de zoom.

### ⚙️ Componente B: Backend en Go (Módulos de Integración)
*   **`/api/v1/places/search`:** Módulo en Go que se conecta a Google Places API REST, ejecuta la búsqueda, almacena el resultado en PostGIS (para no repetir consultas idénticas) y retorna la metadata al frontend.
*   **`/api/v1/events/checkin`:** Endpoint que calcula la validez espacial del check-in. Formula:
    ```sql
    SELECT ST_DWithin(
        ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 
        geom::geography, 
        50 + ?
    );
    -- Los parámetros son: longitud_usuario, latitud_usuario, accuracy_usuario (en metros)
    ```
    *Esto resuelve el problema geográfico del follaje y el rebote de GPS bajo la lluvia valdiviana.*

### 📱 Componente C: Frontend en React Native / Expo (MapLibre)
*   **Capas vectoriales:** Modificar `MapLibreContainer.web.tsx` para cargar el estilo personalizado desde el servidor de CARTO.
*   **Custom Markers:** Usar el renderizado optimizado de pines para dibujar círculos del color de la categoría de interés con micro-animaciones (escala y pulso táctil) sobre las coordenadas devueltas por nuestro buscador en Go.
*   **Offline-First Cache:** Programar el buffer local en SQLite/AsyncStorage para almacenar en cola los reportes offline de senderos sin cobertura de red.

---

## 📋 Hito de Verificación y Criterio de Aceptación
1.  **Costo Cero por Carga:** El mapa debe cargarse y moverse libremente sin realizar peticiones de visualización a la consola de Google.
2.  **Tolerancia Adaptativa de Check-in:** Una simulación con `accuracy: 45` metros (dosel denso) debe validar correctamente al usuario si está a 60 metros físicos del centro del evento.
3.  **H3 / Clustering:** A zoom menor a 12, los pines de eventos deben agruparse fluidamente en polígonos consolidados.
