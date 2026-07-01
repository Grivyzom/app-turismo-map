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
  ESTRUCTURAS_EVENTS,
  MUNICIPALIDAD_EVENT,
  FERIA_FLUVIAL_EVENT,
  PENDULO_VALDIVIA_EVENT,
  SUBMARINO_VALDIVIA_EVENT,
  MERCADO_MUNICIPAL_VALDIVIA_EVENT,
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
  | 'clinica'
  | 'bombero'
  | 'carabinero'
  | 'camara'
  | 'municipalidad'
  | 'escultura'
  | 'torreon'
  | 'estatua'
  | 'arte'
  | 'bosque'
  | 'mercado'
  | 'new_item'
  | 'invitation_club'
  | 'invitation_sports'
  | 'new_spot'
  | 'choque'
  | 'incendio'
  | 'accidente'
  | 'calle_cortada'
  | 'edificio';

const COMERCIAL_EVENTS: TurismoEvent[] = [
  {
    id: 'comercial-mercado-fluvial',
    title: 'Mercado Fluvial de Valdivia',
    description: 'Mercado a orillas del río Calle-Calle con pescaderías, fruterías y puestos de comida tradicional.',
    latitude: -39.8143,
    longitude: -73.2445,
    category: 'gastronomia',
    organizer: 'Municipalidad de Valdivia',
    time: '08:00 - 18:00',
    address: 'Ribera Norte s/n, Valdivia',
  },
  {
    id: 'comercial-kunstmann',
    title: 'Cervecería Kunstmann',
    description: 'Cervecería artesanal alemana emblemática de Valdivia, con museo de la cerveza y restaurante.',
    latitude: -39.7855,
    longitude: -73.2284,
    category: 'gastronomia',
    organizer: 'Kunstmann S.A.',
    time: '12:00 - 22:00',
    address: 'Ruta T-350 950, Valdivia',
  },
  {
    id: 'comercial-entrelagos',
    title: 'Restaurant Entrelagos',
    description: 'Restaurante con vista al río, especialidad en mariscos y cocina sureña chilena.',
    latitude: -39.8135,
    longitude: -73.2455,
    category: 'gastronomia',
    organizer: 'Entrelagos',
    time: '12:30 - 23:00',
    address: 'Pérez Rosales 640, Valdivia',
  },
  {
    id: 'comercial-cafe-haussmann',
    title: 'Café Haussmann',
    description: 'Café tradicional de Valdivia con influencia alemana, tortas artesanales y mapuche coffee.',
    latitude: -39.8138,
    longitude: -73.2468,
    category: 'gastronomia',
    organizer: 'Café Haussmann',
    time: '09:00 - 20:00',
    address: 'O\'Higgins 394, Valdivia',
  },
  {
    id: 'comercial-mall-portal',
    title: 'Mall Portal Valdivia',
    description: 'Centro comercial con tiendas, cines, patio de comidas y servicios en el centro de Valdivia.',
    latitude: -39.8168,
    longitude: -73.2452,
    category: 'tienda',
    organizer: 'Mall Plaza',
    time: '10:00 - 22:00',
    address: 'Arauco 561, Valdivia',
  },
  {
    id: 'comercial-feria-artesanos',
    title: 'Feria de Artesanos Valdivia',
    description: 'Feria permanente de artesanía local: textiles, madera y cerámica hecha por artesanos valdivíanos.',
    latitude: -39.8130,
    longitude: -73.2440,
    category: 'tienda',
    organizer: 'Asociación de Artesanos',
    time: '09:00 - 19:00',
    address: 'Costanera Arturo Prat, Valdivia',
  },
  {
    id: 'comercial-la-patagua',
    title: 'Restaurant La Patagua',
    description: 'Cocina chilena de autor con ingredientes del sur. Premiado por Guía Sernatur.',
    latitude: -39.8148,
    longitude: -73.2462,
    category: 'gastronomia',
    organizer: 'La Patagua',
    time: '13:00 - 23:30',
    address: 'Camilo Henríquez 164, Valdivia',
  },
  {
    id: 'comercial-zofri-valdivia',
    title: 'Centro Comercial Arauco',
    description: 'Tiendas de ropa, electrónica y accesorios en galería comercial céntrica.',
    latitude: -39.8155,
    longitude: -73.2436,
    category: 'tienda',
    organizer: 'Arauco Retail',
    time: '10:00 - 20:00',
    address: 'Arauco 330, Valdivia',
  },
];

export const INITIAL_EVENTS: TurismoEvent[] = [
  ...PARQUES_EVENTS,
  ...AGUA_EVENTS,
  ...HUMEDALES_EVENTS,
  ...UNIVERSIDADES_EVENTS,
  ...HOSPITALES_EVENTS,
  ...SEGURIDAD_EVENTS,
  ...ESTRUCTURAS_EVENTS,
  ...COMERCIAL_EVENTS,
  CASINO_DREAMS_EVENT,
  MUNICIPALIDAD_EVENT,
  FERIA_FLUVIAL_EVENT,
  PENDULO_VALDIVIA_EVENT,
  SUBMARINO_VALDIVIA_EVENT,
  MERCADO_MUNICIPAL_VALDIVIA_EVENT,
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
  clinica: { name: 'health-and-safety', family: 'MaterialIcons' },
  bombero: { name: 'fire-extinguisher', family: 'MaterialIcons' },
  carabinero: { name: 'local-police', family: 'MaterialIcons' },
  camara: { name: 'videocam', family: 'MaterialIcons' },
  municipalidad: { name: 'location-city', family: 'MaterialIcons' },
  mercado: { name: 'storefront', family: 'MaterialIcons' },
  bosque: { name: 'forest', family: 'MaterialIcons' },
  escultura: { name: 'account-balance', family: 'MaterialIcons' },
  torreon: { name: 'fort', family: 'MaterialIcons' },
  estatua: { name: 'accessibility-new', family: 'MaterialIcons' },
  arte: { name: 'palette', family: 'MaterialIcons' },
  new_item: { name: 'new-releases', family: 'MaterialIcons' },
  invitation_club: { name: 'local-activity', family: 'MaterialIcons' },
  invitation_sports: { name: 'sports-basketball', family: 'MaterialIcons' },
  new_spot: { name: 'park', family: 'MaterialIcons' },
  choque: { name: 'car-crash', family: 'MaterialIcons' },
  incendio: { name: 'local-fire-department', family: 'MaterialIcons' },
  accidente: { name: 'warning', family: 'MaterialIcons' },
  calle_cortada: { name: 'block', family: 'MaterialIcons' },
  edificio: { name: 'business', family: 'MaterialIcons' },
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
