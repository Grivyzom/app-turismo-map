# 🗺️ App Turismo Map — Resumen Ejecutivo para Presentación Académica

> **Audiencia:** Profesor universitario del área de Turismo  

> **Objetivo:** Identificar el potencial del software y oportunidades de mejora desde la perspectiva académica del sector turístico.

---
## 🎯 ¿Qué es el Software?

**App Turismo Map** es una plataforma digital de **turismo geosocial** que conecta en tiempo real a tres actores del ecosistema turístico:

1. **El ciudadano/residente local** — quien navega y reporta la ciudad desde adentro.

2. **El turista** — quien descubre destinos, eventos y negocios de forma personalizada.

3. **Las empresas turísticas** — que publican eventos, productos y promociones geolocalizadas.

  

El sistema funciona como un **mapa interactivo inteligente** que combina:

- Descubrimiento de lugares y eventos en tiempo real.
- Reportes ciudadanos colaborativos (al estilo Waze).
- Recomendaciones personalizadas basadas en preferencias del usuario.
- Un sistema de gamificación con "Pasaporte Digital" para incentivar la exploración.

  

---

  

## 👥 Tipos de Clientes / Usuarios del Sistema

  

El software contempla **tres perfiles de usuario finales** y **un panel de administración**:

| Tipo de Usuario | Descripción | Acceso |

|---|---|---|
| **Ciudadano Local** (`citizen`) | Residente de la ciudad. Puede ver y reportar el entorno desde una perspectiva cotidiana. | App móvil y web |
| **Turista** (`tourist`) | Visitante externo. Recibe recomendaciones adaptadas a su perfil y tiempo de estadía. | App móvil y web |
| **Empresa Partner / Propietario** (`partner_owner`) | Dueño de negocio turístico. Publica eventos, productos y gestiona su presencia en el mapa. | App + Portal empresarial |
| **Empleado de Empresa** (`partner_worker`) | Personal de un negocio asociado con permisos parciales de publicación. | App + Portal empresarial |
| **Administrador del Sistema** (`admin`) | Gestión operativa de la plataforma con panel de control y 2FA de seguridad. | Panel web de administración |
  

> [!IMPORTANT]

> Un mismo usuario ciudadano puede **cambiar su modo de vista** entre "local" y "turista" (`current_view_mode`), lo que cambia dinámicamente los contenidos que se le muestran en el mapa.

---

## 📅 Tipos de Eventos que Maneja el Sistema


El sistema gestiona **eventos geolocalizados** que pueden ser publicados por dos tipos de emisores:

### Por Tipo de Emisor:

| Emisor | Descripción |

|---|---|

| **Ciudadano** (`citizen`) | Eventos creados por usuarios regulares: concentraciones, actividades culturales informales, alertas. |

| **Empresa/Negocio** (`business`) | Eventos creados por partners: festivales, degustaciones, conciertos, talleres, ofertas de temporada. |

  

### Por Categorías (ejemplo de uso):

- `gastronomia` — Festivales de comida, degustaciones, apertura de restaurantes.

- `cultura` — Museos, exposiciones, actos culturales.

- `naturaleza` — Caminatas, ecoturismo, parques.

- `aventura` — Deportes extremos, tours.

- `entretenimiento` — Conciertos, espectáculos.

  

### Por Audiencia Objetivo:

Cada evento puede segmentarse para mostrarse solo a un tipo de audiencia:

- `local` — Solo visibles para residentes.

- `tourist` — Solo visibles para turistas.

- `all` — Visibles para todos.

  

---

  

## 📊 Datos que se Recolectan

  

El sistema recolecta datos en múltiples niveles de profundidad:

  

### 🔵 Datos del Perfil de Usuario

- Nombre, email, foto de perfil.

- Tipo de usuario (local/turista/empresa).

- País de origen y teléfono de contacto.

- **Preferencias turísticas** (almacenadas en JSON flexible):

  - Categorías de interés (gastronomía, cultura, aventura, etc.)

  - Estilo de viaje (`travelStyle`)

  - Duración de estadía (`stayDuration`)

  

### 🟢 Datos de Comportamiento y Actividad

- Eventos creados, asistidos o cancelados (`event_attendees`).

- Interacciones con contenido: likes, favoritos, guardados, recomendaciones (`user_interactions`).

- Rutas turísticas planificadas, en progreso o completadas (`user_route_tracking`).

- Ubicaciones guardadas en colecciones personales (`saved_locations`, `collections`).

