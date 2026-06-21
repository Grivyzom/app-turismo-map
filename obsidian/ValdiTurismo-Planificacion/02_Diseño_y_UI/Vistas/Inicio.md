### Vista: `/inicio` (Inicio / Pantalla Principal del Mapa)

La pantalla de **Inicio / Mapa** es el núcleo del ecosistema de ValdiTurismo. Adopta una filosofía de **Island Design**, donde múltiples "islas" visuales y paneles flotantes translúcidos (con efectos de glassmorphism) se superponen a un mapa interactivo a pantalla completa.

Según el rol y estado del usuario, la interfaz se adapta ofreciendo cuatro variantes principales de Inicio:

---

### 💼 A. Vista Normal (Ciudadano / Turista)

Es la pantalla principal para los usuarios finales (visitantes sin login, turistas registrados y ciudadanos locales).

**1. Capa Base: Lienzo Cartográfico (`MapContainer`)**
- **Mapa Interactivo:** Renderizado cartográfico base adaptado para móvil y web offline/online.
- **Pines Artísticos (`ArtisticMarker` / `StoreMarker` / `FurnitureMarker`):** Iconos de puntos de interés turístico, comercios y mobiliario urbano.
- **Visualizador de Trazados:** Renderizado de rutas, senderos y capas espaciales (ej. polilíneas de enrutamiento).

**2. Barra Superior Flotante (`TopAppBar`)**
- **Buscador por Voz Inteligente (`SmartVoiceSearch`):** Barra de búsqueda con soporte de dictado por voz y procesamiento de lenguaje natural.
- **Botón de Menú:** Despliega el menú lateral izquierdo (*Sidebar Island*).

**3. Menú Lateral Izquierdo (*Sidebar Island*)**
- **Control de Acceso / Avatar:**
  - *Estado Visitante:* Botón prominente de **"Ingresar"** (redirige a `/inicio` de login).
  - *Estado Con Login:* Avatar del usuario que despliega un submenú contextual (`SidebarSubmenu`) con enlaces a *Mi Perfil*, *Configuración*, *Panel Admin/Negocios* (si aplica) y *Cerrar Sesión*.
- **Indicador de Onboarding (`gift` icon):** Llamado a la acción interactivo que invita al usuario a completar su encuesta de preferencias para personalizar el feed (apunta a `/onboarding`).
- **Navegación por Pestañas:**
  - *Mapa:* Vista del mapa actual.
  - *Novedades (Feed):* Últimas noticias, publicaciones y reseñas turísticas locales.
  - *Comunidad (Foro):* Espacio de interacción y consultas de la comunidad.
  - *Pasaporte / Guardados (Solo con Login):* Lugares y rutas guardadas para acceso offline.
- **Bandeja de Notificaciones (`NotificationTray`):** Icono de campana con indicador de alertas pendientes.

**4. Controles del Mapa (`unifiedControlsContainer` - Flotantes a la Derecha/Inferior)**
- **Regulador de Zoom (`ZoomSlider`):** Barra deslizadora vertical para ajustar el nivel de acercamiento.
- **Ubicarme (`MyLocationButton`):** Botón de centrado automático utilizando geolocalización GPS.
- **Modo Táctico / Precisión:** Activador de una mira de precisión para ubicar coordenadas exactas.
- **Chips de Filtros Rápidos:** Botón de ajuste (`tune`) que despliega filtros temáticos (naturaleza, gastronomía, hospedaje, etc.).
- **Selector de Perfil (Ciudadano / Turista):** Switcher que adapta el tipo de información y los puntos de interés mostrados en el mapa según el perfil de viaje.

**5. HUD de Telemetría (`TelemetryHUD` - Central Inferior)**
- Panel flotante que muestra información en tiempo real sobre la navegación y estado cartográfico.

