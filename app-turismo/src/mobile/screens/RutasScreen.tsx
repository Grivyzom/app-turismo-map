import React, { useMemo } from 'react';

import { useMobileApp } from '../MobileAppContext';
import { AppHeader } from '../components/AppHeader';
import { Screen } from '../components/Screen';
import { Card, SectionHeader, T, useColors } from '../components/ui';
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
    setTab,
    openOnMap,
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

  const saved = useMemo(
    () => places.filter((p) => prefs.savedEventIds.includes(String(p.id))),
    [places, prefs.savedEventIds],
  );

  if (activeRoute) return <NavegacionView active={activeRoute} />;

  return (
    <Screen header={<AppHeader />}>
      <RouteCard route={recommendedRoute} onAdjust={() => setTab('perfil')} />

      {alternative ? (
        <RouteCard
          route={alternative.route}
          onAdjust={() => setTab('perfil')}
          eyebrow={
            alternative.rhythm === 'intenso'
              ? 'Si quieres aprovechar más el día'
              : 'Para un día más relajado'
          }
        />
      ) : null}

      <SectionHeader title="Guardados" hint={`${saved.length}`} />
      <Card>
        {saved.length === 0 ? (
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
