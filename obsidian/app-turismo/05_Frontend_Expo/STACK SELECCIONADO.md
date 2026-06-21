# Frontend Stack (Expo)

## Core
- **Framework:** Expo 56 (React Native 0.85)
- **Lenguaje:** TypeScript
- **Navegación:** Expo Router (File-based routing)
- **Styling:** NativeWind (Tailwind CSS v4)
- **Animaciones:** React Native Reanimated

## Geo-espacial y Mapas
- **Mapas:** `react-native-maps` (Integración nativa con Google Maps).
- **Clustering:** `supercluster` para manejo eficiente de miles de marcadores.
- **Ubicación:** `expo-location` para telemetría y posicionamiento en tiempo real.
- **Vectores:** `react-native-svg` para iconos personalizados en el mapa.

## Funcionalidades Implementadas
- **Onboarding:** Flujo de captura de preferencias con estado global.
- **Auth:** Integración con Google Sign-In y Auth Session para flujos web.
- **Map View:** Visualización de eventos, búsqueda de lugares y filtrado por categorías.
- **Business Dashboard:** Vista simplificada para que los socios actualicen su ubicación.

## Gestión de Estado
- **Context API:** Para autenticación (`AuthContext`) y ubicación del usuario (`UserLocationContext`).
- **Persistence:** `AsyncStorage` para tokens y preferencias offline.

## Rendimiento
- Uso de `Reanimated` para transiciones fluidas.
- Optimización de marcadores de mapa con `Supercluster`.
- Carga diferida de fuentes y activos mediante `expo-font` y `SplashScreen`.
