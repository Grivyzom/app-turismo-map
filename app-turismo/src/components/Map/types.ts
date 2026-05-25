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
}

export type MapLayer = 'dark' | 'streets' | 'satellite' | 'terrain';

export type UserLocation = { latitude: number; longitude: number; accuracy?: number } | null;

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
}
