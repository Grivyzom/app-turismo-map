/** Tipo de viñeta (badge) que se muestra en el borde superior del pin */
export type VinetaType =
  | 'en_vivo' // Transmisión en vivo - rojo neón/morado
  | 'agendado' // Evento agendado - naranja/azul claro
  | 'calificacion' // Calificación estrellas - amarillo/naranja
  | 'oferta' // Oferta/Promoción - azul/rosa
  | 'aforo' // Nivel de aforo - turquesa
  | 'disponibilidad' // Disponibilidad - verde agua
  | 'mantenimiento'; // Mantenimiento - cian

export interface Vineta {
  type: VinetaType;
  label?: string; // Texto corto (e.g. "4.5", "2x1", "80%")
  value?: number; // Valor numérico (e.g. rating 4.5, aforo 80)
  active?: boolean; // Si la viñeta está activa/visible (default true)
}

export interface TurismoEvent {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  category:
    | 'cultura'
    | 'gastronomia'
    | 'naturaleza'
    | 'musica'
    | 'deportes'
    | 'publico'
    | 'choque'
    | 'incendio'
    | 'accidente'
    | 'calle_cortada'
    | 'embarcacion'
    | 'museo'
    | 'coliseo'
    | 'puerto'
    | 'teatro'
    | 'fauna'
    | 'tienda'
    | 'parque'
    | 'agua'
    | 'humedal'
    | 'universidad'
    | 'edificio'
    | 'bosque'
    | 'hospital'
    | 'bombero'
    | 'carabinero'
    | 'camara'
    | 'escultura'
    | 'torreon'
    | 'estatua'
    | 'arte';
  organizer: string;
  time: string;
  attendeesCount?: number;
  imageUrl?: string;
  markerSvg?: string; // Raw SVG string for custom pins (e.g. for fauna)
  address?: string; // Dirección física del evento
  isRealTime?: boolean; // Destaca si fue agregado por WebSocket
  status?: 'agendado' | 'en_proceso' | 'finalizado';
  radius?: number; // Radio en metros para dibujar un círculo
  polygon?: { latitude: number; longitude: number }[]; // Coordenadas para un polígono
  musicStyle?: 'jazz' | 'rock' | 'electronica' | 'acustico' | 'pop';
  // Boat properties
  boatType?: 'pesquero' | 'turismo' | 'transbordador' | 'velero' | 'deportivo';
  boatSize?: 'pequena' | 'mediana' | 'grande';
  boatSpeed?: number;
  boatHeading?: number;
  boatPassengers?: number;
  // Store properties
  openingHours?: string;
  catalog?: {
    id: number;
    name: string;
    price: number;
    imageUrl?: string;
  }[];
  contactPhone?: string;
  contactEmail?: string;
  branchId?: number;
  extrusionHeight?: number; // Altura para relieve 3D específico (metros)
  floor_level?: number; // Para filtros dinámicos en Malls/Edificios (Piso 1, Piso 2, etc.)
  // Viñeta (Badge) properties
  vineta?: Vineta;
  // Modal Standalone Properties
  distancia?: string;
  anioFundacion?: string;
  nivelEducativo?: string;
  instagram?: string;
  linkedin?: string;
  facebook?: string;
  galeria?: string[]; // Arrays of images or emojis for the header
  // Navegación Interior
  indoorMap?: {
    floors: { level: number; label: string }[];
    defaultFloor: number;
  };
}

/** Sector/Zona delimitada (polígono) creada en el backend, p.ej. Parques/Reservas, Edificios */
export interface Zone {
  id: number;
  name: string;
  description?: string;
  category?: string;
  color?: string;
  isActive: boolean;
  geojson?: any;
  eventsCount: number;
  rating?: number | null;
  images?: string[];
  openingHours?: string;
  parkType?: string;
}

export type MapLayer = 'dark' | 'streets' | 'light' | 'satellite' | 'terrain';

