import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AuthModal } from '../components/Auth/AuthModal';

import { MobileAppProvider, MobileTab, useMobileApp } from './MobileAppContext';
import { Option, OptionSheet } from './components/OptionSheet';
import { TabBar } from './components/TabBar';
import { useColors } from './components/ui';
import { AvisosScreen } from './screens/AvisosScreen';
import { ClimaScreen } from './screens/ClimaScreen';
import { EventOverlay } from './screens/EventoScreen';
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
    eventDetail,
    closeEvent,
  } = useMobileApp();
  const colors = useColors();

  // Las pestañas visitadas quedan montadas: conservan scroll, chat y el mapa ya cargado
  const [mounted, setMounted] = useState<Set<MobileTab>>(() => new Set<MobileTab>(['inicio']));
  if (!mounted.has(tab)) setMounted(new Set(mounted).add(tab));

  // Botón "atrás" de Android: cierra overlays y vuelve al Inicio antes de salir
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sectorPickerOpen) {
        setSectorPickerOpen(false);
        return true;
      }
      if (eventDetail) {
        closeEvent();
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
  }, [
    overlay,
    tab,
    sectorPickerOpen,
    eventDetail,
    closeEvent,
    setOverlay,
    setTab,
    setSectorPickerOpen,
  ]);

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
        const visible = key === tab;
        return (
          <View
            key={key}
            style={[StyleSheet.absoluteFill, !visible && styles.hidden]}
            pointerEvents={visible ? 'auto' : 'none'}
          >
            <Component />
          </View>
        );
      })}

      {overlay ? (
        <View style={StyleSheet.absoluteFill}>
          {overlay === 'clima' ? <ClimaScreen /> : <AvisosScreen />}
        </View>
      ) : null}

      <TabBar />

      {/* Ficha de evento: cubre también el dock, tiene su propia barra de acciones */}
      <EventOverlay />

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
  hidden: { opacity: 0, zIndex: -1 },
});
