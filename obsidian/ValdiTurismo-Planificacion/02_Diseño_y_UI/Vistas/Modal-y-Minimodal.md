### Componentes: Modales y MiniModales

En el diseño e interfaz (Island Design) de ValdiTurismo, la interacción con pines, creación de contenido y gestiones del usuario se dividen en dos categorías principales de contenedores flotantes: **Modales Principales** (pantalla completa o BottomSheets de alta densidad de datos) y **MiniModales** (tarjetas flotantes contextuales de lectura rápida).

---

### 🔲 1. El Modal Principal (Modales del Sistema)

Los Modales Principales se utilizan para flujos de trabajo específicos que requieren que el usuario ingrese datos, confirme acciones críticas o visualice información detallada.

#### A. Modal de Guardar en Colección (`SaveToCollectionModal.tsx`)
- **Ubicación:** [[SaveToCollectionModal.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/ui/SaveToCollectionModal.tsx)]
- **Función:** Permite guardar un marcador, punto o ruta en una carpeta o colección personalizada del usuario.
- **Componentes Internos:**
  - Selector de carpeta/colección con scroll.
  - Botón de crear nueva carpeta de colección.
  - Checkbox para marcar múltiples colecciones simultáneamente.
  - Botón de confirmación ("Guardar") y cancelar.

#### B. Modal de Check-in (`CheckInModal.tsx` & `EventCheckInSection.tsx`)
- **Ubicación:** [[CheckInModal.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/ui/CheckInModal.tsx)] y [[EventCheckInSection.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/MapUI/EventCheckInSection.tsx)]
- **Función:** Registra la presencia física del ciudadano en un evento de interés turístico utilizando geolocalización.
- **Componentes Internos:**
  - Animación de éxito/validación.
  - Indicador de estado de la geocerca (si el usuario está dentro del radio permitido).
  - Información de recompensas/puntos acumulados en el "Pasaporte Turístico".
  - Botón de compartir en redes sociales.

#### C. Modal de Creación de Punto de Interés (`CreatePointModal.tsx`)
- **Ubicación:** [[CreatePointModal.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/MapUI/CreatePointModal.tsx)]
- **Función:** Formulario completo para reportar o añadir un nuevo punto de interés en el mapa (disponible para socios, creadores y ciudadanos autorizados).
- **Componentes Internos:**
  - Selector de Categorías (Punto histórico, Naturaleza, Emergencia, Fauna, Tienda).
  - Campos de entrada: Título, descripción, horarios, organizador y dirección.
  - Subida/Previsualización de Imagen.
  - Modificador de coordenadas (georreferenciación).

#### D. Modal de Creación de Sector / Geo-vallas (`CreateSectorModal.tsx`)
- **Ubicación:** [[CreateSectorModal.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/MapUI/CreateSectorModal.tsx)]
- **Función:** Permite dibujar, delimitar y nombrar polígonos correspondientes a áreas comerciales, reservas naturales o sectores de búsqueda en la Selva Valdiviana.
- **Componentes Internos:**
  - Formulario de metadatos de sector (nombre, tipo, color del trazo).
  - Controles de dibujo sobre el mapa (añadir/eliminar vértices).

---

### 🖼️ 2. El MiniModal (Informative Landmarks & Pins)

El `MiniModal` es una tarjeta compacta, interactiva y dinámica que se renderiza directamente sobre el marcador de mapa seleccionado o como un overlay flotante contextual rápido en la parte inferior. Evita la saturación visual abriendo una previsualización de información clave sin salir de la pantalla del mapa.

- **Ubicación:** [[MiniModal.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/src/components/Map/Markers/MiniModal.tsx)] e integrado en la UI principal como `miniModalContainer` en [[index.tsx](file:///grivyzom/webs/app-turismo-map/app-turismo/app/(home)/index.tsx)].
- **Filtro de Activación:** Se activa automáticamente al interactuar con categorías específicas de lectura rápida como:
  - Fauna (`fauna`)
  - Tiendas/Comercios (`tienda`)
  - Hospitales (`hospital`)
  - Bomberos (`bombero`)
  - Carabineros (`carabinero`)
  - Cámaras de vigilancia (`camara`)

#### Estructura y Componentes del MiniModal:

**1. Cabecera/Banner Contextual (`miniBannerContainer`)**
- **Imagen de Banner / Miniatura (`Image` / `miniBannerImage`):** Foto representativa del landmark o tienda.
- **Placeholder Temático:** En caso de no tener imagen, se muestra un color de fondo plano según la categoría con un icono central representativo (ej. una huella de patita para fauna, cruz para hospital).
- **Insignia Oficial (`miniBadge`):** Texto flotante de clasificación (ej. *"LANDMARK PATRIMONIAL"*).
- **Botón de Cerrar Rápido (`miniCloseButton`):** Icono de cruz para salir del estado enfocado.

**2. Sección de Contenido e Información Rápida (`miniContent`)**
- **Título principal (`miniTitle`):** Nombre del punto de interés en negrita.
- **Ubicación descriptiva (`miniOrganizer`):** Dirección o referencia espacial del landmark (ej. *"📍 Feria Fluvial"*).
- **Texto descriptivo adaptable (`miniDescription`):** Texto corto que se expande verticalmente si el usuario hace clic.
- **Indicador de Horario Comercial (`statusRow`):** Muestra un círculo de color dinámico (verde para *Abierto*, rojo para *Cerrado*) junto a los horarios de atención.

**3. Rejilla de Metadatos Rápidos (`miniMetaGrid`)**
- Iconos mínimos y datos del horario o dirección (ej. Calendario, Distancia).

**4. Panel de Acciones Integradas (`miniActionRow` / `actionsRow`)**
- **Botón "Cómo llegar" (`miniPrimaryBtn` / `actionButton`):** Redirecciona a la aplicación nativa de mapas del dispositivo (Google Maps o Apple Maps) utilizando las coordenadas de latitud y longitud.
- **Botón de Contacto Rápido / Chat:** Abre un chat por WhatsApp (en el caso de tiendas) o un enlace a llamada directa/correo electrónico de contacto.
- **Botón de Bolsa de Compras (`shopping-bag` icon):** Solo para comercios (`tienda`), expande el carrusel de catálogo.

**5. Carrusel de Productos Integrado (Exclusivo Tiendas)**
- Renderiza un `ScrollView` horizontal con el catálogo de productos disponibles en el comercio.
- Cada tarjeta de producto muestra:
  - Imagen del producto.
  - Nombre del artículo.
  - Precio formateado en pesos chilenos.
  - Acción al pulsar: Inicia una conversación directa pre-redactada de WhatsApp consultando por el artículo en cuestión.
