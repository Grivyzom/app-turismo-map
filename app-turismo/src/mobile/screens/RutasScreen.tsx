import React, { useMemo } from 'react';
import { View } from 'react-native';

import { useMobileApp } from '../MobileAppContext';
import { AppHeader } from '../components/AppHeader';
import { Screen } from '../components/Screen';
import { Card, PillButton, SectionHeader, T, useColors } from '../components/ui';
import { buildRecommendedRoute } from '../data/routes';
import { PlaceRow } from '../sections/PlaceRow';
import { RouteCard } from '../sections/RouteCard';

import { NavegacionView } from './NavegacionView';

/** Pestaña Rutas: ruta del día, alternativas por ritmo y lugares guardados; o la navegación en curso. */
export function RutasScreen() {
  const {
    activeRoute,
    recommendedRoute,
    places,
    origin,
    prefs,
    weather,
    sectorName,
    openProfile,
    openOnMap,
    isGuest,
    requireAccount,
  } = useMobileApp();
  const colors = useColors();

  // Alternativa con otro ritmo para quien quiere más (o menos) paradas
  const alternative = useMemo(() => {
    const rhythm = prefs.rhythm === 'intenso' ? 'tranquilo' : 'intenso';
    const route = buildRecommendedRoute(places, origin, {
      rhythm,
      isRainy: weather?.isRainy ?? false,
      reducedMobility: prefs.reducedMobility,
      sectorName,
    });
    return route && route.id !== recommendedRoute?.id ? { route, rhythm } : null;
  }, [
    places,
    origin,
    prefs.rhythm,
    prefs.reducedMobility,
    weather?.isRainy,
    sectorName,
    recommendedRoute?.id,
  ]);

  // Lo guardado requiere cuenta: el invitado no ve guardados de una sesión anterior en el teléfono
  const saved = useMemo(
    () => (isGuest ? [] : places.filter((p) => prefs.savedEventIds.includes(String(p.id)))),
    [isGuest, places, prefs.savedEventIds],
  );

  if (activeRoute) return <NavegacionView active={activeRoute} />;

  return (
    <Screen header={<AppHeader />}>
      <RouteCard route={recommendedRoute} onAdjust={openProfile} />

      {alternative ? (
        <RouteCard
          route={alternative.route}
          onAdjust={openProfile}
          eyebrow={
            alternative.rhythm === 'intenso'
              ? 'Si quieres aprovechar más el día'
              : 'Para un día más relajado'
          }
        />
      ) : null}

      <SectionHeader title="Guardados" hint={isGuest ? undefined : `${saved.length}`} />
      <Card>
        {isGuest ? (
          <View style={{ gap: 10, alignItems: 'flex-start' }}>
            <T variant="small" color={colors.textSecondary}>
              Inicia sesión para guardar lugares y encontrarlos aquí.
            </T>
            <PillButton label="Entrar" onPress={() => requireAccount('guardar')} />
          </View>
        ) : saved.length === 0 ? (
          <T variant="small" color={colors.textSecondary}>
            Aún no guardas lugares. Usa el botón «Guardar» en el Inicio o el corazón en el Mapa.
          </T>
        ) : (
          saved.map((p, i) => (
            <PlaceRow
              key={p.id}
              place={p}
              onPress={() => openOnMap(p)}
              divider={i < saved.length - 1}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
