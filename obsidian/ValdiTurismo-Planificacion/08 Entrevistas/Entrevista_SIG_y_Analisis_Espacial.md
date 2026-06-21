# 📊 Entrevista y Análisis Espacial: SIG y Análisis de Telemetría

Este documento recopila la perspectiva del **Geógrafo especialista en SIG** y del **Analista Espacial**, incluyendo las definiciones técnicas del proyecto de turismo fluvial y de senderismo en Valdivia. Es una pieza clave para guiar el desarrollo de la Fase 1 (Migración e Infraestructura), Fase 2 (Backend en Go), Fase 3 (Interfaz Móvil) y Fase 4 (Inteligencia de Datos).

---

## 🌎 1. Opinión Profesional: Geógrafo Especializado en SIG

### Puntos Fuertes de la Arquitectura
1. **Stack Geoespacial Sólido:** El uso de PostgreSQL con la extensión **PostGIS** y el sistema de coordenadas `GEOMETRY(Point, 4326)` (WGS 84) es el estándar de oro de la industria. Permite realizar consultas espaciales rápidas e indexación mediante `GiST` en campos como `events.geom` y `map_reports.geom`.
2. **Enfoque en el Entorno Físico:** El *"Island Design"* respeta el mapa fluvial de Valdivia. El **WeatherWidget** predictivo en tiempo real conectado a OpenWeatherMap es vital para alertar sobre lluvias torrenciales en actividades de senderismo en la Selva Valdiviana.
3. **Información Geográfica Voluntaria (VGI):** Los usuarios actúan como sensores humanos de congestión y estado del entorno. El almacenamiento híbrido con **Redis GEO** permite procesar las alertas efímeras con tiempos de respuesta bajísimos (menos de 5 milisegundos).
4. **Resiliencia Offline-First:** El uso de caché local y la cola SQLite/AsyncStorage para encolar peticiones en zonas de "sombra" es excelente para el turismo de naturaleza en el sur de Chile.

### Recomendación de Crecimiento
* **Geometrías Complejas:** Actualmente, el modelo está limitado a `Puntos (Point)`. Si en el futuro queremos modelar áreas silvestres protegidas, humedales protegidos, o rutas de trekking extensas, debemos incorporar soporte para geometrías tipo **Polígonos (Polygon)** y **Líneas (LineString)**.

---

## 🛠️ 2. Toma de Requerimientos Funcionales y de Negocio

### 🎯 Contexto de Negocio y Dolor Principal
* **Dolor del Turista:** La frustración al explorar la ciudad o la selva sin datos de conectividad, perder tiempo en congestión fluvial/terrestre y carecer de información en tiempo real sobre senderos cerrados o eventos fluviales activos.

### 📋 Requerimientos Funcionales (RF)
* **RF-Geometría:** Para el MVP se trabajará **exclusivamente con Puntos de Interés (Pines/Marcadores)**. No se trazarán geocercas poligonales complejas para parques (como Oncol o la costa) en esta primera etapa.
* **RF-Ruteo:** Se deben **priorizar las rutas peatonales y de senderismo** por encima de las rutas vehiculares. El cálculo de navegación dinámica (`NavigationOverlay`) debe estar optimizado para el caminante y el ecoturista.
* **RF-Congestión:** El sistema de crowdsourcing debe capturar reportes rápidos de congestión urbana/fluvial y distribuirlos de inmediato a los clientes conectados a través de la caché de Redis.

---

## 🔬 3. Perspectiva del Analista Espacial

El análisis espacial se centra en el procesamiento matemático de los datos geoespaciales, la eficiencia topológica y el valor analítico derivado del movimiento y comportamiento del usuario.

### Análisis de la Eficiencia Técnica
1. **Optimización de Búsqueda:** La indexación espacial `GiST` es crucial para evitar el escaneo secuencial en búsquedas radiales de eventos.
2. **Procesamiento de Telemetría:** El uso de comandos Redis GEO (`GEOADD` y `GEORADIUS`) es ideal para la captura de reportes ciudadanos efímeros antes de su caducidad física.
3. **Inteligencia Espacial:** 
   * La tabla `map_activity_sessions` recolectará analíticas invaluables de comportamiento territorial mediante la detección de interacción con el mapa.
   * El filtrado mediante **Bounding Box (BBOX)** en el frontend asegura que el móvil se suscriba únicamente a los marcadores dentro del cuadrante visible en pantalla.
   * La función de **Mapa de Calor (Heatmap)** del panel de administración (B2G - Business to Government) permitirá proveer a las autoridades datos de flujo peatonal e interés turístico urbano en tiempo real.

---

## 📊 4. Parámetros Técnicos y Algorítmicos a Definir

Para la correcta programación del backend en Go (Fase 2) y el Motor de Recomendación (Fase 4), se deben definir los siguientes parámetros clave:

### 📐 Parámetro A: Tolerancia de Check-in Espacial
* **Definición:** Radio métrico de tolerancia para validar que el usuario está físicamente asistiendo a un evento (`POST /api/v1/events/checkin`).
* **Calibración Propuesta:** **50 a 100 metros**, considerando el margen de error del GPS bajo el dosel forestal y rebote de señal en la Selva Valdiviana. *Se sugiere capturar el parámetro `accuracy` para ajustar este buffer dinámicamente.*

### 🔍 Parámetro B: Radios de Búsqueda de Redis GEO
* **Definición:** El radio por defecto que alimenta al comando `GEORADIUS` en `/api/v1/reports/near` para mostrar alertas cercanas.
* **Calibración Propuesta:** Un radio de búsqueda dinámico que se ajuste según el **nivel de zoom** del mapa. A zooms bajos (vistas de ciudad), el radio de alerta es mayor (ej. 3 - 5 km); a zooms altos (vista de calle), el radio se reduce (ej. 500 m) para evitar contaminación visual.

### 🔲 Parámetro C: Umbrales de Clustering Visual
* **Definición:** Nivel de zoom a partir del cual el mapa Expo pasa de mostrar polígonos agrupados (clusters) a pines individuales detallados.
* **Calibración Propuesta:** 
  * **Zoom < 12:** Agrupación densa en clústeres.
  * **Zoom 12 a 15:** Transición híbrida (clústeres para POIs repetidos en la misma cuadra/muelle).
  * **Zoom > 15:** Visualización 100% individualizada con pines vectoriales.
