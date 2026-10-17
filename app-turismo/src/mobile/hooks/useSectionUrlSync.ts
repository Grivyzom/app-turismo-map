import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { parseSection, Section, withSectionParam } from '../layout';

function currentParam() {
  return new URLSearchParams(window.location.search).get('s');
}

/**
 * Web: refleja la sección en `?s=` para que recargar o compartir el enlace la conserve.
 * Cada cambio apila una entrada de historial, así "Atrás" vuelve a la sección anterior
 * sin remontar nada (es la misma pantalla de expo-router). En native no hace nada.
 */
export function useSectionUrlSync(tab: Section, setTab: (tab: Section) => void) {
  // Al montar y al volver con Atrás/Adelante la URL se corrige sin crear historial
  const replaceNext = useRef(true);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPop = () => {
      replaceNext.current = true;
      setTab(parseSection(currentParam()));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setTab]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const replace = replaceNext.current;
    replaceNext.current = false;
    if (currentParam() === tab) return;
    const url = `${window.location.pathname}${withSectionParam(window.location.search, tab)}${window.location.hash}`;
    window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', url);
  }, [tab]);
}