- Check-ins en eventos (`/api/v1/events/checkin`).

  

### 🟡 Datos Geoespaciales (PostGIS)

- Coordenadas GPS de eventos, negocios y rutas (formato GIS con SRID 4326).

- Índices espaciales para búsquedas geográficas eficientes.

- Reportes ciudadanos geolocalizados con tipo, descripción y votos (`map_reports`).

  

### 🔴 Datos de Empresas y Negocios

- Nombre comercial, tipo de entidad, estado de verificación, teléfono.

- Sucursales con su ubicación geográfica, descripción y audiencia objetivo.

- Catálogo de productos/servicios con precio e imágenes.

- Promociones con fecha de inicio/fin y estado activo/inactivo.

  

### ⚪ Datos de Encuesta Inicial (Anónima)

Mediante una encuesta al entrar, se captura (vía Redis para alta velocidad):

- Categorías de interés.

- Estilo de viaje.

- Duración de estadía planificada.

  

Esto genera **estadísticas agregadas en tiempo real** sin requerir registro.

  

### 🛡️ Datos de Seguridad y Auditoría (Admin)

- Log de auditoría de acciones administrativas con IP y User-Agent.

- Sistema de autenticación en 2 pasos (2FA/TOTP) para administradores.

- Rate limiting en endpoints de autenticación.

  

---

  

## 💊 Problemáticas que Resuelve (Dolencias del Sector)

  

### Para el Turista:

| Dolencia | Solución que ofrece el software |

|---|---|

| ❌ "No sé qué hacer ni dónde ir en esta ciudad" | ✅ Mapa interactivo con eventos y lugares en tiempo real, filtrados por sus gustos. |

| ❌ "Las apps de turismo muestran información desactualizada" | ✅ Los negocios y ciudadanos publican en tiempo real. El feed está vivo. |

| ❌ "No sé si un lugar está concurrido o tiene algún problema" | ✅ Reportes colaborativos ciudadanos al estilo Waze: alertas de peligro, aforo lleno, etc. |

| ❌ "Quiero recordar los lugares que visité" | ✅ Sistema de Pasaporte Digital con sellos desbloqueados por lugar visitado. |

| ❌ "Las recomendaciones son genéricas y no se adaptan a mí" | ✅ Motor de recomendación personalizado basado en las categorías de interés del usuario. |

  

### Para el Negocio Turístico:

| Dolencia | Solución que ofrece el software |

|---|---|

| ❌ "Mis clientes no saben que tenemos un evento o promoción" | ✅ Publicación de eventos y promociones con geolocalización exacta visibles en el mapa. |

| ❌ "No llego a turistas, solo a locales" | ✅ La segmentación `target_audience` permite orientar contenido exclusivamente a turistas. |

| ❌ "No tengo visibilidad digital con catálogo de productos" | ✅ Portal de empresa con sucursales, catálogo y sistema de revisiones de clientes. |

  

### Para la Gestión Turística Local:

| Dolencia | Solución que ofrece el software |

|---|---|

| ❌ "No tenemos datos sobre qué prefieren los visitantes" | ✅ KPIs y analíticas de tendencias (estilos de viaje, categorías más demandadas, duración de estadía). |

| ❌ "No sabemos qué eventos generan más interés" | ✅ Registro de asistentes, check-ins e interacciones por evento. |

  

---

  

## ✨ Novedades y Diferenciadores Tecnológicos

  

1. **Vista Dual Local/Turista** — El mismo usuario puede cambiar su perspectiva de "residente" a "turista" y ver contenidos distintos sin crear otra cuenta. Es un concepto innovador de identidad fluida.

  

2. **Mapa Geosocial en Tiempo Real** — No es solo un directorio de negocios. Es un mapa vivo con reportes ciudadanos, eventos efímeros y rutas trazables.

  

3. **Pasaporte Digital Gamificado** — Sistema de sellos y XP (puntos de aventura) que incentiva la exploración y genera fidelización del usuario. Concepto similar a un "logro" en videojuegos aplicado al turismo.

  

4. **Feed "Waze del Turismo"** — Reportes colaborativos con botones de alerta (Peligro, Promo, Lleno, Información) que permiten al turista tomar decisiones en tiempo real.

  

5. **Motor de Recomendación con Fallback Inteligente** — Si el usuario no tiene preferencias configuradas, el sistema usa las categorías más populares de la comunidad. Nunca falla en dar recomendaciones.

  

