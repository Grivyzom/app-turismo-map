# Arquitectura Detallada y Funcionamiento del Backend (Go)

Este documento describe la estructura interna, el flujo de datos y las decisiones técnicas detrás del backend de la plataforma.

## 🏗️ Estructura del Proyecto

El backend sigue una organización modular diseñada para la escalabilidad y claridad:

- **`main.go`**: Punto de entrada. Configura la base de datos, Redis, enrutamiento (CORS, Middlewares) y manejo de señales para un cierre ordenado del servidor.
- **`handlers/`**: Controladores de entrada HTTP. Se encargan de validar solicitudes, ejecutar la lógica (SQL o llamadas a otros paquetes) y devolver respuestas JSON.
- **`internal/`**: Lógica de negocio y servicios especializados que no deben ser expuestos directamente.
    - **`spatial/`**: El corazón geoespacial. Maneja la decodificación binaria de PostGIS y consultas de radio (`Nearby`).
    - **`catalog/`**: Gestión de productos y promociones para sucursales.
    - **`database/`**: Abstracción del repositorio y pooling de conexiones.
- **`middleware/`**: Procesamiento transversal de solicitudes (Auth, Rate Limiting, Seguridad).
- **`models/`**: Definiciones de estructuras de datos compartidas.
- **`utils/`**: Funciones de soporte para JWT y TOTP (2FA).

---

## 🛰️ Motor Geoespacial (PostGIS)

Una de las piezas más críticas es `backend/internal/spatial/spatial.go`. 

### Decodificación Binaria (WKB/EWKB)
Para evitar la sobrecarga de convertir geometrías a texto en SQL (ST_AsText), el backend lee los datos en formato binario directamente de PostGIS.
- Implementa la interfaz `sql.Scanner` en el struct `Point`.
- Detecta automáticamente el **Endianness** y el tipo de geometría (**EWKB** con SRID 4326).
- Mapea el eje X a Longitud y el eje Y a Latitud.

### Consultas de Proximidad
Utiliza la función `ST_DWithin` sobre el tipo `geography` para realizar cálculos precisos en metros sobre la superficie terrestre, garantizando resultados exactos en el mapa.

---

## 🔐 Sistema de Autenticación y Seguridad

### Autenticación Multi-Nivel
1.  **JWT (JSON Web Tokens):** Firmados simétricamente. Contienen `scope` y `role`.
2.  **RBAC (Control de Acceso Basado en Roles):**
    - `citizen`: Acceso a rutas de usuario.
    - `partner_owner`: Acceso a gestión de sucursal.
    - `admin/superadmin`: Acceso al panel administrativo.

### Seguridad Administrativa (2FA)
Los administradores no pueden acceder solo con contraseña. El flujo es:
1.  `POST /admin/auth/login`: Valida credenciales y devuelve un `challengeId`.
2.  `POST /admin/auth/verify-2fa`: Valida el código TOTP generado por la app del admin.
3.  Solo tras el paso 2 se emite un JWT con `scope: admin`.

---

## ⚡ Rendimiento y Concurrencia

### Goroutines en Consultas
En endpoints como `NearbyHandler`, el backend lanza consultas paralelas a la base de datos para obtener **sucursales** y **eventos** simultáneamente usando Goroutines y Channels, reduciendo el tiempo de respuesta total.

### Pool de Conexiones
Utiliza `github.com/jackc/pgx/v5/pgxpool` para gestionar un pool de conexiones persistentes a PostgreSQL, evitando el overhead de abrir/cerrar conexiones en cada request.

---

## 🛠️ Flujo de una Solicitud (Request Life Cycle)

1.  **Ingreso:** El cliente envía una petición HTTPS.
2.  **Middleware de Seguridad:** Se aplican headers (HSTS, CSP) y se recupera de posibles pánicos.
3.  **CORS:** Verifica si el origen está permitido (Whitelist en producción).
4.  **Rate Limiting:** Redis verifica si el IP ha excedido sus límites.
5.  **Auth Middleware:** Si la ruta es protegida, valida el JWT y extrae los claims al contexto.
6.  **Handler:** El controlador procesa la lógica, interactúa con la DB y genera la respuesta.
7.  **JSON Response:** Se serializan los datos y se envían al cliente.

---
*Para ver el detalle de los modelos de datos, consultar:* [[Modelo_Datos_ERD]]
