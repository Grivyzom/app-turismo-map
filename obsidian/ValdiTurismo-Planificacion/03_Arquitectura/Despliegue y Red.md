# Despliegue y Configuración de Red

Este documento detalla la infraestructura de red y despliegue para el acceso público a través de dominios.

## 1. Arquitectura de Red (Dominios)

El sistema utiliza **Nginx** en el servidor host como proxy inverso para dirigir el tráfico a los contenedores Docker. Todos los dominios cuentan con SSL gestionado por certificados de Cloudflare.

| Subdominio | Destino (Contenedor) | Puerto Interno | Propósito |
| :--- | :--- | :--- | :--- |
| `app.broco.dev` | `turismo_frontend` | `8082` | Acceso a la Web App (Expo) |
| `api-turismo.broco.dev` | `turismo_backend` | `8081` | API REST (Go) |

## 2. Configuración de Nginx (Host)

La configuración se encuentra en `/etc/nginx/sites-available/` con enlaces simbólicos a `sites-enabled/`.

### Frontend (`app.broco.dev`)
Redirige el tráfico al puerto `8082`. Soporta WebSockets para funcionalidades en tiempo real.

### Backend (`api-turismo.broco.dev`)
Redirige el tráfico al puerto `8081`.

## 3. Configuración de Contenedores (Docker)

### Frontend (Nginx Interno)
El contenedor de frontend utiliza un Nginx interno (`app-turismo/nginx.conf`) configurado para servir los archivos estáticos generados por `expo export`.
- **Ruta raíz:** `/usr/share/nginx/html`
- **Manejo de rutas:** Redirige todas las peticiones no encontradas a `index.html` para soportar el enrutamiento de Expo Router.

### Backend (Go)
El backend corre nativamente en el puerto `8080` dentro de su contenedor, mapeado al puerto `8081` del host.

## 4. Variables de Entorno (.env)
Para el correcto funcionamiento en producción, el archivo `.env` en la raíz debe apuntar a las URLs con SSL:

```env
EXPO_PUBLIC_BACKEND_URL=https://api-turismo.broco.dev
```

> [!IMPORTANT]
> Al cambiar `EXPO_PUBLIC_BACKEND_URL`, es obligatorio reconstruir el frontend:
> `docker-compose up -d --build frontend`
