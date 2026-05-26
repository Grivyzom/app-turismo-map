export interface TurismoEvent {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  category: 'cultura' | 'gastronomia' | 'naturaleza' | 'musica' | 'deportes';
  organizer: string;
  time: string;
  attendeesCount: number;
  imageUrl?: string;
  isRealTime?: boolean; // Destaca si fue agregado por WebSocket
  status?: 'agendado' | 'en_proceso' | 'finalizado';
  radius?: number; // Radio en metros para dibujar un círculo
  polygon?: Array<{ latitude: number; longitude: number }>; // Coordenadas para un polígono
}

export type MapLayer = 'dark' | 'streets' | 'satellite' | 'terrain' | 'light';

export type UserLocation = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null; // en km/h
  accuracy: number | null; // en metros
  heading: number | null; // en grados (0-359)
  headingDirection: string | null; // N, NE, E, etc.
} | null;

/** Zoom máximo permitido por capa. Satellite permite overscaling más allá del nativo. */
export const MAX_ZOOM_PER_LAYER: Record<MapLayer, number> = {
  dark: 18,
  streets: 18,
  light: 18,
  satellite: 20, // ESRI nativo ~19, overscaling suave hasta 20
  terrain: 17,
};

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
  onTacticalLocationChange?: (
    location: { latitude: number; longitude: number; x?: number; y?: number } | null,
  ) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  showTraffic?: boolean;
}
