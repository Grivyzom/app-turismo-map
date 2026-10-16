import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';

import { AuthModal } from '../components/Auth/AuthModal';

import { MobileAppProvider, MobileTab, useMobileApp } from './MobileAppContext';
import { Option, OptionSheet } from './components/OptionSheet';
import { TabBar } from './components/TabBar';
import { useColors } from './components/ui';
import { AvisosScreen } from './screens/AvisosScreen';
import { ClimaScreen } from './screens/ClimaScreen';
import { GuiaScreen } from './screens/GuiaScreen';
import { InicioScreen } from './screens/InicioScreen';
import { MapaScreen } from './screens/MapaScreen';
import { PerfilScreen } from './screens/PerfilScreen';
import { RutasScreen } from './screens/RutasScreen';

const SCREENS: Record<MobileTab, React.ComponentType> = {
  inicio: InicioScreen,
  mapa: MapaScreen,
  guia: GuiaScreen,
  rutas: RutasScreen,
  perfil: PerfilScreen,
};

const GPS_KEY = '__gps__';

/** Duración del fundido entre pestañas. Corto: se percibe suave sin sentirse lento. */
const TAB_FADE_MS = 180;
/** Tras abrir la app, el mapa se monta oculto para que al entrar ya esté pintado. */
const MAP_PREWARM_DELAY_MS = 1200;

/**
 * Pestaña montada. La entrante se funde sobre la saliente, que queda visible
 * debajo hasta que termina el fundido (sin destello del fondo). Todo corre en
 * el hilo de UI con Reanimated, así que no compite con el JS ni con el mapa.
 */
function TabScene({
  visible,
  animateIn,
  children,
}: {
  visible: boolean;
  animateIn: boolean;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(visible && !animateIn ? 1 : 0);
  const first = useRef(true);

  useEffect(() => {
    const duration = reduceMotion ? 0 : TAB_FADE_MS;
    if (visible) {
      opacity.value = withTiming(1, { duration });
    } else if (!first.current) {
      // La saliente se oculta recién cuando la entrante ya la cubrió
      opacity.value = withDelay(duration, withTiming(0, { duration: 0 }));
    }
    first.current = false;
  }, [visible, reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { zIndex: visible ? 1 : 0 }, animatedStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

function Shell() {
  const {
    tab,
    setTab,
    overlay,
    setOverlay,
    sectorPickerOpen,
    setSectorPickerOpen,
    sectors,
    sectorName,
    setSectorOverride,
    usingSectorOverride,
    hasGps,
  } = useMobileApp();
  const colors = useColors();

  // Las pestañas visitadas quedan montadas: conservan scroll, chat y el mapa ya cargado
  const [mounted, setMounted] = useState<Set<MobileTab>>(() => new Set<MobileTab>(['inicio']));
  if (!mounted.has(tab)) setMounted(new Set(mounted).add(tab));

  // Precarga del mapa: el WebView, MapLibre, el estilo y las teselas tardan en
  // equipos modestos. Montarlo oculto mientras el usuario mira el Inicio evita
  // el mapa en blanco al entrar (oculto queda congelado y sin animaciones).
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted((prev) => (prev.has('mapa') ? prev : new Set(prev).add('mapa')));
    }, MAP_PREWARM_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Botón "atrás" de Android: cierra overlays y vuelve al Inicio antes de salir
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sectorPickerOpen) {
        setSectorPickerOpen(false);
        return true;
      }
      if (overlay) {
        setOverlay(null);
        return true;
      }
      if (tab !== 'inicio') {
        setTab('inicio');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [overlay, tab, sectorPickerOpen, setOverlay, setTab, setSectorPickerOpen]);

  const sectorOptions: Option<string>[] = [
    ...(hasGps
      ? [
          {
            key: GPS_KEY,
            label: 'Mi ubicación actual',
            hint: usingSectorOverride ? 'Detectar sector por GPS' : `Estás en ${sectorName}`,
            icon: 'navigate' as const,
          },
        ]
      : []),
    ...sectors.map((s) => ({ key: String(s.id), label: s.name })),
  ];
  // Con GPS activo y sin sector manual, la opción vigente es "Mi ubicación actual"
  const currentSectorKey =
    hasGps && !usingSectorOverride
      ? GPS_KEY
      : String(sectors.find((s) => s.name === sectorName)?.id ?? '');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />
      {[...mounted].map((key) => {
        const Component = SCREENS[key];
        return (
          <TabScene key={key} visible={key === tab} animateIn={key !== 'inicio'}>
            <Component />
          </TabScene>
        );
      })}

      {overlay ? (
        <View style={StyleSheet.absoluteFill}>
          {overlay === 'clima' ? <ClimaScreen /> : <AvisosScreen />}
        </View>
      ) : null}

      <TabBar />

      <OptionSheet
        visible={sectorPickerOpen}
        title="Elegir sector"
        options={sectorOptions.length ? sectorOptions : [{ key: GPS_KEY, label: 'Valdivia' }]}
        value={currentSectorKey || (sectorOptions.length ? null : GPS_KEY)}
        onSelect={(key) => {
          if (key === GPS_KEY) return setSectorOverride(null);
          setSectorOverride(sectors.find((s) => String(s.id) === key) ?? null);
        }}
        onClose={() => setSectorPickerOpen(false)}
      />

      <AuthModal />
    </View>
  );
}

/** Experiencia móvil nativa (Android / iOS): Inicio, Mapa, Guía, Rutas y Perfil. */
export default function MobileApp() {
  return (
    <MobileAppProvider>
      <Shell />
    </MobileAppProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
