# Clasificación de Secciones, Vistas y Componentes del Software

Este documento proporciona un mapa completo y estructurado de la arquitectura visual y funcional del software. Clasifica cada sección, vista y componente del ecosistema, detallando su comportamiento y ubicación exacta en el código.

---

## 📱 1. Aplicación Universal / Frontend (`app-turismo`)

Construida con **React Native + Expo** utilizando **Expo Router** para navegación híbrida (Móvil y Web).

### 🚫 A. Vista No Login (Estado de Invitado / Público)
Permite a cualquier visitante explorar el mapa de la Selva Valdiviana y buscar de forma pasiva, pero restringe acciones interactivas que requieren almacenamiento.

#### Estructura Visual
```
[Pantalla Completa] Mapa Base (MapContainer)
       │
       ├───► [Superior Izquierda] Barra de Búsqueda Inteligente (SmartVoiceSearch)
       ├───► [Centro Izquierda] Menú Lateral de Navegación Pasivo (TopAppBar)
       │         └───► Pestaña Mapa
       │         └───► Pestaña Novedades (Feed)
       │         └───► Pestaña Comunidad (Foro)
       │         └───► Botón de Acceso Rápido ("Ingresar" -> /ingresar)
       │
       ├───► [Centro Derecha] Widget Meteorológico (WeatherForecastWidget)
       │
       ├───► [Inferior Derecha] Barra de Controles Unificados (unifiedControlsContainer)
       │         └───► Regulador de Zoom (ZoomSlider)
       │         └───► Ubicarme (MyLocationButton)
       │         └───► Selector de Modo Vista (Ciudadano / Turista)
       │         └───► Activar Modo Táctico / Precisión
       │         └───► Filtros de Categorías
       │
       └───► [Inferior Centro] HUD de Telemetría (TelemetryHUD)
```

#### Fichas y Componentes Activos en este Estado
* **`MapContainer`** (`src/components/Map/MapContainer.tsx`): Renderiza el canvas interactivo con los pines turísticos básicos.
  * **`ArtisticMarker`** (`src/components/Map/Markers/ArtisticMarker.tsx`): Pines estilizados.
  * **`StoreMarker`** (`src/components/Map/Markers/StoreMarker.tsx`): Pines para comercios.
  * **`FurnitureMarker`** (`src/components/Map/Markers/FurnitureMarker.tsx`): Pines de equipamiento urbano.
* **`TopAppBar`** (`src/components/MapUI/Header/TopAppBar.tsx`): Barra flotante lateral. En este estado, el avatar de perfil se sustituye por el botón de Login (`login` icon).
* **`SmartVoiceSearch`** (`src/components/ui/SmartVoiceSearch.tsx`): Búsqueda con procesamiento de lenguaje natural y voz.
* **`MyLocationButton`** (`src/components/MapUI/MyLocationButton.tsx`): Botón para centrado GPS.
* **`WeatherForecastWidget`** (`src/components/MapUI/WeatherForecastWidget.tsx`): Clima predictivo en tiempo real.
* **`TelemetryHUD`** (`src/components/MapUI/TelemetryHUD.tsx`): Monitoreo de rendimiento cartográfico.

---

### 🔑 B. Vista Con Login (Usuario Autenticado)
Desbloquea el perfil social, la capacidad de check-in, la creación de marcadores, rutas y la personalización del feed.

#### Estructura Visual
```
[Pantalla Completa] Mapa Base (MapContainer)
       │
       ├───► [Superior Izquierda] Barra de Búsqueda Inteligente (SmartVoiceSearch)
       ├───► [Centro Izquierda] Menú Lateral Activo (TopAppBar)
       │         └───► Pestañas: Mapa, Novedades (Feed), Pasaporte (Saved), Foro, Perfil
       │         └───► Avatar de Usuario (Abre SidebarSubmenu)
       │         │         └───► Mi Perfil / Configuración / Panel Admin / Panel Negocios / Cerrar Sesión
       │         └───► Botón de Notificaciones (Toggles NotificationTray)
       │         └───► Indicador "Personalizar" (Icono de regalo si está incompleto -> /onboarding)
       │
       ├───► [Superpuesto] Hojas de Ruta e Indicaciones (RouterHUD)
       ├───► [Modal] Creadores Geográficos (CreatePointModal / CreateSectorModal)
       ├───► [Modal] Panel de Registro y Colección (SaveToCollectionModal / CheckInModal)
       └───► [Lateral Derecho] Bandeja de Notificaciones (NotificationTray)
```

