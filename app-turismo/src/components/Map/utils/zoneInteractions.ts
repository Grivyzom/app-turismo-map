import type React from 'react';
import type maplibregl from 'maplibre-gl';
import { isClickInsideModalOrInput } from './mapClickGuards';
import type { TurismoEvent } from '../types';

/** Refs de estado del contenedor que usan los handlers de zonas/polígonos. */
export interface ZoneInteractionRefs {
  activeParkIdRef: React.MutableRefObject<any>;
  eventsRef: React.MutableRefObject<TurismoEvent[]>;
  isRoutingActiveRef: React.MutableRefObject<any>;
  markersRef: React.MutableRefObject<any>;
  onMapClickForRoutingRef: React.MutableRefObject<any>;
  onSectorPressRef: React.MutableRefObject<any>;
  onSelectEventRef: React.MutableRefObject<any>;
  selectedEventRef: React.MutableRefObject<any>;
  syncEventPolygonsRef: React.MutableRefObject<any>;
  updateAestheticsRef: React.MutableRefObject<any>;
}

/**
 * Registra clicks y hover sobre 'zones-fill' y 'event-polygons-fill'.
 * Los refs se leen en cada evento, así que siempre ven el estado vigente.
 */
export function registerZoneInteractions(
  map: maplibregl.Map,
  {
  activeParkIdRef,
    eventsRef,
    isRoutingActiveRef,
    markersRef,
    onMapClickForRoutingRef,
    onSectorPressRef,
    onSelectEventRef,
    selectedEventRef,
    syncEventPolygonsRef,
    updateAestheticsRef,
  }: ZoneInteractionRefs,
) {
  // Click on Sector
  map.on('click', 'zones-fill', (e) => {
    if ((e.originalEvent as any)._turismoHandled) return;
    if (isClickInsideModalOrInput(e)) return;
    if (isRoutingActiveRef.current && onMapClickForRoutingRef.current) {
      (e.originalEvent as any)._turismoHandled = true;
      onMapClickForRoutingRef.current({
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
      });
      return;
    }
    if (!e.features?.length) return;

    // Verificar si hay un evento con minimodal cerca del punto de clic
    const minimodalCategories = [
      'hospital',
      'universidad',
      'bombero',
      'carabinero',
      'camara',
      'fauna',
    ];
    const clickLng = e.lngLat.lng;
    const clickLat = e.lngLat.lat;

    let closestEvent: any = null;
    let closestDist = Infinity;

    for (const ev of eventsRef.current) {
      if (!minimodalCategories.includes(ev.category?.toLowerCase() || '')) continue;
      const dLat = (ev.latitude || 0) - clickLat;
      const dLng = (ev.longitude || 0) - clickLng;
      const dist = dLat * dLat + dLng * dLng;
      // ~150m de radio (0.0015 grados ≈ 150m)
      if (dist < 0.0015 * 0.0015 && dist < closestDist) {
        closestDist = dist;
        closestEvent = ev;
      }
    }

    if (closestEvent) {
      // Marcar como handled para que no se propague
      (e.originalEvent as any)._turismoHandled = true;

      // Simular clic en el pin del evento para abrir su minimodal
      const markerObj = markersRef.current[closestEvent.id];
      if (markerObj && markerObj.pinEl) {
        markerObj.pinEl.click();
      }
      return;
    }

    const feature = e.features[0];
    const props = feature.properties as any;
    // Incluir la geometría del feature para que activeNestedZone tenga geojson
    const zoneData = {
      ...props,
      geojson: feature.geometry,
    };
    if (onSectorPressRef.current) {
      onSectorPressRef.current(zoneData);
    }
  });
  map.on('mouseenter', 'zones-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'zones-fill', () => {
    map.getCanvas().style.cursor = '';
  });

  // Click on Event Polygons (e.g. Parques, Reservas)
  map.on('click', 'event-polygons-fill', (e) => {
    if ((e.originalEvent as any)._turismoHandled) return;
    if (isClickInsideModalOrInput(e)) return;
    if (isRoutingActiveRef.current && onMapClickForRoutingRef.current) {
      (e.originalEvent as any)._turismoHandled = true;
      const featureId = e.features?.[0]?.properties?.id;
      const event = featureId ? eventsRef.current.find((ev) => ev.id === featureId) : null;
      onMapClickForRoutingRef.current({
        latitude: event ? event.latitude : e.lngLat.lat,
        longitude: event ? event.longitude : e.lngLat.lng,
        name: event?.title,
        businessId: (event as any)?.businessId,
        eventId: event?.id,
        category: event?.category,
      });
      return;
    }
    (e.originalEvent as any)._turismoHandled = true;
    const featureId = e.features?.[0]?.properties?.id;
    if (featureId && onSelectEventRef.current) {
      const event = eventsRef.current.find((ev) => ev.id === featureId);
      if (event) {
        const categoryLower = event.category?.toLowerCase() || '';
        if (
          [
            'hospital',
            'clinica',
            'universidad',
            'bombero',
            'carabinero',
            'camara',
            'fauna',
          ].includes(categoryLower)
        ) {
          const markerObj = markersRef.current[event.id];
          if (markerObj && markerObj.pinEl) {
            const isLocal = markerObj.pinEl.dataset.localSelected === 'true';
            if (!isLocal) {
              markerObj.pinEl.click();
            }
          }
          return;
        }

        if (
          categoryLower === 'parque' ||
          categoryLower === 'reserva' ||
          categoryLower === 'reservas' ||
          categoryLower === 'naturaleza'
        ) {
          activeParkIdRef.current = event.id;
        }
        onSelectEventRef.current(event);
      }
    }
  });
  map.on('mouseenter', 'event-polygons-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'event-polygons-fill', (e) => {
    map.getCanvas().style.cursor = '';
    // Punto 2: cerrar minimodal del pin si el mouse sale del área
    if (!e.features?.length) return;
    const featureId = e.features[0].properties?.id;
    if (!featureId) return;
    const localCategories = [
      'hospital',
      'universidad',
      'bombero',
      'carabinero',
      'camara',
      'fauna',
    ];
    const event = eventsRef.current.find((ev) => ev.id === featureId);
    if (event && localCategories.includes(event.category?.toLowerCase() || '')) {
      const markerObj = markersRef.current[event.id];
      if (markerObj && markerObj.pinEl) {
        const pinEl = markerObj.pinEl;
        // Sólo cerrar si el pin no está siendo apuntado directamente
        if (pinEl.dataset.hovered !== 'true') {
          if (markerObj.closeTimeout) clearTimeout(markerObj.closeTimeout);
          markerObj.closeTimeout = setTimeout(() => {
            pinEl.dataset.localSelected = 'false';
            if (selectedEventRef.current?.id === event.id) {
              selectedEventRef.current = null;
              if (syncEventPolygonsRef.current) syncEventPolygonsRef.current();
            }
            if (updateAestheticsRef.current) updateAestheticsRef.current();
            delete markerObj.closeTimeout;
          }, 800);
        }
      }
    }
  });
}
