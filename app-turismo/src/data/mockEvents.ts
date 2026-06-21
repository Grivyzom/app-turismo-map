import { TurismoEvent } from '../components/Map/types';
import { MapLayer } from '../components/Map/types';

import {
  PARQUES_EVENTS,
  AGUA_EVENTS,
  HUMEDALES_EVENTS,
  UNIVERSIDADES_EVENTS,
  CASINO_DREAMS_EVENT,
  HOSPITALES_EVENTS,
  SEGURIDAD_EVENTS,
} from './polygonsData';

export type CategoryFilter =
  | 'todos'
  | 'ninguno'
  | 'gastronomia'
  | 'cultura'
  | 'naturaleza'
  | 'musica'
  | 'deportes'
  | 'publico'
  | 'emergencia'
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
  | 'hospital'
  | 'bombero'
  | 'carabinero'
  | 'camara';

export const INITIAL_EVENTS: TurismoEvent[] = [
  ...PARQUES_EVENTS,
  ...AGUA_EVENTS,
  ...HUMEDALES_EVENTS,
  ...UNIVERSIDADES_EVENTS,
  ...HOSPITALES_EVENTS,
  ...SEGURIDAD_EVENTS,
  CASINO_DREAMS_EVENT,
];

export const WS_SIMULATION_POOL: Omit<TurismoEvent, 'id' | 'isRealTime'>[] = [];

export const CATEGORY_ICONS: Record<
  CategoryFilter,
  { name: any; family: 'Ionicons' | 'MaterialIcons' }
> = {
  todos: { name: 'apps', family: 'Ionicons' },
  ninguno: { name: 'visibility-off', family: 'MaterialIcons' },
  gastronomia: { name: 'restaurant', family: 'MaterialIcons' },
  cultura: { name: 'museum', family: 'MaterialIcons' },
  naturaleza: { name: 'park', family: 'MaterialIcons' },
  musica: { name: 'music-note', family: 'MaterialIcons' },
  deportes: { name: 'sports-soccer', family: 'MaterialIcons' },
  publico: { name: 'groups', family: 'MaterialIcons' },
  emergencia: { name: 'warning', family: 'MaterialIcons' },
  embarcacion: { name: 'directions-boat', family: 'MaterialIcons' },
  museo: { name: 'museum', family: 'MaterialIcons' },
  coliseo: { name: 'account-balance', family: 'MaterialIcons' },
  puerto: { name: 'anchor', family: 'MaterialIcons' },
  teatro: { name: 'theater-comedy', family: 'MaterialIcons' },
  fauna: { name: 'pets', family: 'MaterialIcons' },
  tienda: { name: 'store', family: 'MaterialIcons' },
  parque: { name: 'park', family: 'MaterialIcons' },
  agua: { name: 'water', family: 'MaterialIcons' },
  humedal: { name: 'grass', family: 'MaterialIcons' },
  universidad: { name: 'school', family: 'MaterialIcons' },
  hospital: { name: 'local-hospital', family: 'MaterialIcons' },
  bombero: { name: 'fire-extinguisher', family: 'MaterialIcons' },
  carabinero: { name: 'local-police', family: 'MaterialIcons' },
  camara: { name: 'videocam', family: 'MaterialIcons' },
};

export const MAP_LAYER_OPTIONS: {
  key: MapLayer;
  label: string;
  iconName: any;
  iconFamily: 'Ionicons' | 'MaterialIcons';
}[] = [
  { key: 'dark', label: 'Noche', iconName: 'moon', iconFamily: 'Ionicons' },
  { key: 'streets', label: 'Día', iconName: 'sunny', iconFamily: 'Ionicons' },
  { key: 'satellite', label: 'Satélite', iconName: 'satellite', iconFamily: 'MaterialIcons' },
  { key: 'terrain', label: 'Relieve', iconName: 'terrain', iconFamily: 'MaterialIcons' },
];
