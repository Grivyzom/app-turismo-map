# Arquitectura Detallada y Funcionamiento del Frontend (Expo)

Este documento describe la estructura, lógica de navegación y componentes críticos de la aplicación móvil y web construida con Expo.

## 🏗️ Estructura del Proyecto (Root `app-turismo/`)

La aplicación utiliza **Expo Router**, lo que significa que la estructura de archivos en `app/` define las rutas de navegación:

- **`app/`**: Directorio de rutas (File-based Routing).
    - **`_layout.tsx`**: Layout raíz. Configura los proveedores globales (`Auth`, `Location`) y el splash screen.
    - **`(home)/`**: Grupo de rutas para la experiencia principal del ciudadano.
        - **`index.tsx`**: La pantalla principal "todo-en-uno" que integra el Mapa y las pestañas rápidas.
    - **`business/`**: Rutas exclusivas para socios (Dashboard, Registro de Sucursal, etc.).
    - **`admin/`**: Rutas de acceso rápido para administración móvil.
    - **`onboarding.tsx`**: Flujo de captura de preferencias iniciales.
- **`src/`**: Código fuente modular.
    - **`components/`**: Componentes UI reutilizables divididos por dominio (`Map`, `MapUI`, `ui`).
    - **`context/`**: Gestión de estado global mediante React Context.
    - **`screens/`**: Pantallas complejas cargadas de forma diferida (Lazy Loading) dentro de la Home.
    - **`hooks/`**: Lógica de sensores (Ubicación), red y lógica de negocio extraída.
    - **`utils/`**: Utilidades para clustering, persistencia local y telemetría.

---

## 🗺️ El Motor de Mapas y Experiencia de Usuario

La pantalla principal (`app/(home)/index.tsx`) es un centro de control reactivo diseñado para la fluidez:

### Navegación Reactiva sin Desmontaje
Para evitar que el mapa se recargue (lo cual es costoso en términos de performance y datos), las pestañas (**Feed, Pasaporte, Foro, Perfil**) se cargan como capas sobre el mapa o mediante carga diferida (`Suspense` + `lazyWithRetry`). Esto permite transiciones de **0ms** entre el mapa y otras funciones.

### Nivel de Detalle (LOD) y Clustering
Ubicado en `src/utils/clusterUtils.ts`, el sistema utiliza **Supercluster** con una lógica de pesos:
- **LOD 1 (Zoom Lejano):** Solo muestra emergencias y puntos críticos (Puertos, Choques).
- **LOD 2 (Zoom Medio):** Se activan museos, teatros y parques.
- **LOD 3 (Zoom Cercano):** Se muestran todos los pines (gastronomía, tiendas).
- **Decluttering:** En zooms máximos, el sistema filtra pines que colisionan visualmente, dejando solo los de mayor "peso" jerárquico.

---

## 🔐 Gestión de Estado y Autenticación

El `AuthContext.tsx` actúa como el orquestador de seguridad:
1.  **Persistencia:** Utiliza `AsyncStorage` para mantener la sesión iniciada.
2.  **Protección de Rutas:** Un hook `useProtectedRoute` monitorea los segmentos de navegación (`segments`). Si un usuario sin rol de empresa intenta entrar a `/business`, es redirigido automáticamente.
3.  **Multi-Perfil:** Diferencia el flujo de UI entre `citizen` (Home) y `partner_owner` (Dashboard de Negocios).

---

## 🎨 Estética y Diseño (Obsidian Glass)

La aplicación implementa un lenguaje de diseño llamado **Obsidian Glass**, caracterizado por:
- **Glassmorphism:** Paneles traslúcidos con desenfoque (`blur`) y bordes brillantes.
- **NativeWind:** Uso de Tailwind CSS v4 para una estilización rápida y consistente en Web y Móvil.
- **Tactical HUD:** Un modo de "Precisión Militar" que muestra coordenadas decimales exactas, altitud y telemetría del sensor en tiempo real.

---

## ⚡ Optimizaciones de Rendimiento

- **Lazy Loading:** Las pantallas secundarias no se cargan hasta que el usuario las toca por primera vez.
- **Prefetching:** Al pasar el mouse (en Web) sobre un icono de pestaña, la aplicación comienza a descargar el código de esa pantalla antes del clic.
- **Memoización:** Uso intensivo de `useMemo` y `useCallback` en el procesamiento de clusters para evitar caídas de frames durante el desplazamiento del mapa.

---
*Para detalles sobre la integración con el servidor, ver:* [[Arquitectura_Detallada_y_Funcionamiento]] (Backend).
