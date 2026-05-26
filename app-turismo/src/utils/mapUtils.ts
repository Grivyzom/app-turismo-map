import { ComponentProps } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export const getCategoryColor = (category: string) => {
  switch (category) {
    case 'cultura':
      return '#A78BFA'; // Morado brillante
    case 'gastronomia':
      return '#F59E0B'; // Ámbar
    case 'naturaleza':
      return '#34D399'; // Esmeralda
    case 'musica':
      return '#F43F5E'; // Rosa/Neon
    case 'deportes':
      return '#06B6D4'; // Cian
    case 'publico':
      return '#FBBF24'; // Amarillo ámbar
    default:
      return '#3B82F6';
  }
};

export type CategoryIconName = ComponentProps<typeof MaterialIcons>['name'];

export const getCategoryIcon = (category: string): CategoryIconName => {
  switch (category) {
    case 'cultura':
      return 'museum';
    case 'gastronomia':
      return 'restaurant';
    case 'naturaleza':
      return 'park';
    case 'musica':
      return 'music-note';
    case 'deportes':
      return 'sports-soccer';
    case 'publico':
      return 'groups'; // Icono de grupos para eventos públicos
    default:
      return 'place';
  }
};
