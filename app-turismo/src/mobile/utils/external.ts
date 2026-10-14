import { Alert, Linking, Platform, Share } from 'react-native';

import type { Coordinate } from '../hooks/usePlacesData';

/** Busca un término cerca de un punto en la app de mapas del sistema (Apple Maps / Google Maps). */
export function searchNearbyInMaps(query: string, near: Coordinate) {
  const q = encodeURIComponent(query);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${q}&sll=${near.latitude},${near.longitude}`
      : `geo:${near.latitude},${near.longitude}?q=${q}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${q}&center=${near.latitude},${near.longitude}`,
    ),
  );
}

/** Indicaciones a pie hacia un punto en la app de mapas del sistema. */
export function openWalkingDirections(dest: Coordinate) {
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${dest.latitude},${dest.longitude}&dirflg=w`
      : `google.navigation:q=${dest.latitude},${dest.longitude}&mode=w`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}&travelmode=walking`,
    ),
  );
}

export function sharePlace(title: string, point: Coordinate) {
  Share.share({
    message: `${title}\nhttps://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`,
  }).catch(() => undefined);
}

function call(number: string) {
  Linking.openURL(`tel:${number.replace(/[^\d+]/g, '')}`).catch(() =>
    Alert.alert('No se pudo llamar', `Marca ${number} manualmente.`),
  );
}

/** Menú SOS: números de emergencia de Chile y el contacto de emergencia del perfil. */
export function openEmergencyMenu(contact: { name: string; phone: string }) {
  const buttons: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
    { text: 'Ambulancia (131)', onPress: () => call('131') },
    { text: 'Bomberos (132)', onPress: () => call('132') },
    { text: 'Carabineros (133)', onPress: () => call('133') },
  ];
  if (contact.phone.trim()) {
    buttons.push({
      text: `Llamar a ${contact.name || 'mi contacto'}`,
      onPress: () => call(contact.phone),
    });
  }
  buttons.push({ text: 'Cancelar', style: 'cancel' });
  Alert.alert('Emergencias', '¿A quién quieres llamar?', buttons);
}
