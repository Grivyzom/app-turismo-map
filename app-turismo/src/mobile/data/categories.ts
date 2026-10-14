import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { TurismoEvent } from '../../components/Map/types';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Agrupación de las categorías del mapa en los 4 accesos rápidos del wireframe. */
export type QuickCategory = 'todo' | 'comer' | 'naturaleza' | 'cultura' | 'transporte';

export const QUICK_CATEGORIES: {
  key: Exclude<QuickCategory, 'todo'>;
  label: string;
  icon: IoniconName;
}[] = [
  { key: 'comer', label: 'Comer', icon: 'restaurant-outline' },
  { key: 'naturaleza', label: 'Naturaleza', icon: 'leaf-outline' },
  { key: 'cultura', label: 'Cultura', icon: 'library-outline' },
  { key: 'transporte', label: 'Transporte', icon: 'bus-outline' },
];

const GROUPS: Record<Exclude<QuickCategory, 'todo'>, string[]> = {
  comer: ['gastronomia', 'mercado', 'tienda'],
  naturaleza: ['naturaleza', 'parque', 'humedal', 'bosque', 'agua', 'fauna', 'sendero'],
  cultura: [
    'cultura',
    'museo',
    'teatro',
    'arte',
    'escultura',
    'estatua',
    'torreon',
    'universidad',
    'musica',
    'coliseo',
  ],
  transporte: ['embarcacion', 'puerto'],
};

/** Mobiliario urbano e infraestructura: existe en el mapa pero no es "un lugar para visitar". */
const NON_VISITABLE = new Set([
  'banca',
  'silla',
  'basurero',
  'papelera',
  'bebedero',
  'camara',
  'maquina_ejercicio',
  'ejercicio',
  'choque',
  'incendio',
  'accidente',
  'calle_cortada',
  'hospital',
  'clinica',
  'bombero',
  'carabinero',
  'bano',
]);

const EVENT_CATEGORIES = new Set([
  'musica',
  'deportes',
  'invitation_club',
  'invitation_sports',
  'new_item',
  'teatro',
]);

export function quickCategoryOf(category: string): Exclude<QuickCategory, 'todo'> | null {
  for (const key of Object.keys(GROUPS) as Exclude<QuickCategory, 'todo'>[]) {
    if (GROUPS[key].includes(category)) return key;
  }
  return null;
}

export function matchesQuickCategory(event: TurismoEvent, filter: QuickCategory): boolean {
  if (filter === 'todo') return true;
  return GROUPS[filter].includes(event.category);
}

export function isVisitable(event: TurismoEvent): boolean {
  return !NON_VISITABLE.has(event.category) && !event.isSmartNotification;
}

export function isEventLike(event: TurismoEvent): boolean {
  if (event.status === 'finalizado') return false;
  return event.status !== undefined || EVENT_CATEGORIES.has(event.category);
}

const LABELS: Record<string, string> = {
  gastronomia: 'Comer',
  mercado: 'Mercado',
  tienda: 'Tienda',
  naturaleza: 'Naturaleza',
  parque: 'Parque',
  humedal: 'Humedal',
  bosque: 'Bosque',
  agua: 'Río',
  fauna: 'Fauna',
  sendero: 'Sendero',
  cultura: 'Cultura',
  museo: 'Museo',
  teatro: 'Teatro',
  arte: 'Arte',
  escultura: 'Escultura',
  estatua: 'Monumento',
  torreon: 'Patrimonio',
  universidad: 'Universidad',
  musica: 'Música',
  deportes: 'Deporte',
  coliseo: 'Coliseo',
  embarcacion: 'Embarcación',
  puerto: 'Muelle',
  municipalidad: 'Servicio público',
  publico: 'Público',
};

export function categoryLabel(category: string): string {
  return (
    LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
  );
}

export function categoryIcon(category: string): IoniconName {
  switch (quickCategoryOf(category)) {
    case 'comer':
      return 'restaurant-outline';
    case 'naturaleza':
      return 'leaf-outline';
    case 'cultura':
      return 'library-outline';
    case 'transporte':
      return 'boat-outline';
    default:
      return 'location-outline';
  }
}
