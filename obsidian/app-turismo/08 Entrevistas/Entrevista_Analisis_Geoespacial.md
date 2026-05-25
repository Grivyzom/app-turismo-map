# 🗺️ Entrevista y Análisis Geoespacial: Requerimientos y Criterios de Diseño

Este documento recopila la entrevista simulada, el diagnóstico territorial y la toma de requerimientos desde la perspectiva de la **Ciencia de la Información Geográfica (GIScience)** y la **Geografía Humana y Física** aplicada a la comuna de Valdivia. Su objetivo es servir como base de criterios de aceptación para cada componente y diseño que desarrollemos en la plataforma.

---

## 🔬 Diagnóstico Territorial y Geoespacial

Valdivia no es una ciudad estándar; es una **ecosistema dinámico, fluvial y húmedo**. El diseño del software y su arquitectura de base de datos deben alinearse con las realidades físicas y humanas de este territorio.

### 1. El error clásico de los grados angulares (WGS84 vs UTM)
* **El Problema:** Al almacenar ubicaciones en PostGIS usando `GEOMETRY(Point, 4326)`, estamos guardando datos en coordenadas geográficas (latitud/longitud en grados decimales). Si un programador ejecuta funciones de distancia clásicas como `ST_Distance(geom1, geom2)` o consultas de proximidad rápidas, el resultado se devuelve en **grados angulares**. A la latitud de Valdivia (~39.8° S), la longitud de un grado es significativamente más corta que en el ecuador, distorsionando cualquier cálculo.
* **La Solución Informática/Geográfica:** 
  - Usar la columna tipo `GEOGRAPHY(Point, 4326)` para consultas nativas en metros de manera directa (ej. `ST_DWithin`).
  - O realizar conversiones dinámicas (proyección cartográfica) usando `ST_Transform(geom, 32718)` para proyectar a la cuadrícula plana local **UTM Huso 18 Sur (EPSG:32718)** al momento de hacer cálculos de áreas o buffers métricos de alta precisión.

### 2. La ilusión de la Distancia Euclidiana (Multimodalidad Fluvial)
* **El Problema:** Valdivia está fragmentada por ríos navegables y humedales urbanos (Río Calle-Calle, Río Valdivia, Río Cruces). Una distancia en línea recta de 200 metros entre la Costanera y el Museo de Arte Contemporáneo (MAC) en la Isla Teja representa una barrera física real que requiere cruzar un puente peatonal/vehicular congestionado (o dar una vuelta inmensa), o bien tomar una lancha solar.
* **La Solución Informática/Geográfica:** El motor de navegación no debe asumir una simple ruta de auto/caminata euclidiana lineal. Debemos modelar las conexiones como una red con soporte de transbordos fluviales (lanchas de transporte público fluvial) y cruce de puentes.

### 3. Atenuación del GPS bajo Dosel de la Selva Valdiviana (VGI y Tolerancia)
* **El Problema:** Senderos turísticos como los del Parque Oncol o la Reserva Pilunkura se encuentran bajo densas capas de vegetación (selva templada lluviosa). Bajo lluvia y dosel forestal, los receptores GPS de los teléfonos inteligentes sufren de atenuación de señal multitrayecto, disminuyendo la precisión espacial a rangos de ±20 a ±50 metros. Si la validación de un "Check-In" es muy estricta (ej. menor a 10 metros), el usuario fallará el proceso.
* **La Solución Informática/Geográfica:** Al enviar reportes o realizar check-ins, el cliente Expo debe capturar y enviar el parámetro `accuracy` (precisión en metros). El backend de Go debe adaptar dinámicamente el búfer espacial de validación `ST_DWithin` basándose en el margen de error real reportado por el dispositivo.

### 4. Sobrecarga de Pines (Pin Overload) en Mapas Interactivos
* **El Problema:** Representar visualmente cientos de marcadores geográficos individuales satura el motor de renderizado de React Native e introduce fatiga visual al usuario, impidiendo la lectura rápida de los patrones espaciales (Semiótica de Bertin).
* **La Solución Informática/Geográfica:** Implementar **agrupamientos espaciales (Clustering)** basados en rejillas discretas globales. La mejor opción de la industria es el sistema hexagonal **Uber H3** en el Backend en Go o algoritmos de clustering dinámicos en el mapa base para simplificar la información cartográfica según la escala/zoom.

---

## 🎙️ Cuestionario de Toma de Requerimientos y Criterios Técnicos

Este cuestionario sirve como marco regulatorio para el desarrollo de los próximos componentes:

### ❓ Requerimiento 1: Navegación y Ruteo Fluvial (`NavigationOverlay`)
* **Pregunta de Criterio:** ¿El planificador de rutas se limitará a trazar líneas rectas e indicaciones terrestres tradicionales de automóviles (vía Google Maps/OSRM estándar), o contemplará los muelles de transporte fluvial de Valdivia como nodos válidos de transferencia?
* **Criterio de Aceptación Geoespacial:** El componente debe, al menos en su fase avanzada, poder indicar al turista peatonal la existencia de un cruce fluvial en lancha si este disminuye el tiempo de viaje o mejora la experiencia escénica en comparación al desvío por los puentes vehiculares terrestres.

### ❓ Requerimiento 2: Tolerancia de Geolocalización en Check-Ins (`event_attendance`)
* **Pregunta de Criterio:** ¿Cómo evitará el backend rechazar falsos negativos cuando un turista intente hacer check-in en una zona boscosa o con mala cobertura GPS?
* **Criterio de Aceptación Geoespacial:** La consulta SQL en Go no usará un radio rígido (`ST_DWithin(geom1, geom2, 10)`). En su lugar, el endpoint recibirá la variable `accuracy` provista por el smartphone y calculará:  
  `ST_DWithin(geom_evento, geom_usuario, 15 + accuracy_usuario)`.  
  Esto flexibiliza el área de influencia de forma inteligente y científica.

### ❓ Requerimiento 3: Consumo de Datos Abiertos del Gobierno de Chile (Protocolos OGC)
* **Pregunta de Criterio:** ¿Nos limitaremos a digitalizar puntos a mano en nuestra base de datos, o dotaremos al servidor de Go de la capacidad de sincronizar y servir capas espaciales dinámicas desde servidores públicos de Chile?
* **Criterio de Aceptación Geoespacial:** Para delimitar humedales, parques nacionales y monumentos históricos (fuerte de Niebla, Corral), habilitaremos la integración en el backend/frontend para leer archivos GeoJSON o consumir servicios **WMS/WMTS/WFS** de la **IDE Chile** (Infraestructura de Datos Geoespaciales) y el **Ministerio del Medio Ambiente**.

### ❓ Requerimiento 4: Limpieza Cartográfica e Inteligencia Hexagonal (`Uber H3`)
* **Pregunta de Criterio:** ¿Cómo mitigaremos el lag de renderizado y el desorden de pines cuando se superpongan múltiples eventos en un área pequeña (ej. una feria costanera)?
* **Criterio de Aceptación Geoespacial:** Implementaremos agregación espacial. A niveles de zoom lejanos (zoom < 14), los eventos se sumarán y agruparán dentro de polígonos hexagonales dinámicos (Uber H3 resolución 8). Al hacer zoom profundo, el mapa transicionará de forma suave a pines individuales de alta resolución espacial.

### ❓ Requerimiento 5: Funcionamiento Desconectado en Reservas Naturales (`OfflineIndicator`)
* **Pregunta de Criterio:** ¿Cómo se comportará el mapa en senderos de la selva valdiviana sin acceso a internet?
* **Criterio de Aceptación Geoespacial:** El frontend en Expo no debe mostrar una pantalla en blanco o congelada. Debe usar teselas vectoriales almacenadas localmente en caché (Vector Tiles cache manager) y encolar las interacciones de guardados o reportes del usuario en una base de datos local SQLite (`AsyncStorage`/`SQLite` nativo) para sincronizarlas al recuperar señal mediante peticiones en ráfagas (*background sync*).

---

## 🛠️ Protocolos y Tecnologías Geoespaciales Seleccionadas

Para consolidar esta aplicación con un estándar premium de la industria SIG (Sistemas de Información Geográfica), se utilizarán las siguientes herramientas:

1. **PostGIS (Soporte Espacial):** Uso extensivo del tipo `geography` para geolocalización y cálculo de radios reales sobre el elipsoide WGS84.
2. **OSRM / Valhalla:** Motores de ruteo que permiten definir perfiles personalizados (peatonal, ciclista, navegación fluvial).
3. **Uber H3 (Spatial Indexing):** Biblioteca de indexación geoespacial hexagonal para optimizar búsquedas masivas, análisis de densidad de calor y agregación visual.
4. **Tile Server / MapLibre Native:** Para la carga eficiente de Vector Tiles estilizados con el tema *"Selva Valdiviana"* y soporte de descarga offline regional.
5. **OpenStreetMap Overpass API:** Como extractor automatizado de POIs base (restaurantes, farmacias, accesos a playas) para poblar la base de datos de Valdivia de forma orgánica.