export type UserLocation = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null; // en km/h
  accuracy: number | null; // en metros
  heading: number | null; // en grados (0-359)
  headingDirection: string | null; // N, NE, E, etc.
} | null;

export type MapCoordinate = {
  latitude: number;
  longitude: number;
  x?: number;
  y?: number;
  surface?: 'land' | 'water';
};

/** Zoom máximo permitido por capa. Satellite permite overscaling más allá del nativo. */
export const MAX_ZOOM_PER_LAYER: Record<MapLayer, number> = {
  dark: 18,
  streets: 18,
  light: 18,
  satellite: 20, // ESRI nativo ~19, overscaling suave hasta 20
  terrain: 17,
};

/** Zoom máximo para capas de clima para evitar "Zoom level not supported" */
export const MAX_WEATHER_ZOOM = 18;
/**
 * Desde enero 2026, la API gratuita de RainViewer limita el zoom máximo a 7.
 * Zoom > 7 devuelve una imagen con "Zoom Level Not Supported".
 * MapLibre/Google Maps harán overscaling automático de los tiles de nivel 7.
 */
export const MAX_RAINVIEWER_ZOOM = 7;

/** Estadísticas del caché de tiles satelitales */
export interface TileCacheStats {
  totalTiles: number;
  memoryMB: number;
  hitRate: number;
}

export interface MapContainerProps {
  events: TurismoEvent[];
  selectedEvent: TurismoEvent | null;
  onSelectEvent: (event: TurismoEvent | null) => void;
  mapLayer: MapLayer;
  userLocation?: UserLocation;
  centerTrigger?: number;
  tacticalMode?: boolean;
  onTacticalLocationChange?: (location: MapCoordinate | null) => void;
  onMapPincho?: (location: MapCoordinate) => void;
  mapPincho?: MapCoordinate | null;
  onMapMove?: () => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onBoundsChange?: (bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }) => void;
  showTraffic?: boolean;
  showCycleways?: boolean;
  cyclewaysData?: any[];
  showSectors?: boolean;
  sectorsData?: any[];
  visibleSectorIds?: number[];
  onSectorPress?: (zone: any) => void;
  activeNestedZone?: any;
  isMagicWandActive?: boolean;
  onMagicWandSelect?: (geometry: any) => void;
  showWeather?: boolean;
  weatherType?: 'clouds' | 'precipitation' | 'pressure' | 'wind' | 'temp';
  isFrozen?: boolean;
  onSaveLocation?: (locationData: {
    locationType: 'event' | 'custom_pin';
    refId?: string;
    latitude: number;
    longitude: number;
    title: string;
    notes?: string;
  }) => void;

  // Routing Props (Geo-Router)
  isRoutingActive?: boolean;
  routingType?: RouteType;
  draftRoutePoints?: RoutePoint[];
  onMapClickForRouting?: (location: MapCoordinate) => void;
  isRouteFinished?: boolean;
  savedRoutes?: Route[];
  onRateRoute?: (routeId: string, rating: number) => void;
  activeFloor?: number | null;
}

export interface Cluster {
  id: string;
  latitude: number;
  longitude: number;
  isCluster: true;
  events: TurismoEvent[];
}

export type MapItem = TurismoEvent | Cluster;

// ── Routing Types (Geo-Router) ──────────────────────────────────────────

export type RouteType =
  | 'direct'
  | 'single_target'
  | 'multi_target'
  | 'ciclovia'
  | 'sector'
  | 'measure';

export type RoutePointType = 'origin' | 'destination' | 'target' | 'waypoint';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  type: RoutePointType;
  name?: string;
  orderIndex: number;
}

export interface Route {
  id: string;
  name: string;
  type: RouteType;
  category: string;
  businessId: number;
  businessName: string;
  points: RoutePoint[];
  targetAudience: 'local' | 'tourist' | 'all';
  isFeatured?: boolean;
  ratingAvg?: number;
}
