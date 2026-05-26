# Arquitectura de Mapas y Telemetría

## 1. MapLibre y CARTO (Fallback en Web)
Dado que los costos de Google Maps API pueden ser altos para vistas web, implementamos una solución híbrida:
- **Móvil (iOS/Android):** Utiliza `react-native-maps` nativo (Google Maps Provider), para garantizar la integración fluida con los gestos del sistema y performance de hardware.
- **Web (Browser):** Utiliza `maplibre-gl`. En lugar de depender de tiles rasterizados (como OpenStreetMap estándar que suele ser claro y romper el diseño oscuro), configuramos una fuente vectorial gratuita usando **CARTO Dark Matter**.
  - **Ventajas:** Tema oscuro 100% nativo al canvas, renderizado vectorial fluido a 60fps, y escalado suave.
  - **Implementación:** `src/components/Map/MapLibreContainer.web.tsx` sincroniza los pines, marcadores animados y capas, asegurándose de suscribirse al evento `style.load` para recargar capas personalizadas si el estilo base cambia.

## 2. Telemetría Avanzada (`useUserLocation.ts`)
El mapa ahora hace mucho más que mostrar un simple punto azul. Extrae **Telemetría Avanzada** usando `expo-location` y sensores de dispositivo:
- **Coordenadas y Altitud:** Extraídas con alta precisión (High Accuracy, cada 3 segundos / 3 metros de cambio).
- **Precisión (Accuracy):** Margen de error en metros para dimensionar la confianza de la ubicación.
- **Velocidad (Speed):** Convertida a km/h automáticamente, útil para discernir si el usuario camina o conduce y potencialmente ajustar el zoom de la cámara dinámicamente.
- **Rumbo / Dirección (Heading):** 
  - *Fallback Cinemático:* Calculado mediante fórmulas Haversine si el dispositivo no tiene brújula (basado en el delta de la posición anterior y actual).
  - *Magnetómetro (Brújula Físico):* Subscripción a la brújula para saber exactamente a dónde "apunta" el dispositivo, independientemente del movimiento. En web se emula mediante eventos de `deviceorientation` (`webkitCompassHeading` en Safari y `alpha` en Android/Chrome).
  - Convertido a puntos cardinales en español (Norte, Suroeste, etc.).

## 3. UI y HUD de Telemetría (Glassmorphism)
- **Dashboard en Vivo:** Un panel oscuro y semi-transparente que se muestra por defecto sobre el mapa en dispositivos móviles. Muestra la información telemétrica real en vivo (Altitud, Velocidad, Precisión y Brújula Analógica que rota dinámicamente).
- **Cono de Visión:** El marcador del usuario ahora cuenta con un haz o cono direccional que rota automáticamente en función del *heading* de la brújula, proyectando la orientación exacta de la cámara del usuario en el espacio virtual del mapa.
