# Sistema de Colecciones y Ubicaciones Guardadas

Este documento detalla la implementación del sistema de guardado de ubicaciones y organización en colecciones, completado el 8 de junio de 2026.

## 1. Visión General
Permite a los usuarios ciudadanos organizar puntos de interés (eventos o pines personalizados) en carpetas temáticas ("Colecciones") para planificación de viajes o historial personal.

## 2. Modelos de Datos (PostgreSQL)
Se añadieron dos tablas principales:

### `collections`
- `id`: SERIAL PRIMARY KEY
- `user_id`: INT (FK users.id) - Dueño de la colección.
- `name`: VARCHAR(255) - Ej: "Turismo", "Favoritos".
- `description`: TEXT
- `visibility`: VARCHAR(50) - (private/public)
- `created_at`, `updated_at`: TIMESTAMP

### `saved_locations`
- `id`: SERIAL PRIMARY KEY
- `collection_id`: INT (FK collections.id)
- `location_type`: VARCHAR(50) - 'event' (evento del sistema) o 'custom_pin' (pincho manual).
- `ref_id`: VARCHAR(100) - ID del evento si aplica.
- `latitude`, `longitude`: DOUBLE PRECISION
- `title`: VARCHAR(255)
- `notes`: TEXT
- `created_at`: TIMESTAMP

## 3. Endpoints de la API
Base URL: `/api/v1/collections` (Protegido por JWT)

- `POST /`: Crea una nueva colección.
- `GET /`: Lista las colecciones del usuario (incluye conteo de ítems).
- `POST /locations`: Guarda una ubicación en una colección.
- `GET /{id}/locations`: Lista los lugares guardados en una colección específica.

## 4. Componentes Frontend (React Native / Expo)

### `SaveToCollectionModal.tsx`
Componente tipo BottomSheet que permite:
- Listar colecciones existentes.
- Crear una nueva colección "al vuelo" sin salir del flujo de guardado.
- Feedback visual de guardado.

### `ColeccionesScreen.tsx`
Ubicada en `app/(home)/perfil/colecciones.tsx`.
- Vista de tarjetas para colecciones.
- Vista de detalle con lista de ubicaciones.
- Acceso rápido para navegar (`router.push`) hacia las coordenadas en el mapa principal.

## 5. Optimización del Mapa
Durante esta implementación, se refactorizó `MapContainer.tsx` para mejorar el rendimiento:
- **Lazy Rendering de Menú Radial:** El `ContextualRadialMenu` solo se renderiza para el pin seleccionado, eliminando cientos de componentes pesados en reposo.
- **Control de Animaciones:** Se desactivaron los pulsos infinitos de Reanimated cuando los marcadores no tienen `tracksViewChanges={true}`, liberando CPU.
- **Consistencia Visual:** El menú radial ahora tiene una posición fija en la parte superior (`190°` a `350°`) para mayor estabilidad visual.

---
**Estado:** Implementado y Verificado.
**Fecha:** 2026-06-08
**Responsable:** Gemini CLI (Auto-Edit Mode)