**6. Componentes e Instrumentos Contextuales (Modales y BottomSheets)**
- **Widget Climatológico (`WeatherForecastWidget`):** Pronóstico meteorológico local con alertas de lluvia y viento para Valdivia.
- **Planificador de Rutas (`RouterHUD` / `NavigationOverlay`):** Guía visual paso a paso de rutas óptimas seleccionadas.
- **Ficha de Detalle de Evento (`BottomSheet`):** Panel deslizable desde la parte inferior con detalles del punto o evento seleccionado.
- **Modal de Check-In (`CheckInModal`):** Permite verificar la asistencia de forma geolocalizada en eventos turísticos.
- **Modal de Guardar en Colección (`SaveToCollectionModal`):** Organiza los marcadores en listas y carpetas del usuario.

---

### ✍️ B. Vista Independiente (Periodistas, Creadores y Guías)

Diseñada para profesionales que generan contenido y reportes sobre eventos, paseos, y noticias en terreno.

**1. Estructura Visual Adaptada**
- Mantiene la base del mapa de la Vista Normal pero oculta el panel de gestión multi-sucursal corporativo.

**2. Menú Lateral Personalizado**
- **Avatar Verificado:** Muestra la insignia oficial de verificación (Check Azul o Megáfono) junto al perfil.
- **Pestaña "Mis Emisiones":** Feed de control para gestionar publicaciones propias, noticias y rutas creadas.
- **Estadísticas de Impacto:** Widget rápido que muestra visualizaciones, me gusta y reportes guardados por otros usuarios sobre su contenido.

**3. Creadores de Datos Geográficos Activos**
- **Creador de Puntos de Interés (`CreatePointModal`):** Herramienta para reportar noticias geolocalizadas o incidentes.
- **Creador de Rutas Turísticas (`CoordsEditorHUD`):** Panel para grabar y trazar rutas guiadas en tiempo real mientras el creador recorre un sendero o río.

---

### 💼 C. Vista Business (Negocios y Comercios - `/business/dashboard`)

Panel de control B2B orientado a dueños de locales comerciales, hospedajes, gastronomía, y transporte fluvial.

**1. Dashboard Central de Negocio (`/business/dashboard`)**
- **Métricas de Rendimiento:** Gráficos analíticos que muestran el flujo de visitas a sus pines, interacciones de clientes y efectividad de promociones.
- **Listado de Campañas:** Control rápido de eventos y promociones vigentes.

**2. Menú Lateral de Negocios**
- **Logotipo de Empresa:** Con el indicador de verificación comercial de la plataforma.
- **Pestaña "Mis Sucursales":** Control de ubicaciones físicas asociadas al negocio.
- **Mi Equipo (Gestión de Staff):** Panel de envío y monitoreo de invitaciones seguras (`invitations`) para dar de alta a trabajadores.
- **Sección de Acceso a Herramientas Especiales:**
  - *Creador de Eventos (`/business/create-event.tsx`):* Formulario con mapa interactivo para posicionar promociones.
  - *Delimitar Zonas (`/business/delimitar-zonas.tsx`):* Editor espacial para trazar polígonos del área comercial/cobertura sobre el mapa.
  - *Geolocalizar en Tiempo Real (`/business/geolocalizar.tsx`):* Seguimiento en vivo de transporte o guías de la empresa.

---

### 🛠️ D. Vista Dev (Sandbox de Desarrollo - `/dev`)

Interfaz técnica para depuración, simulaciones y optimización del ecosistema cartográfico.

**1. Panel de Control Dev (`/dev/index.tsx`)**
- **Consola de Simulación:** Switcher para activar fallos de red, simular latencia de red (WebSocket) y apagar caché del servidor.

**2. Sandbox Cartográfico (`/dev/mapa.tsx`)**
- **Simulador de Carga Extrema:** Renderizador de pines 3D con generación masiva de clústeres artificiales para pruebas de estrés.
- **Barra de Herramientas Dev (`DevToolbar`):** Conjunto de FABs para disparar eventos automáticos de prueba.
- **HUD de Telemetría Extendido (`DevSimulatorHUD`):** Monitor flotante con lectura de FPS, consumo de memoria de renderizado y tiempos de respuesta de la API.
