**Resumen Ejecutivo**  
Esta nota documenta la selección de servicios, la configuración de seguridad y la integración de las APIs de Google Maps Platform en el frontend móvil de **app-turismo**. Las credenciales ya se crearon en la consola de Google Cloud, activando manualmente los servicios necesarios para el MVP turístico. Las claves se encuentran configuradas en el archivo [app-turismo/.env](file:///c:/Users/grivy/OneDrive/Desktop/Desarrollo/app-turismo-map/app-turismo/.env).

**🔌 APIs Seleccionadas y Habilitadas**

- **Maps SDK for Android:** Renderizado nativo y de alto rendimiento del mapa interactivo en dispositivos y emuladores Android a través de `react-native-maps`. Costo $0 en móviles.
- **Places API (New):** Motor de búsqueda, autocompletado y detalles (fotos, opiniones, horarios) para las atracciones turísticas y negocios de Valdivia.
- **Geocoding API:** Conversión de texto a coordenadas (para el buscador) y coordenadas a direcciones (geocodificación inversa para el click largo en el mapa).
- **Maps SDK for iOS:** Habilitada de forma preventiva para soporte de compilación multiplataforma en el futuro.

**🔑 Configuración de Seguridad y Restricciones**

- **Entorno de Desarrollo:** La clave de API se ha configurado sin restricciones de origen (opción *"Tal vez más tarde"*). Esto evita el bloqueo de origen (`RefererNotAllowedMapError`) debido a que las peticiones directas de red de la app móvil y del emulador no envían encabezados HTTP Referrer estándar.
- **Entorno de Producción (Futuro):** La clave nativa de Android se restringirá por **"Apps de Android"** utilizando la firma digital SHA-1 y el paquete nativo `com.grivy.appturismo`.

**⚙️ Configuración del Proyecto y Variables de Entorno**

Las credenciales están asignadas y centralizadas en el archivo [app-turismo/.env](file:///c:/Users/grivy/OneDrive/Desktop/Desarrollo/app-turismo-map/app-turismo/.env):

- **Mapeo Nativo:** El archivo [app.config.js](file:///c:/Users/grivy/OneDrive/Desktop/Desarrollo/app-turismo-map/app-turismo/app.config.js#L27-L31) está programado para inyectar dinámicamente estas claves en el manifiesto nativo de Android (`android.config.googleMaps.apiKey`) al compilar la app con Expo.
