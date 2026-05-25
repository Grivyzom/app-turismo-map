**Resumen Ejecutivo**  
El frontend es una aplicación multiplataforma construida con **React / React Native (Expo + Web)** y **TypeScript**. Su responsabilidad es consumir la API REST y el canal WebSocket del backend, renderizar mapas interactivos (markers, cluster, rutas) y gestionar UI/UX para usuarios móviles y web. El punto de entrada está en [App.tsx:1](vscode-file://vscode-app/c:/Users/grivy/AppData/Local/Programs/Microsoft%20VS%20Code/f6cfa2ea24/resources/app/out/vs/code/electron-browser/workbench/workbench.html) y el manejo del mapa se encuentra en [MapContainer.tsx:1](vscode-file://vscode-app/c:/Users/grivy/AppData/Local/Programs/Microsoft%20VS%20Code/f6cfa2ea24/resources/app/out/vs/code/electron-browser/workbench/workbench.html) y [MapContainer.web.tsx:1](vscode-file://vscode-app/c:/Users/grivy/AppData/Local/Programs/Microsoft%20VS%20Code/f6cfa2ea24/resources/app/out/vs/code/electron-browser/workbench/workbench.html). La clave de Google Maps vive en [.env:1](vscode-file://vscode-app/c:/Users/grivy/AppData/Local/Programs/Microsoft%20VS%20Code/f6cfa2ea24/resources/app/out/vs/code/electron-browser/workbench/workbench.html).

**🛠️ Tecnologías y Librerías Clave**

- **Lenguaje:** `TypeScript` (v6.0.3)
- **Framework UI:** `React 19` + `React Native (Expo 56)`
- **Estilos:** `NativeWind v4` + `TailwindCSS v4` (para diseño consistente multiplataforma)
- **Mapas:** 
    - Móvil: `react-native-maps` (v1.27.2) — Configuración detallada en [[CONFIGURACION GOOGLE MAPS.md]].
    - Web: `maplibre-gl` (v5.24.0) para alto rendimiento
- **Animaciones:** `react-native-reanimated` (v4.3.1) para fluidez de 60fps
- **Configuración:** `mapConfig.ts` centraliza la elección del proveedor (Google vs Open-Source)
- **Estado & datos:** `React Hooks` (useState/useEffect) para prototipos; escalable a `Zustand`
- **Tiempo real:** Simulación de WebSockets implementada en `App.tsx` para pruebas de flujo

**🗺️ Arquitectura de Datos en Tiempo Real (Frontend)**

- La app abre una conexión `WebSocket` al backend y recibe el JSON unificado.
- Un `WebSocketService` central parsea mensajes y despacha actualizaciones al store de UI.
- El store mantiene entidades normalizadas: `POI`, `Evento`, `Telemetría`, con índices por `id` y por geohash/cuadrante para render eficiente.
- El componente de mapa (`MapContainer`) suscribe solo a la porción de estado necesaria (p. ej. markers visibles según bounding box).
- Actualizaciones frecuentes (telemetría) se aplican con diffs incrementales y throttling/debouncing para evitar renders excesivos.

**Patrón de mensaje esperado (resumen)**

- Mensaje WebSocket: objetos con campos mínimos: `id`, `type`, `coords: {lat,lng}`, `state`, `metadata`, `ts`.
- El frontend debe validar `ts` y descartar mensajes desordenados si fuera necesario.

**📐 Consideraciones de UX y Rendimiento**

- Renderizado: usar clustering en zooms bajos y markers individuales en zooms altos.
- Reducción de renders: seleccionar por bounding box y memoizar layers de mapa.
- Manejo offline: cachear POIs y permitir reintento de reconexión WebSocket.
- Permisos y privacidad: solicitar ubicación con UX claro; exponer controles de actualización en tiempo real.

**💡 Nota de Arquitectura**  
El frontend es responsable de la representación (símbolos, estilos, agrupamiento). El backend solo entrega coordenadas, estados y metadatos; la transformación visual y UX recae en la app.