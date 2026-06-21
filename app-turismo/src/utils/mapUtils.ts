import { ComponentProps } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export const getCategoryColor = (category: string, musicStyle?: string) => {
  if (category === 'musica' && musicStyle) {
    switch (musicStyle) {
      case 'jazz':
        return '#D97706'; // Gold/Amber
      case 'rock':
        return '#7C3AED'; // Purple/Indigo
      case 'electronica':
        return '#06B6D4'; // Neon Cyan
      case 'acustico':
        return '#EC4899'; // Hot Pink
      case 'pop':
      default:
        return '#F43F5E'; // Rose/Neon
    }
  }
  switch (category) {
    case 'cultura':
      return '#A78BFA'; // Morado brillante
    case 'gastronomia':
      return '#F59E0B'; // Ámbar
    case 'naturaleza':
    case 'parque':
      return '#10B981'; // Emerald
    case 'humedal':
      return '#059669'; // Teal
    case 'agua':
      return '#3B82F6'; // Blue
    case 'universidad':
      return '#8B5CF6'; // Purple
    case 'musica':
      return '#F43F5E'; // Rosa/Neon
    case 'deportes':
      return '#06B6D4'; // Cian
    case 'publico':
      return '#FBBF24'; // Amarillo ámbar
    case 'choque':
      return '#EF4444'; // Rojo brillante (peligro inmediato)
    case 'incendio':
      return '#F97316'; // Naranja fuego
    case 'accidente':
      return '#DC2626'; // Rojo oscuro/SAMU
    case 'calle_cortada':
      return '#78716C'; // Gris piedra/obras
    case 'museo':
      return '#4A5568'; // Gris azulado
    case 'coliseo':
      return '#A0AEC0'; // Gris piedra
    case 'puerto':
      return '#2B6CB0'; // Azul oceánico
    case 'teatro':
      return '#C53030'; // Rojo teatro
    case 'fauna':
      return '#2D3748'; // Gris oscuro
    case 'edificio':
      return '#475569'; // Slate
    case 'bosque':
      return '#065F46'; // Forest green
    case 'hospital':
      return '#DC2626'; // Red (Hospital)
    case 'bombero':
      return '#E53E3E'; // Red
    case 'carabinero':
      return '#2B6CB0'; // Police Blue
    case 'camara':
      return '#718096'; // Gray
    case 'tienda':
      return '#8B5CF6'; // Violeta/Tienda
    default:
      return '#3B82F6';
  }
};

export type CategoryIconName = ComponentProps<typeof MaterialIcons>['name'];

export const getCategoryIcon = (category: string, musicStyle?: string): CategoryIconName => {
  if (category === 'musica' && musicStyle) {
    switch (musicStyle) {
      case 'jazz':
        return 'queue-music';
      case 'rock':
        return 'album';
      case 'electronica':
        return 'headset';
      case 'acustico':
        return 'mic';
      case 'pop':
      default:
        return 'music-note';
    }
  }
  switch (category) {
    case 'cultura':
      return 'museum';
    case 'gastronomia':
      return 'restaurant';
    case 'naturaleza':
    case 'parque':
      return 'park';
    case 'humedal':
      return 'grass';
    case 'agua':
      return 'water';
    case 'universidad':
      return 'school';
    case 'musica':
      return 'music-note';
    case 'deportes':
      return 'sports-soccer';
    case 'publico':
      return 'groups'; // Icono de grupos para eventos públicos
    case 'choque':
      return 'car-crash';
    case 'incendio':
      return 'local-fire-department';
    case 'accidente':
      return 'warning';
    case 'calle_cortada':
      return 'block';
    case 'museo':
      return 'museum';
    case 'coliseo':
      return 'account-balance';
    case 'puerto':
      return 'anchor';
    case 'teatro':
      return 'theater-comedy';
    case 'fauna':
      return 'pets';
    case 'edificio':
      return 'location-city';
    case 'bosque':
      return 'forest';
    case 'hospital':
      return 'local-hospital';
    case 'bombero':
      return 'fire-extinguisher';
    case 'carabinero':
      return 'local-police';
    case 'camara':
      return 'videocam';
    case 'tienda':
      return 'store';
    default:
      return 'place';
  }
};
