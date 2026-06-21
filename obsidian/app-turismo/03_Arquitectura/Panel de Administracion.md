# Panel de Administración

## Stack Tecnológico
- **Framework:** React 19
- **Build Tool:** Vite
- **Navegación:** React Router 7
- **Iconos:** Lucide React

## Características de Seguridad
- **Autenticación en 2 Pasos (2FA):** Implementación obligatoria de TOTP para el acceso administrativo.
- **Auditoría:** Todas las acciones críticas se registran en `audit_log`.
- **RBAC:** Soporte para roles como `superadmin`, `admin` y `moderator`.

## Funcionalidades Principales
- **Dashboard:** Métricas en tiempo real (Usuarios totales, activos, nuevas empresas).
- **KPIs & Trends:** Análisis visual de las preferencias de los usuarios y categorías más populares.
- **Gestión de Empresas:** Flujo de verificación de socios (`partner_owner`).
- **Control Geoespacial:** 
    - Gestión de **Zonas**: Activación y desactivación de polígonos en el mapa.
    - Moderación de **Eventos** y **Sucursales**.
- **Log de Auditoría:** Visualización detallada de inicios de sesión y cambios realizados por otros administradores.

## Rutas Protegidas
- `/`: Dashboard General.
- `/mapa`: Visualización global de la actividad geoespacial.
- `/empresas`: Listado y verificación de socios comerciales.
- `/audit-log`: Historial de seguridad.
