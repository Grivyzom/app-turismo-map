# Modelo de Cuentas y Roles

Este documento define la arquitectura y las reglas de negocio para el sistema de perfiles (Ciudadanos, Negocios y Creadores).
Actualizado conforme a las directrices de la arquitectura multi-entidad con soporte geoespacial (PostGIS).

## 1. Tipos de Usuarios y Roles

El sistema soporta un esquema flexible separando usuarios de Entidades Emisoras.

*   **Ciudadano (`citizen`)**: Usuario base, turista o local. Su estado inicial es `active`. Guarda preferencias y lugares favoritos.
*   **Dueño/Creador (`partner_owner`)**: Administrador principal de una Entidad Emisora. Su estado inicial es `pending` (requiere aprobación).
*   **Trabajador / Staff (`partner_worker`)**: Miembro invitado a colaborar en una Entidad. Ingresa únicamente mediante flujo de invitaciones seguras.

## 2. Abstracción de Entidades Emisoras (`companies.entity_type`)

Para escalar el proyecto y soportar tanto a negocios físicos como creadores independientes, introducimos el concepto de **Entidad Emisora**.

1.  `business`: Empresas tradicionales (ej. Cafeterías, Hoteles). Habilita el panel de gestión Multi-Sucursal y permite la invitación de trabajadores ("Mi Equipo").
2.  `media`: Periodistas, Diarios o Prensa Oficial.
3.  `creator`: Influencers, Guías turísticos, Marcas personales.

*Nota UX:* Para `media` y `creator`, el panel de "Mi Equipo" se oculta automáticamente en el Frontend, priorizando métricas de sus "Emisiones" e impacto. Ellos operan generalmente como administradores únicos (owner) de su entidad y nunca usan invitaciones.

## 3. Insignias de Verificación y Confianza

Se utiliza el campo `is_verified_badge` (Booleano) en la Entidad Emisora. 
Esto permite mostrar un "Check Azul" o un megáfono oficial en los pines del mapa para los periodistas o influencers verificados, protegiendo al mapa del spam y de las fake news.

## 4. Flujo de Invitaciones a Sucursales

Para entidades tipo `business`, la inserción de empleados (`partner_worker`) usa tokens transaccionales:
1.  El `partner_owner` emite un token desde su panel. El token se guarda en la tabla `invitations`.
2.  El futuro empleado recibe el link (`/api/v1/invitations/accept?token=XYZ`), se registra si no existe, y es asignado automáticamente a la tabla `company_members` (y opcionalmente a una sucursal física).

---
*Documentos relacionados:* [[Arquitectura y Flujo de Usuarios]]
