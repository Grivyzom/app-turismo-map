/**
 * Configuración Global del Proveedor de Mapas
 *
 * Permite cambiar rápidamente el proveedor de mapas en toda la aplicación
 * (tanto en Móvil como en Web) modificando una sola variable.
 */

export type MapProviderType = 'google' | 'open-source';

export const MAP_CONFIG = {
  /**
   * Proveedor de mapas activo:
   * - 'google': Usa Google Maps premium (en Móvil usa el SDK nativo, en Web usa celdas de Google Maps).
   * - 'open-source': Usa mapas gratuitos (en Móvil usa mapas del sistema, en Web usa OpenFreeMap y ESRI).
   */
  provider: 'open-source' as MapProviderType, // Cambia a 'open-source' si quieres evitar Google Maps
};
