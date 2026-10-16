import React, { ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapContainer } from '../../components/Map/MapContainer';
import { useUserLocationContext } from '../../context/UserLocationContext';
import { calculateDistance } from '../../utils/locationUtils';
import { fetchOsrmRoute, formatDistance, OsrmRoute } from '../../utils/osrmService';
import { ActiveRoute, useMobileApp } from '../MobileAppContext';
import {
  Card,
  IconButton,
  OutlineButton,
  PrimaryButton,
  T,
  Tag,
  useColors,
} from '../components/ui';
import { formatDurationShort } from '../data/routes';
import { walkMinutes } from '../hooks/usePlacesData';
import { useStableMapLocation } from '../hooks/useStableMapProps';
import { cardShadow, MobileRadii, MobileSpacing, TAB_BAR_HEIGHT } from '../theme';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const REROUTE_AFTER_M = 40;
const noop = () => undefined;
const ARRIVED_WITHIN_M = 35;

/** Navegación paso a paso de la ruta en curso (mapa + instrucción + progreso de paradas). */
export function NavegacionView({ active }: { active: ActiveRoute }) {
  const { advanceRoute, endRoute, origin, prefs, tab } = useMobileApp();
  const { userLocation } = useUserLocationContext();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const stop = active.route.stops[active.stopIndex];
  const here = userLocation ?? origin;
  const [leg, setLeg] = useState<OsrmRoute | null>(null);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const lastFetch = useRef<{ stopId: string; latitude: number; longitude: number } | null>(null);

  // Recalcular el tramo al cambiar de parada o al alejarse REROUTE_AFTER_M del último origen
  useEffect(() => {
    const prev = lastFetch.current;
    const sameStop = prev?.stopId === stop.place.id;
    if (sameStop) {
      const moved = calculateDistance(prev.latitude, prev.longitude, here.latitude, here.longitude);
      if (moved < REROUTE_AFTER_M) return;
    } else {
      setLeg(null);
    }

    // Sin abort en el cleanup: pequeñas variaciones del GPS no deben cancelar la petición en vuelo.
    // Solo se aplica la respuesta si sigue siendo la más reciente.
    const request = { stopId: stop.place.id, latitude: here.latitude, longitude: here.longitude };
    lastFetch.current = request;
    fetchOsrmRoute(here.latitude, here.longitude, stop.place.latitude, stop.place.longitude, 'foot')
      .then((route) => {
        if (lastFetch.current === request) setLeg(route);
      })
      .catch((err) => console.warn('[Navegacion] OSRM', err));
  }, [here.latitude, here.longitude, stop.place.id, stop.place.latitude, stop.place.longitude]);

  // "Compartir mi ruta en curso": aviso por SMS al contacto de emergencia al iniciar
  const sharedFor = useRef<string | null>(null);
  useEffect(() => {
    if (
      !prefs.shareActiveRoute ||
      !prefs.emergencyContact.phone ||
      sharedFor.current === active.route.id
    ) {
      return;
    }
    sharedFor.current = active.route.id;
    const body = encodeURIComponent(
      `Voy en ruta "${active.route.title}": ${active.route.stops.map((s) => s.place.title).join(' → ')}.`,
    );
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${prefs.emergencyContact.phone}${sep}body=${body}`).catch(() => undefined);
  }, [active.route, prefs.shareActiveRoute, prefs.emergencyContact.phone]);

  const remaining = calculateDistance(
    here.latitude,
    here.longitude,
    stop.place.latitude,
    stop.place.longitude,
  );
  const arrived = remaining <= ARRIVED_WITHIN_M;
  // steps[0] es la salida desde la posición actual; steps[1] es la próxima maniobra
  const first = leg?.steps[0];
  const next = leg?.steps[1] ?? first;
  const minutesLeft = leg ? Math.max(1, Math.round(leg.duration / 60)) : walkMinutes(remaining);
  const isLast = active.stopIndex === active.route.stops.length - 1;

  // Props estables para el mapa (WebView): ver useStableMapProps
  const stopPlaces = useMemo(() => active.route.stops.map((s) => s.place), [active.route]);
  const mapLocation = useStableMapLocation(userLocation);

  const confirmEnd = () =>
    Alert.alert('Terminar ruta', '¿Quieres terminar la ruta en curso?', [
      { text: 'Seguir', style: 'cancel' },
      { text: 'Terminar', style: 'destructive', onPress: endRoute },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <MapContainer
        events={stopPlaces}
        selectedEvent={null}
        onSelectEvent={noop}
        mapLayer="light"
        userLocation={mapLocation}
        navRouteGeojson={leg?.geojson ?? null}
        centerTrigger={centerTrigger}
        isFrozen={tab !== 'rutas'}
        mapDisplayMode="turismo"
        controlsTopOffset={insets.top + 110}
      />

      {/* Instrucción */}
      <View style={[styles.bannerWrap, { top: insets.top + 8 }]}>
        <View style={[styles.banner, { backgroundColor: colors.accent }, cardShadow]}>
          <View style={styles.maneuver}>
            <MaterialIcons
              name={(arrived ? 'place' : (next?.iconName ?? 'straight')) as MaterialIconName}
              size={26}
              color={colors.onAccent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="small" color="#BDBDBD">
              {arrived
                ? 'Destino'
                : first
                  ? `En ${formatDistance(first.distance)}`
                  : 'Calculando ruta…'}
            </T>
            <T variant="title" weight="700" color={colors.onAccent} numberOfLines={2}>
              {arrived
                ? `Llegaste a ${stop.place.title}`
                : (next?.instruction ?? `Camina hacia ${stop.place.title}`)}
            </T>
          </View>
        </View>
      </View>

      <View style={[styles.side, { bottom: insets.bottom + TAB_BAR_HEIGHT + 230 }]}>
        <IconButton
          icon="locate-outline"
          onPress={() => setCenterTrigger((n) => n + 1)}
          style={[{ backgroundColor: colors.surface }, cardShadow]}
          accessibilityLabel="Centrar en mi ubicación"
        />
      </View>

      {/* Progreso */}
      <View style={[styles.sheetWrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + 22 }]}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <T variant="small" color={colors.textSecondary} numberOfLines={1}>
                Parada {active.stopIndex + 1} de {active.route.stops.length} · {active.route.title}
              </T>
              <T variant="title" weight="700" numberOfLines={1}>
                {stop.place.title}
              </T>
            </View>
            <Tag label={formatDurationShort(minutesLeft)} />
          </View>
          <View style={styles.progress}>
            {active.route.stops.map((s, i) => (
              <View
                key={s.place.id}
                style={[
                  styles.segment,
                  { backgroundColor: i <= active.stopIndex ? colors.text : colors.surfaceSunken },
                ]}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <PrimaryButton
              label={isLast ? 'Finalizar' : 'Ya llegué'}
              onPress={advanceRoute}
              style={{ flex: 1 }}
            />
            <OutlineButton label="Terminar ruta" onPress={confirmEnd} />
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: { position: 'absolute', left: MobileSpacing.screen, right: MobileSpacing.screen },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: MobileRadii.card,
  },
  maneuver: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: { position: 'absolute', right: MobileSpacing.screen },
  sheetWrap: { position: 'absolute', left: MobileSpacing.screen, right: MobileSpacing.screen },
  progress: { flexDirection: 'row', gap: 6, marginTop: 12 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
});
