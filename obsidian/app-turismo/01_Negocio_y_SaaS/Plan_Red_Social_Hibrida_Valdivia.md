---
tags: [arquitectura, social, backend, frontend, valdivia, seguridad, escalabilidad]
fecha: 2026-06-02
estado: Planificación Mejorada
---

# Plan: Red Social Híbrida de Valdivia (V2 Segura y Escalable)

Este documento define la arquitectura y los requerimientos lógicos para transformar la aplicación en una red social geoespacial interactiva. Esta versión incorpora mitigaciones críticas de seguridad y estrategias de escalabilidad para soportar miles de usuarios concurrentes.

## 1. Perfiles Enriquecidos y Motor Social

### Requerimientos Generales
- **Perfiles Públicos y Privados**: Ampliación de la información visible tanto para turistas como para locales comerciales.
- **Sistema de Seguidores**: Mecánica de *Followers* y *Following* para personalizar la experiencia.

### Seguridad y Prevención de Abuso (Anti-Spam)
- **Rate Limiting**: Límites estrictos en las peticiones a los endpoints de seguimiento (`/follow`) y creación de perfiles/pines para mitigar ataques de bots que busquen inflar métricas.
- **Trust Score Inicial**: Los usuarios nuevos tendrán visibilidad global limitada (shadowbanning preventivo) hasta que superen ciertas métricas de confianza (ej. verificación de correo, tiempo de vida de la cuenta, interacciones legítimas).

### Impacto en la Base de Datos (Ref: [[Diseño de Base de Datos]])
- **Modificación a Tablas Existentes**:
  - `citizen_profiles` y `companies`: Añadir campos para biografía (`bio` text), enlaces de contacto (`contact_links` jsonb), y estado de privacidad (`is_public` boolean, por defecto true).
- **Nueva Tabla `user_follows`**:
  - `follower_id` (UUID), `followed_id` (UUID), `created_at` (timestamp).
  - Índices: Llave primaria compuesta o *unique index* en `(follower_id, followed_id)`.

---

## 2. Visualización del Mapa (El Modelo Híbrido)

El mapa alternará entre el descubrimiento global y el ecosistema personal del usuario.

### Capa de Descubrimiento (Por defecto)
- **Objetivo**: Fomentar la exploración. Al entrar, el turista visualiza la actividad pública de Valdivia.
- **Escalabilidad y Clustering (Backend)**: Para evitar colapsos por falta de memoria (OOM) en el celular del turista y saturación de red, el backend en Go agrupará puntos cercanos usando *Clustering Espacial* (ej. enviando *Vector Tiles* MVT o un cluster JSON) cuando el zoom sea lejano. El frontend nunca procesará más de ~200 marcadores simultáneos.

### Capa "Mi Red"
- **Objetivo**: Visualización enfocada *únicamente* en la actividad y pines de los perfiles que el turista sigue.
- **Optimización de Consultas (Adiós al JOIN pesado)**: Para evitar el "JOIN de la muerte" (cruzar bounding box espacial con la tabla de seguidores), implementaremos un **Feed Materializado**:
  - Al crearse un pin, un *worker* asíncrono (ej. RabbitMQ + Go) lo distribuirá a las listas cacheadas (Redis) de los seguidores activos.
  - La API de lectura (`?feed=following`) consultará este índice en Redis combinado con GeoHashes (H3), garantizando respuestas en milisegundos.

---

## 3. Monetización e Interacción ("Paywall Social")

Permite a creadores y negocios publicar contenido exclusivo.

### Seguridad del Paywall (Zero Trust Frontend)
- **Ofuscación Geográfica**: Para pines exclusivos bloqueados, el backend solo enviará una ubicación aproximada (agregada) o ruido espacial intencional. La ubicación exacta solo se desencripta al seguir al usuario.
- **Protección Multimedia (Presigned URLs)**: Los detalles y adjuntos del pin (imágenes, audios) no irán como URLs estáticas públicas. El backend validará la relación `user_follows` y generará URLs prefirmadas (ej. de AWS S3 o MinIO) con expiración de 5 minutos, previniendo el robo de contenido mediante inspección de red.

### Flujo de Interacción UI
1. El mapa muestra un ícono de candado en zona ofuscada.
2. Al tocarlo, un *Bottom Sheet* exige seguir al perfil para ver la promoción/ruta.
3. Al pulsar "Seguir", se llama a la API, la cual devuelve las coordenadas exactas y las URLs prefirmadas de los medios.

---

## 4. Ecosistema de Seguridad y Autoridades

Integración de servicios públicos (Bomberos, Carabineros, Municipalidad) con privilegios de visibilidad.

### Seguridad Crítica (Prevención de Account Takeover)
- **Rol de Autoridad**: Asignable *exclusivamente* por el SysAdmin (campo `entity_type: authority`).
- **Autenticación Multifactor (MFA/2FA)**: Es estrictamente obligatorio para cuentas `authority`. Un atacante no podrá emitir falsas alarmas incluso si roba la contraseña.
- **Audit Logging**: Cada acción de emisión/borrado de pines de una autoridad quedará registrada en una tabla inmutable de auditoría para trazabilidad legal.

### Comportamiento en el Mapa
- **Alcance Global Garantizado**: Ignoran el "Paywall Social" y aparecen en todas las capas.
- **Control del Usuario**: Opción de ocultar notificaciones guardada en el campo `preferences` (JSONB) de la tabla `users`.

---
## 📋 Tareas de Implementación Derivadas (To-Do)

*(Actualizado con mitigaciones de arquitectura)*

- [ ] **DB**: Crear tabla `user_follows`, índices, y añadir campos en `citizen_profiles`/`companies`.
- [ ] **DB**: Crear tabla de auditoría `authority_audit_logs`.
- [ ] **Infraestructura**: Desplegar/Configurar instancia de Redis para caché de feeds y rate limiting.
- [ ] **Backend (Go)**: Implementar Middleware de Rate Limiting y lógica de Presigned URLs para S3/MinIO.
- [ ] **Backend (Go)**: Modificar sistema de mapas para retornar *Clusters* / MVT en vistas globales y ofuscar coordenadas en pines `requires_follow` no desbloqueados.
- [ ] **Backend (Go)**: Integrar MFA obligatorio para login de cuentas `authority`.
- [ ] **Frontend (Expo)**: Implementar "Action Chips" para alternar capas (Global vs Siguiendo).
- [ ] **Frontend (Expo)**: UI de pines bloqueados (Candado) y manejo dinámico de actualización al pulsar "Seguir".