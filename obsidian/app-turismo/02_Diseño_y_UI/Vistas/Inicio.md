### Vista: `(home)/index.tsx` (Mapa Principal e Inicio)

La pantalla de **Inicio / Mapa** es el núcleo de la aplicación. Utiliza una filosofía de diseño llamada **Island Design**, en la cual una serie de "islas" y paneles flotantes con efectos de glassmorphism y translúcidos se superponen al mapa interactivo que ocupa la pantalla completa.

---

#### 1. Estructura de Capas (Z-Index Hierarchy)

1. **Capa 0: Mapa Base (`MapContainer`)** - El lienzo cartográfico interactivo que reacciona a gestos, renderiza los pines de interés, polilíneas de enrutamiento e información climática.
2. **Capa 1: Controles Unificados de Mapa (`unifiedControlsContainer`)** - Floating action buttons (FABs) agrupados verticalmente en la esquina inferior derecha.
3. **Capa 2: Barra Superior y Menú Lateral (`TopAppBar` / `smartSearch`)** - Barra que flota arriba de la interfaz y que se expande hacia el menú lateral izquierdo (Sidebar Island).
4. **Capa 3: Paneles Flotantes Secundarios (HUDs / Modales Contextuales)** - Información sobre el clima, telemetría, navegación de rutas o menú radial contextual.
5. **Capa 4: Hojas Detalladas / Modales Principales (`BottomSheet` / Modales)** - Fichas de eventos detallados, creador de eventos, selección de colecciones.

---

#### 2. Componentes Clave por Estado de Sesión

##### 🚫 Vista No Login (Visitante / Invitado)
En este estado, el usuario puede explorar el mapa pero tiene limitaciones para interactuar con datos que requieren persistencia.

* **Mapa Base (`MapContainer`)**:
  - Muestra eventos y puntos de interés de forma pasiva.
  - Permite hacer clic en pines para ver una previsualización de evento básica.
* **Barra de Búsqueda Inteligente (`SmartVoiceSearch`)**:
  - Ubicada en la barra superior. Permite escribir consultas o usar entrada de voz para filtrar eventos en el mapa.
* **Menú Lateral Pasivo (`TopAppBar` Sidebar Island)**:
  - **Pestañas Navegables**: Cambia de sección entre **Mapa**, **Novedades / Feed**, y **Comunidad / Foro**.
  - **Botón Ingresar**: Un botón prominente que redirige al usuario a la pantalla de autenticación unificada (`/ingresar`).
  - **Contextual Survey Widget**: Widget flotante de encuesta de satisfacción.
* **Controles Flotantes del Mapa (`unifiedControlsContainer`)**:
  - **Zoom**: Botón deslizante/flotante de nivel de zoom.
  - **Ubicarme (`MyLocationButton`)**: Centra el mapa en el GPS actual del usuario.
  - **Modo Táctico / Precisión**: Permite enfocar una ubicación con mira de precisión.
  - **Filtros rápidos (`tune` button)**: Despliega chips de filtro por categoría.
  - **Modo de Vista**: Selector para cambiar entre perfil *Ciudadano (Local)* y *Explorador (Turista)*.
* **Restricciones Activas**:
  - Al pulsar en guardar ubicación, crear evento, o abrir ruta personalizada, el sistema despliega un aviso (`showNotification('Inicia sesión...', 'warning')`) y redirige a la vista `/ingresar`.

##### 🔑 Vista Con Login (Usuario Autenticado)
Desbloquea el set completo de herramientas y añade componentes interactivos del perfil social y B2C/B2B.

* **Menú Lateral Activo (`TopAppBar` Sidebar Island)**:
  - **Avatar del Usuario**: Muestra el ícono de avatar de la cuenta activa. Abre un menú desplegable contextual (`SidebarSubmenu`) que contiene:
    - *Mi Perfil* (Redirige al tab del perfil del usuario).
    - *Configuración* (Abre modal de opciones de notificaciones push, sonidos, idioma y tema).
    - *Panel Administrativo* (Solo si cuenta con rol admin, redirige a `/admin/dashboard`).
    - *Panel de Negocios* (Solo si cuenta con rol de empresa, redirige a `/business/dashboard`).
    - *Cerrar Sesión* (Finaliza la sesión actual).
  - **Pestañas Adicionales**: Desbloquea la pestaña **Pasaporte / Guardados** (`PassportScreen`).
  - **Indicador de Personalización (`gift` icon)**: Aparece de forma llamativa si el usuario aún no completa la encuesta de preferencias del viaje redirigiendo a `/onboarding`.
  - **Bandeja de Notificaciones (`NotificationTray`)**: Activada por el botón de campana con indicador rojo en la base del Sidebar.
* **Interacciones Avanzadas**:
  - **Check-In Modal (`CheckInModal` / `EventCheckInSection`)**: Permite marcar asistencia presencial a un evento turístico utilizando geolocalización.
  - **Planificador de Rutas (`RouterHUD` / `NavigationOverlay`)**: Traza polilíneas óptimas en tiempo real hacia eventos o sectores específicos.
  - **Colecciones Personales (`SaveToCollectionModal`)**: Permite almacenar marcadores dentro de carpetas organizadas por el usuario.
  - **Creadores de Datos Geográficos (`CreatePointModal` / `CreateSectorModal` / `CoordsEditorHUD`)**: Habilitados para usuarios autenticados que desean reportar incidentes o agregar nuevos puntos turísticos.

---

#### 3. Ubicación Física de los Componentes en el Codebase

* **Página Principal (Routing)**:
  - [[(home)/index.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/app/(home)/index.tsx)]
  - [[(home)/styles.ts](file:///grivyzom/webs/app-turismo-map/app-turismo/app/(home)/styles.ts)] (Hojas de estilo premium de la pantalla principal)
  - [[(home)/useHomeScreenState.ts](file:///grivyzom/webs/app-turismo-map/app-turismo/app/(home)/useHomeScreenState.ts)] (Hook de gestión de estados del mapa, filtros, rutas y overlays)

* **Componentes del Canvas y Mapa**:
  - [[MapContainer.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/Map/MapContainer.tsx)] (Componente unificado que delega a las implementaciones móviles/web)
  - [[MapLibreContainer.web.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/Map/MapLibreContainer.web.tsx)] (Contenedor Web GL para alto rendimiento offline)
  - [[ArtisticMarker.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/Map/Markers/ArtisticMarker.tsx)] (Renderizador de pines con diseño personalizado)

* **Componentes del Sidebar y Header**:
  - [[TopAppBar.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/MapUI/Header/TopAppBar.tsx)] (Contenedor unificado del buscador y el sidebar)
  - [[SmartVoiceSearch.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/ui/SmartVoiceSearch.tsx)] (Input inteligente y procesador de voz artificial)
  - [[SidebarSubmenu.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/ui/SidebarSubmenu.tsx)] (Menú desplegable del perfil y herramientas)
  - [[NotificationTray.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/MapUI/NotificationTray.tsx)] (Panel de notificaciones persistentes)

* **Widgets de Información y HUDs**:
  - [[WeatherForecastWidget.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/MapUI/WeatherForecastWidget.tsx)] (Pronóstico climático local y alertas de viento/lluvia)
  - [[TelemetryHUD.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/MapUI/TelemetryHUD.tsx)] (Dashboard que monitorea la telemetría del mapa)
  - [[RouterHUD.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/MapUI/RouterHUD.tsx)] (Panel de instrucciones paso a paso para enrutamiento)
  - [[SectorConfigPanel.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/MapUI/SectorConfigPanel.tsx)] (Visualizador e inspector de zonas de la Selva Valdiviana)
