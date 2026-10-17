import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import MobileApp from '../../src/mobile/MobileApp';
import { initialSection } from '../../src/mobile/layout';

/** Inicio de la app en todas las plataformas; en la web la sección sale de `?s=`. */
export default function HomeScreen() {
  const params = useLocalSearchParams<{ s?: string; action?: string }>();
  // Solo se lee al montar: después la sección vive en el estado del shell
  const [initialTab] = useState(() => initialSection(params));
  return <MobileApp initialTab={initialTab} />;
}