6. **Multiplataforma desde un Solo Código** — La misma base de código funciona en Android, iOS y Web. Acceso universal sin barreras tecnológicas.

  

7. **Encuesta Anónima Pre-Registro** — Se capturan datos del visitante antes de que cree una cuenta, enriqueciendo el análisis de demanda sin fricciones.

  

8. **Segmentación de Contenidos por Audiencia** — Negocios, eventos y rutas pueden marcarse como dirigidos a `local`, `tourist` o `all`, creando un ecosistema de contenidos relevante para cada perfil.

  

---

  

## ⚔️ Competidores Principales

  

### Competencia Directa:

| Software | Fortaleza | Diferencia con nuestro sistema |

|---|---|---|

| **Google Maps** | Directorio global masivo, rutas, reseñas. | No tiene orientación turística ni gamificación. Es genérico. |

| **TripAdvisor** | Gran base de datos de reseñas turísticas. | No tiene mapa en tiempo real ni reportes ciudadanos. |

| **Airbnb Experiences** | Experiencias curadas por locales. | Solo cubre experiencias pagadas, sin eventos espontáneos ni reportes. |

| **Foursquare / Swarm** | Check-ins y recomendaciones por lugar. | Foco en lugares, no en eventos dinámicos ni en contexto local/turista. |

| **Civitatis** | Reserva de tours y actividades. | Plataforma de reserva, no de descubrimiento en tiempo real. |

  

### Competencia Indirecta:

| Software | Por qué compite |

|---|---|

| **Waze** | Reportes colaborativos en tiempo real en mapa (concepto similar al feed de reportes). |

| **Instagram / TikTok** | Descubrimiento de lugares mediante contenido social geoetiquetado. |

| **Booking.com** | Gestión de negocios turísticos, aunque focalizado en alojamiento. |

| **Eventbrite** | Publicación y descubrimiento de eventos, pero sin mapa interactivo ni perfil turístico. |

  

> [!TIP]

> **Ventaja competitiva clave:** Ninguno de los competidores combina en una sola plataforma los reportes ciudadanos en tiempo real, la dualidad local/turista, la gamificación con pasaporte y el motor de recomendación personalizado orientado a un territorio específico.

  

---

  

## 🏗️ Arquitectura del Sistema (Resumen Técnico)

  

```

[USUARIO] ←→ [App Móvil/Web - React Native + Expo]

                        ↕

              [Backend API - Go (Golang)]

              /            |            \

    [PostgreSQL]       [Redis]      [PostGIS]

    (Datos de         (Cache y     (Geodatos y

     usuarios,        encuestas    coordenadas

     eventos,         anónimas)    espaciales)

     negocios)

```

  

- **Frontend:** React Native + Expo (Android, iOS, Web desde un solo código).

- **Backend:** Go — alto rendimiento, concurrente, ideal para geolocalización en tiempo real.

- **Base de Datos:** PostgreSQL con extensión PostGIS para datos geoespaciales.

- **Cache:** Redis para analíticas de alta velocidad (encuestas anónimas, contadores).

- **Seguridad:** JWT + Autenticación 2FA (TOTP) para administradores.

- **Autenticación:** Email/contraseña + OAuth2 con Google.

  

---

  

## 🚀 Preguntas Abiertas para Explorar con el Profesor

  

Estos son los puntos de mayor valor que podría aportar la perspectiva académica del sector:

  

1. **¿Qué datos turísticos son realmente valiosos para la planificación de destinos?** — El sistema ya los captura, pero ¿se están priorizando los correctos?

  

2. **¿Qué categorías de turismo faltan?** — ¿Turismo accesible? ¿Turismo gastronómico especializado? ¿Turismo de salud?

  

3. **¿Cómo podría integrarse con organismos oficiales de turismo?** — Ministerios, cámaras de turismo, institutos de estadística.

  

4. **¿Qué métricas importan para la gestión de destinos?** — El panel de KPIs existe, ¿mide lo que un gestor de destino necesita?

  

5. **¿Puede el Pasaporte Digital convertirse en un incentivo formal?** — Convenios con negocios para ofrecer descuentos por sellos acumulados.

  

6. **¿Hay necesidad de un módulo de itinerarios guiados?** — Rutas temáticas predefinidas por expertos en turismo (rutas históricas, gastronómicas, etc.).

  

---

  

*Documento generado el 11 de junio de 2026.*