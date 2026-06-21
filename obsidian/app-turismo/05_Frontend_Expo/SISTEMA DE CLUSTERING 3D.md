# Sistema de Clustering 3D y Nivel de Detalle (LOD)

Este documento describe la arquitectura, decisiones de diseño y funcionamiento técnico del sistema de agrupamiento de eventos (clustering) y gestión de visualización en el mapa interactivo (MapLibre Web).

---

## 1. El Problema del Relieve 3D (Pitch) y superposición de capas
Originalmente, los clusters y marcadores se renderizaban como elementos HTML del DOM (`maplibregl.Marker`). Sin embargo, esto presentaba tres problemas críticos en la visualización tridimensional:
1. **Pérdida de proyección plana (Efecto Sinking):** Al inclinar el mapa (pitch/tilt) para ver el relieve en 3D, los marcadores HTML flotaban o se hundían visualmente debajo del mapa, rompiendo la ilusión de profundidad y la precisión espacial.
2. **Oclusión por capas dinámicas:** Las capas poligonales y sectores geográficos cargados dinámicamente después de la inicialización se dibujaban por encima de los marcadores, ocultándolos.
3. **Colisiones y superposición:** Cuando muchos eventos de diferentes categorías coincidían en la misma coordenada, los pines se encimaban de manera desordenada.

---

## 2. Solución Arquitectónica: Renderizado Nativo WebGL
Para lograr que los clusters se queden "estampados en el suelo" y se comporten de forma correcta ante la perspectiva 3D, se rediseñó el flujo en [MapLibreContainer.web.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/Map/MapLibreContainer.web.tsx):

*   **Migración a Capas WebGL:** Los clusters ya no usan elementos DOM HTML. En su lugar, se inyectan directamente en el canvas WebGL del mapa mediante un origen GeoJSON dinámico (`clusters-source`) y dos capas nativas de MapLibre:
    *   `cluster-circles` (Capa de tipo `circle`): Dibuja el fondo circular del cluster.
    *   `cluster-labels` (Capa de tipo `symbol`): Dibuja el texto con el conteo de eventos dentro del cluster.

*   **Alineamiento al Mapa (Pitch Alignment):**
    Para fijar los elementos a la superficie del mapa y evitar que floten durante la inclinación, se configuraron propiedades clave de alineación:
    ```json
    paint: {
      "circle-pitch-alignment": "map"
    }
    ```
    Y para las etiquetas numéricas de los clusters:
    ```json
    layout: {
      "text-pitch-alignment": "map",
      "text-rotation-alignment": "map"
    }
    ```
    Esto garantiza que tanto el círculo como el número cambien de perspectiva y roten de forma solidaria con el plano de la tierra.

---

## 3. Algoritmo de Agrupamiento y LOD (`clusterUtils.ts`)
El backend del agrupamiento se gestiona en [clusterUtils.ts](file:///grivyzom/webs/app-turismo-map/app-turismo/src/utils/clusterUtils.ts) utilizando un hook reactivo con la biblioteca **Supercluster** (indexación espacial basada en QuadTree):

### A. Nivel de Detalle (LOD Tiers)
Dependiendo del nivel de zoom actual, se filtran de antemano los tipos de eventos visibles para no saturar el rendimiento del navegador:
1.  **LOD 1 (Zoom Lejano - `< 11`):** Solo se muestran eventos críticos y emergencias (`choque`, `incendio`, `accidente`, `calle_cortada`, `coliseo`, `puerto`, `fauna`).
2.  **LOD 2 (Zoom Medio - `11 <= zoom < 14`):** Se añaden puntos culturales y de esparcimiento (`cultura`, `naturaleza`, `publico`, `museo`, `teatro`, `deportes`, `tienda`).
3.  **LOD 3 (Zoom Cercano - `>= 14`):** Se muestran todos los pines (incluyendo gastronomía y música).

> [!NOTE]
> Las embarcaciones (`embarcacion`) son una excepción al sistema de clustering y LOD: siempre se muestran de manera individual y con un marcador dinámico en tiempo real que emula una estela de agua en movimiento.

### B. Configuración de Supercluster
El motor se configura con un radio de colisión incrementado para prevenir que los clusters y sus etiquetas colisionen entre sí:
*   **Radio:** `100` píxeles (optimizado desde 60 para evitar solapamientos visuales).
*   **Zoom Máximo de Agrupación:** `18` (a partir de este zoom, los eventos se disuelven en pines individuales).

### C. Sistema de Anticolisión en Zooms Altos (Decluttering)
Cuando el usuario se acerca a zooms muy altos (`zoom >= 17`), el clustering tradicional se apaga. En su lugar, se activa un algoritmo de **Decluttering** personalizado:
1.  Se asigna un peso a cada categoría (`CATEGORY_WEIGHTS`), priorizando emergencias (peso 100) sobre entretenimiento (peso 70) o gastronomía (peso 40).
2.  Se calcula la distancia en píxeles aproximada en pantalla entre pines vecinos.
3.  Si dos pines se encuentran a menos de `COLLISION_TOLERANCE_PIXELS = 45`, el de menor peso se oculta automáticamente.

---

## 4. Sincronización y Color Dinámico

### A. Color Dominante
Los clusters se pintan con un anillo exterior correspondiente al color de la categoría de eventos mayoritaria dentro de ese grupo. Esto se calcula mediante `getClusterDominantColor()`, analizando las frecuencias de categorías presentes en las hojas (leaves) del cluster.

### B. Cálculo del Centroide Real para Zoom y Navegación
Al hacer clic en un cluster nativo, en lugar de centrar el zoom en las coordenadas aproximadas del cluster (que varían según el algoritmo de Supercluster), se calcula el **centroide geométrico real** de los eventos contenidos:
$$\text{Centroide Lat} = \frac{1}{n} \sum_{i=1}^n \text{Lat}_i, \quad \text{Centroide Lng} = \frac{1}{n} \sum_{i=1}^n \text{Lng}_i$$
Esto proporciona una transición de cámara (`easeTo`) sumamente fluida e intuitiva hacia el centro real del grupo de puntos.

---

## 5. Control de Capas y Z-Index (Orden de Renderizado)
Dado que las capas dinámicas como sectores, polígonos irregulares y ciclovías se sincronizan en momentos distintos sobre el mapa, por defecto WebGL podría renderizarlas encima de los clusters.

Para solucionar esto de manera determinista, al final de cada función de sincronización:
*   `sync()` (Pines y eventos generales)
*   `syncZones()` (Polígonos de sectores y comunas)
*   `syncCycleways()` (Ciclovías)

Se invoca explícitamente el reordenamiento de capas utilizando `map.moveLayer()`:
```typescript
if (map.getLayer('cluster-circles')) map.moveLayer('cluster-circles');
if (map.getLayer('cluster-labels')) map.moveLayer('cluster-labels');
```
Esto fuerza a que el canvas WebGL siempre dibuje las capas de clusters al final de todo el stack de renderizado, garantizando que permanezcan visibles en el tope superior del mapa.
