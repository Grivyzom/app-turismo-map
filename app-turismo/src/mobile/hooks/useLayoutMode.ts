import { Platform, useWindowDimensions } from 'react-native';

import { layoutModeFor, LayoutMode } from '../layout';

/** `wide` en la web de escritorio (rail lateral, contenido centrado); `compact` en el resto. */
export function useLayoutMode(): LayoutMode {
  const { width } = useWindowDimensions();
  return layoutModeFor(Platform.OS, width);
}
