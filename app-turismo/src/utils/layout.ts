import { Platform } from 'react-native';

// Isla flotante suspendida sobre el mapa (Floating HUD)
// Despeje del notch/status bar: real en iOS, chico en Android, margen estético en web.
export const NAVBAR_TOP = Platform.select({ ios: 52, android: 16, default: 12 }) as number;
// Altura compacta unificada de la isla flotante
export const NAVBAR_HEIGHT = 52;
export const NAVBAR_CLEARANCE = NAVBAR_TOP + NAVBAR_HEIGHT + 14;
