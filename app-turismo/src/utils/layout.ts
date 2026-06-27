import { Platform } from 'react-native';

// Navbar horizontal anclada arriba — constantes compartidas para que widgets
// flotantes del mapa (clima, badges, tarjetas) sepan cuánto espacio dejar debajo.
// Despeje del notch/status bar: real en iOS, chico en Android, nulo en web
// (el navegador no tiene barra de estado superpuesta sobre el viewport).
export const NAVBAR_TOP = Platform.select({ ios: 56, android: 16, default: 0 }) as number;
// Altura delgada, a tono con unifiedControlsContainer (botón 36/44px + padding 4px*2)
export const NAVBAR_HEIGHT = 50;
export const NAVBAR_CLEARANCE = NAVBAR_TOP + NAVBAR_HEIGHT + 16;
