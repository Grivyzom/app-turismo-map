---
tags: [arquitectura, social, backend, frontend, valdivia]
fecha: 2026-06-02
estado: Planificación
---

# Plan: Red Social Híbrida de Valdivia

Este documento define la arquitectura y los requerimientos lógicos para transformar la aplicación en una red social geoespacial interactiva, introduciendo mecánicas de seguimiento, monetización mediante exclusividad y un ecosistema de autoridades integrado.

## 1. Perfiles Enriquecidos y Motor Social

### Requerimientos Generales
- **Perfiles Públicos y Privados**: Ampliación de la información visible tanto para turistas como para locales comerciales.
- **Sistema de Seguidores**: Mecánica de *Followers* y *Following* para personalizar la experiencia.

### Impacto en la Base de Datos (Ref: [[Diseño de Base de Datos]])
- **Modificación a Tablas Existentes**:
  - `citizen_profiles`: Añadir campos para biografía (`bio` text), enlaces de contacto (`contact_links` jsonb), y estado de privacidad (`is_public` boolean, por defecto true).
  - `companies`: Añadir campos equivalentes de biografía, enlaces y horarios extendidos.
- **Nueva Tabla `user_follows`**:
  - Esta tabla relacional conectará cuentas.
  - Columnas sugeridas: `follower_id` (UUID), `followed_id` (UUID), `created_at` (timestamp).
  - Índices: Llave primaria compuesta o *unique index* en `(follower_id, followed_id)` para evitar duplicados y optimizar los `JOINs`.

---

## 2. Visualización del Mapa (El Modelo Híbrido)

El mapa actuará como el lienzo principal, alternando entre el descubrimiento global y el ecosistema personal del usuario, solucionando el problema del "mapa vacío".

### Capa de Descubrimiento (Por defecto)
- **Objetivo**: Fomentar la exploración. Al entrar, el turista visualiza la actividad pública de Valdivia.
- **Lógica Espacial**: Las consultas PostGIS que nutren el mapa retornarán eventos y negocios marcados como *públicos* que se encuentren dentro de la caja delimitadora (bounding box) de la pantalla.

### Capa "Mi Red"
- **Objetivo**: Visualización enfocada *únicamente* en la actividad y los pines de los perfiles (usuarios y locales) que el turista sigue.
- **UI/UX**: Implementación mediante "Action Chips" (ej. "Descubrir" vs "Siguiendo") integrados en la interfaz principal del mapa.
- **Lógica de Filtrado**: La consulta a la API incluirá un parámetro (ej. `?feed=following`). En el backend, esto forzará un cruce con la tabla `user_follows` para devolver solo los pines relevantes.

---

## 3. Monetización e Interacción ("Paywall Social")

### Requerimientos y Flujo
- **Pines Bloqueados**: Permite a creadores y negocios publicar contenido exclusivo (promociones, rutas secretas, cupones) que exige que el turista los siga para visualizarlo.

### Flujo Técnico Propuesto
1. **Creación**: En el endpoint de creación de eventos, se añade la opción `requires_follow` (boolean).
2. **Respuesta de la API**: Si un usuario solicita el mapa y no sigue al creador de un pin exclusivo, la API solo devuelve las coordenadas y un flag `is_locked: true`, omitiendo los detalles (título, descripción, multimedia).
3. **Representación UI**: El mapa muestra un diseño especial para el pin (ej. un ícono de candado).
4. **Interacción**: Al tocar el pin bloqueado, se despliega un *Bottom Sheet* indicando que es contenido exclusivo. Al pulsar "Seguir", se llama a la API de *Follow*, se desbloquea el pin y se carga el contenido completo dinámicamente.

---

## 4. Ecosistema de Seguridad y Autoridades

Integración de servicios públicos (Bomberos, Carabineros, Municipalidad de Valdivia) como actores oficiales con privilegios especiales en el mapa.

### Impacto en el Modelo de Roles (Ref: [[Modelo de Cuentas y Roles]])
- **Nuevo Rol Oficial**: 
  - Dentro de la estructura actual, añadir el tipo `authority` al campo `entity_type` (ej. en la tabla `companies` o en un nuevo catálogo de entidades).
  - **Seguridad Estricta**: La creación de perfiles `authority` no será posible desde la app pública. Solo un administrador del sistema (mediante acceso directo a DB o panel admin privado) podrá asignar este rol para evitar suplantaciones de identidad.

### Comportamiento en el Mapa
- **Alcance Global Garantizado**: Los pines emitidos por una `authority` (ej. alertas de cortes de calle, avisos de seguridad) ignoran el "Paywall Social" y aparecen en todas las capas por defecto.
- **Control del Usuario**: 
  - Respetando el control del usuario, existirá la opción de ocultar estas notificaciones.
  - La elección del usuario se persistirá en el campo `preferences` (tipo JSONB) dentro de su tabla `users` (ej. `{"show_official_alerts": false}`).

---
## 📋 Tareas de Implementación Derivadas (To-Do)

*(Esta lista es para referencia futura cuando comience la fase de codificación)*

- [ ] **DB**: Crear script de migración para la nueva tabla `user_follows` y campos en `citizen_profiles`/`companies`.
- [ ] **Backend (Go)**: Modificar `events_handler.go` y `places_handler.go` para interpretar el filtro `?feed=following` y calcular el estado `is_locked`.
- [ ] **Backend (Go)**: Crear endpoints de `POST /api/v1/follow` y `DELETE /api/v1/follow`.
- [ ] **Frontend (Expo)**: Diseñar e implementar los "Action Chips" sobre el mapa para alternar capas.
- [ ] **Frontend (Expo)**: Implementar el UI del "Pin con Candado" y el modal de desbloqueo.
- [ ] **Frontend (Expo)**: Añadir en la configuración de la cuenta el *toggle* para mostrar/ocultar pines de autoridades.