# App Navbar Design Guide — Floating HUD (Isla Flotante Despegada)

Este documento describe el estándar de diseño y arquitectura de interfaz para la barra de navegación principal (`TopAppBar` / Floating HUD) sobre el visor cartográfico.

## Concepto General: Isla Flotante Despegada (Floating HUD)

En interfaces basadas en mapas interactivos, una barra anclada directamente al techo genera un corte rígido que encierra el visor. Despegarla del marco (con margen superior y lateral) crea una jerarquía espacial tridimensional: el mapa se percibe infinito corriendo por debajo y la barra actúa como una **consola de navegación suspendida** (estilo Apple Maps o Mapbox).

---

## 1. Principios UX Aplicados al Mapa

* **Densidad contra Ruido Cartográfico:** Calles, etiquetas y capas satelitales compiten visualmente con los textos. Se utiliza una opacidad de `0.85` (`rgba(9, 15, 14, 0.85)`) y `blur(20px)` para máxima legibilidad sin perder la sensación de cristal reflectante.
* **Luz Direccional (Specular Rim):** Se sustituyen los bordes planos por un borde superior tenue (`rgba(255, 255, 255, 0.14)`) y un borde inferior imperceptible (`rgba(255, 255, 255, 0.04)`). Simula la refracción cenital sobre cristal.
* **Geometría Unificada:** Radio de cápsula de `18px` para el contenedor completo y radios proporcionales de `9px`–`10px` para controles internos.
* **Gestión de Espacio Móvil (375–390px):** El isotipo/badge de la marca (`32x32px`) se muestra aislado en anchos pequeños, colapsando el texto de marca y reuniendo herramientas secundarias en un botón de desbordamiento (`⋮`).

---

## 2. Especificación Técnica de la Isla (`navIsland`)

* **Contenedor wrapper (`topBarWrapper`):** `position: absolute`, `top: 0`, `left: 0`, `right: 0`, `pointerEvents: 'box-none'` (permite interactuar con el mapa libremente en áreas no cubiertas por la isla).
* **Dimensiones de la Isla:**
  * Altura: `52px`
  * Márgenes: `marginHorizontal: 12px`, `marginTop: Platform.OS === 'ios' ? 52px : (web ? 12px : 16px)`
  * Radio: `borderRadius: 18px`
  * Padding: `paddingHorizontal: 10px`
* **Superficie y Cristal:**
  * Fondo: `rgba(9, 15, 14, 0.85)`
  * Desenfoque: `backdropFilter: 'blur(20px)'`
  * Borde superior: `1px solid rgba(255, 255, 255, 0.14)`
  * Borde inferior: `1px solid rgba(255, 255, 255, 0.04)`
  * Bordes laterales: `1px solid rgba(255, 255, 255, 0.07)`
  * Sombra Web: `box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.45)`
  * Sombra iOS: `shadowRadius: 12`, `shadowOpacity: 0.35`, `shadowOffset: { width: 0, height: 8 }`
  * Elevación Android: `elevation: 8`

---

## 3. Elementos Internos

* **Botones de Icono (`iconBtn`):** `34x34px`, `borderRadius: 10px`, fondo `rgba(255, 255, 255, 0.05)`, borde `rgba(255, 255, 255, 0.06)`. Estado activo: fondo `rgba(52, 211, 153, 0.18)`, borde `rgba(52, 211, 153, 0.40)`.
* **Buscador (`searchBox`):** `height: 34px`, `borderRadius: 10px`, colapsable a botón cuadrado o expandible con sugerencias predictivas.
* **Selector de Modos (`modeGroup`):** Contenedor píldora `borderRadius: 11px`, fondo `rgba(0, 0, 0, 0.35)`, botones internos con indicador deslizante (`borderRadius: 9px`).
* **Botón de Autenticación (`navAuthButton`):** `height: 34px`, fondo sólido verde Selva `#34D399`, texto contrastado `#06281E` (`fontWeight: 800`).