#### Fistas y Componentes Adicionales Desbloqueados
* **`FeedScreen`** (`src/screens/FeedScreen.tsx`): Vista social con posts, reseñas de rutas y eventos destacados en Valdivia.
* **`PassportScreen`** (`src/screens/PassportScreen.tsx`): Colecciones personales, lugares guardados, e historial de visitas (Pasaporte Turístico).
* **`ForumScreen`** (`src/screens/ForumScreen.tsx`): Foro comunitario con hilos de debate e información local sobre el estado de senderos.
* **`UserProfileScreen`** (`src/screens/UserProfileScreen.tsx`): Dashboard del usuario con estadísticas de contribución y nivel.
* **`CheckInModal`** (`src/components/ui/CheckInModal.tsx`) & **`EventCheckInSection`** (`src/components/MapUI/EventCheckInSection.tsx`): Validación de asistencia a eventos turísticos mediante geolocalización.
* **`SaveToCollectionModal`** (`src/components/ui/SaveToCollectionModal.tsx`): Modal para agregar marcadores a carpetas y listas personalizadas.
* **`RouterHUD`** (`src/components/MapUI/RouterHUD.tsx`): Planificador de rutas óptimas (Geo-Router).
* **`CreatePointModal`** / **`CreateSectorModal`** (`src/components/MapUI/CreatePointModal.tsx`): Creación de puntos de interés y demarcación de zonas (disponible para colaboradores).

---

### 💼 C. Panel y Rutas de Negocios (`/business`)
Portal exclusivo para comercios locales, proveedores de paseos fluviales, cerveceras y organizadores de eventos en Valdivia.

* **`/business/ingresar.tsx` (Autenticación B2B)**: Acceso, registro y recuperación corporativa.
* **`/business/dashboard.tsx` (Panel Principal de Negocio)**: Métricas de visualización, listado de campañas activas y gestión de eventos publicados.
* **`/business/create-event.tsx` (Creador de Eventos)**: Formulario interactivo con mapa embebido para georreferenciar actividades y promociones.
* **`/business/delimitar-zonas.tsx` (Geo-Vallas / Zonas de Cobertura)**: Herramienta espacial para trazar polígonos sobre el mapa determinando el área comercial del negocio.
* **`/business/geolocalizar.tsx` (Geolocalización en Tiempo Real)**: Seguimiento satelital para flotas de transporte fluvial o guías turísticos.

---

### 🛠️ D. Sandbox de Desarrollo (`/dev`)
Herramientas utilizadas para pruebas y simulaciones de rendimiento.

* **`/dev/index.tsx` (Panel de Control Dev)**: Switcher de telemetrías y simulación de red.
* **`/dev/mapa.tsx` (Mapa Sandbox)**: Mapa para pruebas de carga de clústeres de pines en 3D.
  * **`DevSimulatorHUD`** y **`DevToolbar`** (`src/components/MapUI/`): HUD flotante para inyectar telemetría falsa y probar transiciones.

---

## 🖥️ 2. Panel de Administración Web (`admin`)

Aplicación web Single Page Application (SPA) desarrollada en **React + Vite + TypeScript** para el control centralizado de la plataforma.

### Vistas y Páginas Administrativas (`admin/src/pages/`)
* **`LoginPage.tsx`**: Formulario de ingreso administrativo con credenciales encriptadas.
* **`TwoFactorPage.tsx`**: Verificación de seguridad mediante código de Doble Factor (2FA / TOTP).
* **`DashboardPage.tsx`**: Panel general de analítica (usuarios activos, reportes del foro, tráfico de red, estadísticas de geolocalización).
* **`MapPage.tsx`**: Panel SIG avanzado en pantalla completa para monitorizar incidentes en tiempo real, auditar sectores geográficos de Selva Valdiviana y verificar pines dudosos.
* **`CompanyPage.tsx`**: Gestor de verificación y aprobación de cuentas comerciales (`/business`).
* **`AuditLogPage.tsx`**: Historial de auditoría para registrar operaciones críticas realizadas por los administradores.
* **`SettingsPage.tsx`**: Configuración de variables globales del sistema, llaves de API externas y límites de rate-limiting.

---

## 🗄️ 3. Backend e Infraestructura (`backend`)

Servicio monolítico asíncrono y de alto rendimiento escrito en **Go (Golang)**.

### Módulos y Controladores Principales (`backend/handlers/`)
* **`auth_handler.go`**: Procesamiento de registro, login (JWT), 2FA, y roles de acceso (Guest, User, Business, Admin).
* **`event_handler.go`**: CRUD y búsquedas geoespaciales de eventos turísticos (utilizando consultas de proximidad espacial).
* **`route_handler.go`**: Generación y almacenamiento de rutas personalizadas del usuario.
* **`telemetry_handler.go`**: Recepción y procesamiento por WebSocket de las ubicaciones y métricas en tiempo real.
* **`weather_handler.go`**: Proxy de consultas climáticas con caché inteligente.
* **`database/` (Capa de Persistencia)**: Estructura de base de datos relacional PostgreSQL equipada con **PostGIS** para indexación espacial de geometrías (puntos, polilíneas, polígonos).
