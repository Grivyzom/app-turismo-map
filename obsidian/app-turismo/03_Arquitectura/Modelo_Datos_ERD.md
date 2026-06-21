# Modelo de Datos (ERD) - Junio 2026

## Entidades Principales

### Usuarios y Roles
- **users:** Tabla central de usuarios (ciudadanos y socios).
- **admin_users:** Tabla separada para administradores del sistema, con soporte para 2FA.
- **companies:** Entidades legales o comerciales vinculadas a socios propietarios.

### Geoespacial
- **zones:** Polígonos que delimitan áreas de interés o categorías en el mapa. Almacenados con GeoJSON/PostGIS.
- **branches:** Sucursales físicas de las empresas, con ubicación `GEOMETRY(Point, 4326)`.
- **events:** Actividades o eventos vinculados a ubicaciones.

### Personalización y Social
- **preferences:** Intereses y estilos de viaje de los usuarios.
- **collections:** Carpetas personalizadas creadas por usuarios para agrupar lugares.
- **saved_locations:** Puntos específicos guardados dentro de una colección.

### Catálogo
- **products:** Ítems disponibles en una sucursal.
- **promotions:** Ofertas vinculadas a productos o sucursales.

### Auditoría y Métricas
- **audit_log:** Registro de acciones administrativas críticas.
- **checkins:** Registro de visitas de usuarios a lugares.
- **surveys:** Feedback directo de los usuarios.

## Relaciones Clave
1.  **Un User (Socio)** -> Puede tener una **Company**.
2.  **Una Company** -> Puede tener múltiples **Branches**.
3.  **Una Branch** -> Tiene un **Catalog** (Products + Promotions).
4.  **Un User (Ciudadano)** -> Tiene múltiples **Collections**.
5.  **Una Collection** -> Contiene múltiples **SavedLocations**.
6.  **Una Zone** -> Puede contener múltiples **Events/Branches** (vínculo geoespacial).

---
*Nota: El diagrama visual actualizado se encuentra en la raíz como [[Estructura Tiempo Real.canvas]].*
