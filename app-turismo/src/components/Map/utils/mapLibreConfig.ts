import { getActiveMapStyles, withCartoKey, CARTO_API_KEY } from '../../../config/mapStyles.web';

/**
 * Umbrales de las animaciones ambientales de los pines.
 * Por debajo de estos zooms el mapa es contexto, no detalle: apagarlas
 * evita decenas de animaciones simultáneas sin que se note nada.
 */
export const AMBIENT_MIN_ZOOM = 12.5;
/** Con más pines que esto en pantalla sólo animan los críticos y el activo. */
export const AMBIENT_MAX_MARKERS = 70;

/**
 * Interruptor global de edificios 3D. En false la capa nativa 'building-3d'
 * se mantiene en el estilo (otras capas la usan como ancla de orden) pero
 * queda oculta, y el footprint 2D 'building' se ve a todo zoom.
 * Todo el código de LOD sigue ahí: poner en true para reactivarlo.
 */
export const ENABLE_BUILDINGS_3D = false;

/**
 * LOD de edificios 3D: 'building-3d' es una capa nativa del estilo que
 * extruye TODO edificio visible sin importar distancia a cámara — con
 * ciudades densas y pitch alto eso es el mayor costo de fill-rate del mapa
 * (paredes extruidas de miles de edificios lejanos que casi no se notan).
 * Se limita la extrusión real a un círculo alrededor del centro de cámara;
 * fuera de ese círculo la altura queda en 0 (footprint plano == solo 2D).
 */
export const BUILDING_3D_MAX_RADIUS_METERS = 650;
/** Rampa de crecimiento: a este pitch empieza a levantarse desde el footprint plano. */
export const BUILDING_3D_MIN_PITCH = 8;
/** ...y a este pitch ya está a su altura real completa. */
export const BUILDING_3D_FULL_PITCH = 35;

// URL de estilo vectorial Dark Matter (CARTO si hay API key, o OpenFreeMap Dark libre y sin marcas de agua)
export const CARTO_VECTOR_STYLE_URL = CARTO_API_KEY
  ? withCartoKey('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json')
  : 'https://tiles.openfreemap.org/styles/dark';

export const mapStyles = getActiveMapStyles();
