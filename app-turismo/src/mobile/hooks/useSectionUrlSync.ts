import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useIsFocused } from 'expo-router';

import { parseSection, Section, withSectionParam } from '../layout';

/** Marca en `history.state` de las entradas creadas por este hook (guarda la ruta de la pantalla). */
const MARK = '__seccion';

/** Handler vigente de la pantalla montada (uno solo: el shell es único). */
let popHandler: ((e: PopStateEvent) => void) | null = null;

// Se registra al cargar el módulo, antes de que expo-router agregue el suyo: en un Atrás real
// el de expo-router corre primero en orden de registro y remonta la pantalla.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => popHandler?.(e), true);
}

function currentParam() {
  return new URLSearchParams(window.location.search).get('s');
}

function marked() {
  return { ...window.history.state, [MARK]: window.location.pathname };
}

/**
 * Web: refleja la sección en `?s=` para que recargar o compartir el enlace la conserve.
 * Cada cambio apila una entrada de historial, así "Atrás" vuelve a la sección anterior.
 * Esas entradas se resuelven aquí y no llegan a expo-router: si no, reconstruiría la
 * pantalla desde la URL y se perdería todo lo montado (chat, scroll, mapa). En native no hace nada.
 */
export function useSectionUrlSync(tab: Section, setTab: (tab: Section) => void) {
  // Al montar y al volver con Atrás/Adelante la URL se corrige sin crear historial
  const replaceNext = useRef(true);
  const tabRef = useRef(tab);
  const isFocused = useIsFocused();
  const focused = useRef(isFocused);

  useEffect(() => {
    tabRef.current = tab;
    focused.current = isFocused;
  }, [tab, isFocused]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPop = (e: PopStateEvent) => {
      // Solo entradas propias de esta misma pantalla, y con ella al frente (no otra ruta encima)
      if (!focused.current || e.state?.[MARK] !== window.location.pathname) return;
      e.stopImmediatePropagation();
      const next = parseSection(currentParam());
      if (next === tabRef.current) return;
      replaceNext.current = true;
      setTab(next);
    };
    popHandler = onPop;
    return () => {
      if (popHandler === onPop) popHandler = null;
    };
  }, [setTab]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const replace = replaceNext.current;
    replaceNext.current = false;
    if (currentParam() === tab) return;
    const url = `${window.location.pathname}${withSectionParam(window.location.search, tab)}${window.location.hash}`;
    if (replace) {
      window.history.replaceState(marked(), '', url);
      return;
    }
    // La entrada actual también se marca: volver a ella es solo un cambio de sección
    window.history.replaceState(marked(), '');
    window.history.pushState(marked(), '', url);
  }, [tab]);
}
