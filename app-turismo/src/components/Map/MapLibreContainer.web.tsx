import React, { useEffect, useRef, useCallback, useState } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { StyleSheet, View } from 'react-native';
import { createRoot, Root } from 'react-dom/client';

import { VALDIVIA_LAT, VALDIVIA_LNG } from '../../constants/location';
import { getCategoryColor, getCategoryIcon } from '../../utils/mapUtils';
import { addMissingStyleImage, applyDarkTheme } from '../../utils/mapWebUtils';
import { getActiveMapStyles, getSatelliteStyle } from '../../config/mapStyles.web';
import { SatelliteTileCache } from '../../utils/satelliteTileCache';
import { TrafficTileCache, TRAFFIC_PROTOCOL } from '../../utils/trafficTileCache';
import { useSuperclusterEvents, getClusterDominantColor } from '../../utils/clusterUtils';
import { radialMenuRegistry } from '../../utils/radialMenuRegistry';
import { getLatestRadarPath } from '../../utils/weatherUtils';
import { CICLOVIAS_GEOJSON } from '../../data/ciclovias';
import { MOBILIARIO_GEOJSON } from '../../data/mobiliarioData';
import { FloorSelector } from '../MapUI/FloorSelector';

import { MiniModal } from './Markers/MiniModal';
import { AuthorityModal } from './Markers/AuthorityModal';
import {
  MapContainerProps,
  MAX_ZOOM_PER_LAYER,
  MAX_WEATHER_ZOOM,
  MAX_RAINVIEWER_ZOOM,
  TurismoEvent,
  Cluster,
  Vineta,
  VinetaType,
} from './types';

// URL de estilo público vectorial de CARTO - Dark Matter (Selva Valdiviana Base)
const CARTO_VECTOR_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const mapStyles = getActiveMapStyles();

const metersPerPixelAtZoom = (latitude: number, zoom: number) => {
  const latRad = (latitude * Math.PI) / 180;
  return (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom);
};

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const getAccuracyRadiusAtZoom = (accuracyMeters: number, latitude: number, zoom: number) => {
  const minRadius = 2;
  const metersPerPixel = metersPerPixelAtZoom(latitude, zoom);
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
    return minRadius;
  }
  return Math.max(minRadius, accuracyMeters / metersPerPixel);
};

function detectSurfaceType(map: maplibregl.Map, lng: number, lat: number): 'land' | 'water' {
  try {
    const point = map.project([lng, lat]);
    const canvas = map.getCanvas();
    if (!canvas) return 'land';
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
      return 'land';
    }
    const features = map.queryRenderedFeatures(point);
    const isWater = features.some((f) => {
      const layerId = f.layer?.id?.toLowerCase() || '';
      const sourceLayer = f.sourceLayer?.toLowerCase() || '';
      return (
        layerId.includes('water') ||
        layerId.includes('river') ||
        layerId.includes('lake') ||
        layerId.includes('ocean') ||
        sourceLayer.includes('water')
      );
    });
    return isWater ? 'water' : 'land';
  } catch (e) {
    return 'land';
  }
}

function detectSurfaceTypeForBoat(map: maplibregl.Map, lng: number, lat: number): 'land' | 'water' {
  try {
    const point = map.project([lng, lat]);
    const canvas = map.getCanvas();
    if (!canvas) return 'water';
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    // If the coordinates are off-screen, assume water to allow the boat to continue flowing
    // and be steering-corrected once it returns to the screen.
    if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
      return 'water';
    }
    const features = map.queryRenderedFeatures(point);
    const isWater = features.some((f) => {
      const layerId = f.layer?.id?.toLowerCase() || '';
      const sourceLayer = f.sourceLayer?.toLowerCase() || '';
      return (
        layerId.includes('water') ||
        layerId.includes('river') ||
        layerId.includes('lake') ||
        layerId.includes('ocean') ||
        sourceLayer.includes('water')
      );
    });
    return isWater ? 'water' : 'land';
  } catch (e) {
    return 'water';
  }
}

function renderBoatFlatMarker(flatEl: HTMLDivElement, event: TurismoEvent) {
  flatEl.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'marker-flat-container';
  Object.assign(container.style, {
    position: 'relative',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transformOrigin: 'center center',
  });

  const heading = event.boatHeading || 0;
  const size = event.boatSize || 'mediana';
  const type = event.boatType || 'deportivo';

  // Determine size dimensions for boat shadow and wake offsets
  let w = 24;
  let h = 24;
  let wakeWidth = 8;
  let wakeHeight = 20;
  let wakeLeftOffset = '10px';
  let wakeRightOffset = '10px';
  let foamBottom = '-10px';
  let foamSize = '6px';

  if (size === 'grande') {
    w = 32;
    h = 32;
    wakeWidth = 10;
    wakeHeight = 28;
    wakeLeftOffset = '13px';
    wakeRightOffset = '13px';
    foamBottom = '-14px';
    foamSize = '9px';
  } else if (size === 'mediana') {
    w = 28;
    h = 28;
    wakeWidth = 9;
    wakeHeight = 24;
    wakeLeftOffset = '11px';
    wakeRightOffset = '11px';
    foamBottom = '-12px';
    foamSize = '8px';
  } else {
    // pequena
    w = 24;
    h = 24;
    wakeWidth = 7;
    wakeHeight = 18;
    wakeLeftOffset = '9px';
    wakeRightOffset = '9px';
    foamBottom = '-8px';
    foamSize = '6px';
  }

  // Dynamic V-shaped wake trailing behind the boat
  const wakeContainer = document.createElement('div');
  wakeContainer.className = 'boat-wake-container';
  Object.assign(wakeContainer.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '32px',
    height: '32px',
    transform: `translate(-50%, -50%) rotate(${heading}deg)`,
    pointerEvents: 'none',
    zIndex: '0',
  });

  // Soft, blurred, rotated underwater shadow representing the boat hull
  const boatShadow = document.createElement('div');
  boatShadow.className = 'boat-underwater-shadow';
  Object.assign(boatShadow.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: `${w}px`,
    height: `${h}px`,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: '-1',
    filter: 'blur(3.5px)',
    opacity: '0.45',
  });

  // Determine shadow hull shape SVG path based on boat type
  let shadowPath = 'M16 2 C19 6, 21 16, 21 26 C21 28, 11 28, 11 26 C11 16, 13 6, 16 2 Z'; // default (yacht/deportivo)
  if (type === 'velero') {
    shadowPath = 'M16 2 C18 6, 23 18, 23 24 C23 26, 9 26, 9 24 C9 18, 14 6, 16 2 Z';
  } else if (type === 'transbordador') {
    shadowPath = 'M16 2 C19 5, 21 12, 21 26 C21 29, 11 29, 11 26 C11 12, 13 5, 16 2 Z';
  }

  boatShadow.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="${shadowPath}" fill="#082f49"/>
    </svg>
  `;

  // Left wake wave
  const wakeL = document.createElement('div');
  wakeL.className = 'boat-wake-left';
  Object.assign(wakeL.style, {
    position: 'absolute',
    bottom: '0px',
    left: wakeLeftOffset,
    width: `${wakeWidth}px`,
    height: `${wakeHeight}px`,
    borderLeft: '1.5px dashed rgba(96, 165, 250, 0.65)',
    filter: 'blur(0.5px)',
    transformOrigin: 'bottom center',
    animation: 'boatWakeLeft 1.8s infinite linear',
  });

  // Right wake wave
  const wakeR = document.createElement('div');
  wakeR.className = 'boat-wake-right';
  Object.assign(wakeR.style, {
    position: 'absolute',
    bottom: '0px',
    right: wakeRightOffset,
    width: `${wakeWidth}px`,
    height: `${wakeHeight}px`,
    borderRight: '1.5px dashed rgba(96, 165, 250, 0.65)',
    filter: 'blur(0.5px)',
    transformOrigin: 'bottom center',
    animation: 'boatWakeRight 1.8s infinite linear',
  });

  // Soft wake bubble/foam directly behind the boat
  const wakeFoam = document.createElement('div');
  Object.assign(wakeFoam.style, {
    position: 'absolute',
    bottom: foamBottom,
    left: '50%',
    width: foamSize,
    height: foamSize,
    borderRadius: '50%',
    backgroundColor: 'rgba(219, 234, 254, 0.45)',
    filter: 'blur(1.5px)',
    animation: 'boatFoam 1.5s infinite ease-out',
    transformOrigin: 'top center',
  });

  const bowWave = document.createElement('div');
  bowWave.className = 'boat-bow-wave';

  wakeContainer.appendChild(boatShadow);
  wakeContainer.appendChild(wakeL);
  wakeContainer.appendChild(wakeR);
  wakeContainer.appendChild(wakeFoam);
  wakeContainer.appendChild(bowWave);
  container.appendChild(wakeContainer);

  flatEl.appendChild(container);
}

function renderBoatMarker(pinEl: HTMLDivElement, event: TurismoEvent, isSelected: boolean) {
  pinEl.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'marker-boat-container';

  const size = event.boatSize || 'mediana';
  const heading = event.boatHeading || 0;
  const type = event.boatType || 'deportivo';

  // Determine size dimensions
  let w = 24;
  let h = 24;
  let color = '#06B6D4'; // cyan for small
  if (size === 'grande') {
    w = 32;
    h = 32;
    color = '#F8FAFC'; // white for large
  } else if (size === 'mediana') {
    w = 28;
    h = 28;
    color = '#F59E0B'; // orange for medium
  }

  Object.assign(container.style, {
    position: 'relative',
    width: `${w}px`,
    height: `${h}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  // Inner wrapper that handles scale / hover / selection
  const wrapper = document.createElement('div');
  wrapper.className = 'marker-3d-pin-wrapper';
  Object.assign(wrapper.style, {
    position: 'absolute',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transformOrigin: 'center center',
  });

  // Bobbing container (removed bobbing class for boats so they stick to the surface)
  const bobbingContainer = document.createElement('div');
  // bobbingContainer.className = 'marker-bobbing';
  Object.assign(bobbingContainer.style, {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  // The actual Boat SVG Element
  const boat = document.createElement('div');
  boat.className = 'marker-boat-body'; // subtle bobbing parent, static rotation child
  Object.assign(boat.style, {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: `rotate(${heading}deg)`,
  });

  // Select SVG based on boat type
  let svgContent = '';
  if (type === 'velero') {
    // Sailboat SVG
    svgContent = `
      <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2 C18 6, 23 18, 23 24 C23 26, 9 26, 9 24 C9 18, 14 6, 16 2 Z" fill="${color}" stroke="#111827" stroke-width="2"/>
        <path d="M16 4 L16 22 M16 8 L21 16 L16 18" stroke="#111827" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `;
  } else if (type === 'transbordador') {
    // Ferry/Large ship SVG
    svgContent = `
      <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2 C19 5, 21 12, 21 26 C21 29, 11 29, 11 26 C11 12, 13 5, 16 2 Z" fill="${color}" stroke="#111827" stroke-width="2"/>
        <rect x="13" y="10" width="6" height="12" rx="1" fill="#475569" stroke="#111827" stroke-width="1.5"/>
        <rect x="14" y="14" width="4" height="4" fill="#E2E8F0"/>
      </svg>
    `;
  } else {
    // Yacht / Speedboat SVG (default)
    svgContent = `
      <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2 C19 6, 21 16, 21 26 C21 28, 11 28, 11 26 C11 16, 13 6, 16 2 Z" fill="${color}" stroke="#111827" stroke-width="2"/>
        <path d="M13 14 L19 14 L17 22 L15 22 Z" fill="#E2E8F0" stroke="#111827" stroke-width="1.5"/>
        <rect x="14" y="8" width="4" height="4" rx="0.5" fill="#1E293B"/>
      </svg>
    `;
  }

  boat.innerHTML = svgContent;
  bobbingContainer.appendChild(boat);
  wrapper.appendChild(bobbingContainer);
  container.appendChild(wrapper);

  pinEl.appendChild(container);
}

function renderFlatMarker(
  flatEl: HTMLDivElement,
  event: TurismoEvent,
  color: string,
  isEmergencyState: boolean,
) {
  flatEl.innerHTML = '';
  const categoryLower = event.category?.toLowerCase() || '';
  if (
    categoryLower === 'parque' ||
    categoryLower === 'reserva' ||
    categoryLower === 'reservas' ||
    categoryLower === 'naturaleza'
  ) {
    flatEl.style.width = '0px';
    flatEl.style.height = '0px';
    flatEl.style.pointerEvents = 'none';
    return;
  }
  const container = document.createElement('div');
  container.className = 'marker-flat-container';
  Object.assign(container.style, {
    position: 'absolute',
    width: '0px',
    height: '0px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transformOrigin: 'center center',
  });

  // 1. Realistic 3D Shadow Container
  const shadowContainer = document.createElement('div');
  shadowContainer.className = 'marker-3d-shadow-container';
  Object.assign(shadowContainer.style, {
    position: 'absolute',
    bottom: '0px',
    display: 'flex',
    flexDirection: 'column-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    pointerEvents: 'none',
    zIndex: '0',
    transformOrigin: 'bottom center',
  });

  const shadowStem = document.createElement('div');
  shadowStem.className = 'marker-3d-shadow-stem';
  Object.assign(shadowStem.style, {
    width: '2px',
    height: '0px',
    background: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, ${color} 100%)`,
    boxShadow: `0 0 4px ${hexToRgba(color, 0.6)}`,
    transformOrigin: 'bottom center',
  });
  shadowContainer.appendChild(shadowStem);

  const shadowPin = document.createElement('div');
  shadowPin.className = 'marker-3d-shadow-pin';
  Object.assign(shadowPin.style, {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    filter: 'blur(1.5px)',
  });
  shadowContainer.appendChild(shadowPin);

  container.appendChild(shadowContainer);

  // 1b. Puncture point
  const puncture = document.createElement('div');
  puncture.className = 'marker-3d-puncture';
  Object.assign(puncture.style, {
    position: 'absolute',
    top: '-2px',
    left: '-2px',
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    backgroundColor: '#111827',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 0 2px rgba(0,0,0,0.8) inset',
    opacity: '0.8',
    zIndex: '2',
  });
  container.appendChild(puncture);

  // 2. Flat Waves (Ondas redimensionadas y centradas)
  if (event.category === 'publico' && !isEmergencyState) {
    const wave1 = document.createElement('div');
    Object.assign(wave1.style, {
      position: 'absolute',
      top: '-12px',
      left: '-12px',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: color,
      animation: 'webPublicPulse 2.5s infinite ease-out',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    const maxScale = 1.2 + (Math.min(event.attendeesCount || 0, 1000) / 1000) * 0.8;
    wave1.style.setProperty('--max-scale', String(maxScale));

    const wave2 = document.createElement('div');
    Object.assign(wave2.style, {
      position: 'absolute',
      top: '-12px',
      left: '-12px',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: color,
      animation: 'webPublicPulse 2.5s infinite ease-out',
      animationDelay: '1.25s',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    wave2.style.setProperty('--max-scale', String(maxScale * 0.7));

    container.appendChild(wave1);
    container.appendChild(wave2);
  }

  // 3. Flat Rotating Security Cordon
  if (isEmergencyState) {
    const cordon = document.createElement('div');
    Object.assign(cordon.style, {
      position: 'absolute',
      top: '-22px',
      left: '-22px',
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      border: `2.5px dashed ${color}`,
      backgroundColor: `${color}10`,
      animation:
        'emergencyPerimeterRotate 16s linear infinite, emergencyPerimeterFlash 2s infinite ease-in-out',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    container.appendChild(cordon);
  }

  // 4. Social Proof
  if (event.attendeesCount && event.attendeesCount > 200 && !isEmergencyState) {
    const popularAura = document.createElement('div');
    Object.assign(popularAura.style, {
      position: 'absolute',
      top: '-14px',
      left: '-14px',
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      border: '2px solid #FCD34D',
      boxShadow: '0 0 12px #FCD34D',
      animation: 'popularAuraPulse 3s infinite ease-out',
      pointerEvents: 'none',
      zIndex: '-2',
    });
    container.appendChild(popularAura);
  }

  flatEl.appendChild(container);
}

// ─── SVG Icon Configuration ─────────────────────────────────────────────
const SVG_ICON_PATHS: Record<string, string> = {
  // Viñetas
  videocam:
    'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
  event:
    'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-5-7H7v2h7v-2z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  local_offer:
    'M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z',
  person:
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  build:
    'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.3C.5 6.7.9 9.8 2.9 11.8c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.1z',

  // Categories / Pin Icons
  'queue-music':
    'M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z',
  album:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z',
  headset:
    'M12 2c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z',
  mic: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  'music-note':
    'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  museum: 'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h20v-3H2v3zm14-12v7h3v-7h-3zm-4-7L2 9v1h20V9L12 3z',
  restaurant:
    'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm4-3v7h3v10h2V2h-5c0 2.21 1.79 4 4 4z',
  park: 'M17 12h2L12 2 5 12h2v7H5v2h14v-2h-2v-7zm-5-7.8L16.2 11H7.8L12 4.2zM9 14h6v5H9v-5z',
  'sports-soccer':
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8t3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z',
  groups:
    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  'car-crash':
    'M18 1c-2.76 0-5 2.24-5 5 0 .28.02.55.07.82L9.41 9.49C8.56 8.57 7.35 8 6 8c-3.31 0-6 2.69-6 6s2.69 6 6 6c1.35 0 2.56-.57 3.41-1.49l3.66 2.67c-.05.27-.07.54-.07.82 0 2.76 2.24 5 5 5s5-2.24 5-5-2.24-5-5-5zm-12 15c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm12 5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
  'local-fire-department':
    'M19.48 12.35c-1.57-4.08-7.16-6.7-5.81-11.75-.1.08-.2.15-.3.23-3.61 2.96-4.38 7.63-1.42 10.66 2.44 2.5 2.16 6.47-.4 8.68-1.32-1.14-1.85-2.76-1.59-4.31-1.02 1.11-2.34 2.28-2.28 4.29.04.81.39 1.59.97 2.15C10.74 24.38 15.82 24 18.29 20.86c2.28-2.9 2.76-5.41 1.19-8.51z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  block:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm5.31-3.1L6.9 5.69A7.966 7.966 0 0112 4c4.41 0 8 3.59 8 8 0 1.85-.63 3.55-1.69 4.9z',
  'account-balance':
    'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h20v-3H2v3zm14-12v7h3v-7h-3zm-4-7L2 9v1h20V9L12 3z',
  anchor:
    'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm1 4h-2v4H5v2h6v6c-3.31 0-6-2.69-6-6H3c0 4.97 4.03 9 9 9s9-4.03 9-9h-2c0 3.31-2.69 6-6 6v-6h6v-2h-6V6z',
  'theater-comedy':
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3.5 9c-.83 0-1.5-.67-1.5-1.5S7.67 8 8.5 8s1.5.67 1.5 1.5S9.33 11 8.5 11zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 8 15.5 8s1.5.67 1.5 1.5S16.33 11 15.5 11zm-7 4h7c.28 0 .5.22.5.5C16 17.43 14.2 19 12 19s-4-1.57-4-3.5c0-.28.22-.5.5-.5z',
  pets: 'M4.5 9.5c.83 0 1.5-.67 1.5-1.5S5.33 6.5 4.5 6.5 3 7.17 3 8s.67 1.5 1.5 1.5zM9 7c.83 0 1.5-.67 1.5-1.5S9.83 4 9 4s-1.5.67-1.5 1.5S8.17 7 9 7zm6 0c.83 0 1.5-.67 1.5-1.5S15.83 4 15 4s-1.5.67-1.5 1.5S14.17 7 15 7zm3.5 2.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM12 9c-2.21 0-4 1.79-4 4 0 1.5 1.5 3 3.5 3.5 1.15.26 2.35.26 3.5 0 2-.5 3.5-2 3.5-3.5 0-2.21-1.79-4-4-4z',
  store:
    'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5zm-14 3h10v4H7v-4z',
  place:
    'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  'push-pin':
    'M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1.03 1 1.03-1v-7H19v-2c-1.66 0-3-1.34-3-3z',

  // Radial Menu Icons
  info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  bookmark: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z',
  directions:
    'M21.71 11.29l-9-9c-.39-.39-1.02-.39-1.41 0l-9 9c-.39.39-.39 1.02 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9c.39-.38.39-1.01 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z',
};

/**
 * Creates an inline SVG element for a predefined icon.
 */
function createSvgIcon(iconName: string, size = 15, color = '#FFFFFF'): SVGElement | null {
  const pathData = SVG_ICON_PATHS[iconName];
  if (!pathData) return null;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  Object.assign(svg.style, {
    width: `${size}px`,
    height: `${size}px`,
    fill: color,
    flexShrink: '0',
  });

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);

  return svg;
}

// ─── Viñeta (Badge) Configuration ─────────────────────────────────────────────
const VINETA_CONFIG: Record<
  VinetaType,
  {
    bg: string;
    glow: string;
    iconName: string; // SVG icon name matching SVG_ICON_PATHS
    defaultLabel: string;
  }
> = {
  en_vivo: {
    bg: 'linear-gradient(135deg, #EF4444 0%, #A855F7 100%)',
    glow: 'rgba(239, 68, 68, 0.7)',
    iconName: 'videocam',
    defaultLabel: 'LIVE',
  },
  agendado: {
    bg: 'linear-gradient(135deg, #F97316 0%, #38BDF8 100%)',
    glow: 'rgba(249, 115, 22, 0.6)',
    iconName: 'event',
    defaultLabel: 'Agendado',
  },
  calificacion: {
    bg: 'linear-gradient(135deg, #F59E0B 0%, #EAB308 100%)',
    glow: 'rgba(245, 158, 11, 0.6)',
    iconName: 'star',
    defaultLabel: '★',
  },
  oferta: {
    bg: 'linear-gradient(135deg, #3B82F6 0%, #EC4899 100%)',
    glow: 'rgba(59, 130, 246, 0.6)',
    iconName: 'local_offer',
    defaultLabel: 'Oferta',
  },
  aforo: {
    bg: 'linear-gradient(135deg, #14B8A6 0%, #06B6D4 100%)',
    glow: 'rgba(20, 184, 166, 0.6)',
    iconName: 'groups',
    defaultLabel: 'Aforo',
  },
  disponibilidad: {
    bg: 'linear-gradient(135deg, #34D399 0%, #6EE7B7 100%)',
    glow: 'rgba(52, 211, 153, 0.6)',
    iconName: 'person',
    defaultLabel: 'Disp.',
  },
  mantenimiento: {
    bg: 'linear-gradient(135deg, #22D3EE 0%, #67E8F9 100%)',
    glow: 'rgba(34, 211, 238, 0.6)',
    iconName: 'build',
    defaultLabel: 'Mant.',
  },
};

/**
 * Renderiza una viñeta (badge) circular en el borde superior del pin.
 * La viñeta es un pequeño círculo con ícono + texto superpuesto
 * exactamente en el borde superior del pin principal (28px de diámetro).
 */
function renderVinetaBadge(pinWrapper: HTMLDivElement, vineta: Vineta) {
  if (vineta.active === false) return;

  const config = VINETA_CONFIG[vineta.type];
  if (!config) return;

  const label = vineta.label || config.defaultLabel;
  const hasLabel = label && label.length > 0;
  const isWideLabel = hasLabel && label.length > 2;

  // Compute dynamic smart coloring and custom animation classes based on values
  let bg = config.bg;
  let glow = config.glow;
  let animClass = '';
  let customStyles: Record<string, string> = {};

  if (vineta.type === 'aforo' && typeof vineta.value === 'number') {
    if (vineta.value >= 80) {
      bg = 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)'; // Red-orange (crowded/busy)
      glow = 'rgba(239, 68, 68, 0.75)';
      animClass = 'vineta-critical-pulse'; // dynamic warning pulse for crowded venues
    } else if (vineta.value >= 50) {
      bg = 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)'; // Amber/Yellow (moderate load)
      glow = 'rgba(245, 158, 11, 0.6)';
    } else {
      bg = 'linear-gradient(135deg, #34D399 0%, #10B981 100%)'; // Emerald/Green (uncongested / quiet)
      glow = 'rgba(16, 185, 129, 0.6)';
    }
  } else if (vineta.type === 'calificacion' && typeof vineta.value === 'number') {
    if (vineta.value >= 4.5) {
      // Luxury Gold gradient with linear sheen sweep animation
      bg = 'linear-gradient(120deg, #F2C94C 0%, #FFF5C0 50%, #F2994A 100%)';
      glow = 'rgba(242, 201, 76, 0.8)';
      animClass = 'vineta-gold-sparkle';
      customStyles = {
        backgroundSize: '200% auto',
      };
    } else if (vineta.value >= 3.8) {
      bg = 'linear-gradient(135deg, #E2E8F0 0%, #94A3B8 100%)'; // Silver
      glow = 'rgba(148, 163, 184, 0.5)';
    } else {
      bg = 'linear-gradient(135deg, #D97706 0%, #78350F 100%)'; // Bronze
      glow = 'rgba(180, 83, 9, 0.4)';
    }
  } else if (vineta.type === 'disponibilidad' && typeof vineta.value === 'number') {
    if (vineta.value <= 5) {
      bg = 'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)'; // Red (urgent/highly limited)
      glow = 'rgba(239, 68, 68, 0.8)';
      animClass = 'vineta-critical-pulse';
    } else {
      bg = 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%)'; // Teal (good availability)
      glow = 'rgba(20, 184, 166, 0.6)';
    }
  } else if (vineta.type === 'oferta') {
    bg = 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)'; // Neon hot pink / purple
    glow = 'rgba(236, 72, 153, 0.75)';
    animClass = 'vineta-heartbeat'; // heartbeat pulse animation for hot offers
  } else if (vineta.type === 'en_vivo') {
    animClass = 'vineta-en_vivo';
  }

  // Badge container: positioned at top center of the 28px pin circle
  const badge = document.createElement('div');
  badge.className = `vineta-badge ${animClass}`;
  badge.dataset.wideLabel = isWideLabel ? 'true' : 'false';
  badge.dataset.vinetaType = vineta.type; // Save type for automatic zoom expansion

  Object.assign(badge.style, {
    position: 'absolute',
    top: '-6px', // Overlap with top edge of 28px pin
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    height: '16px',
    minWidth: '16px',
    width: '16px', // Start collapsed, dynamically expanded in updateAesthetics
    padding: '0',
    borderRadius: '50%',
    background: bg,
    boxShadow: `0 2px 8px ${glow}, 0 0 0 1.5px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25)`,
    zIndex: '10',
    pointerEvents: 'none',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'default',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    ...customStyles,
  });

  // Default entry animation if not using customized animClass
  if (!animClass) {
    badge.style.animation = 'vinetaEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
  }

  // Create and append inline SVG icon
  const svg = createSvgIcon(config.iconName, 10, '#FFFFFF');
  if (svg) {
    badge.appendChild(svg);
  }

  // Label text
  if (hasLabel) {
    const labelSpan = document.createElement('span');
    labelSpan.className = 'vineta-label';
    Object.assign(labelSpan.style, {
      fontSize: '8px',
      fontWeight: '700',
      color: '#FFFFFF',
      lineHeight: '1',
      textShadow: '0 1px 2px rgba(0,0,0,0.4)',
      letterSpacing: '0.3px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    });
    labelSpan.innerText = label;
    badge.appendChild(labelSpan);
  }

  // Glow ring for 'en_vivo' type (pulsing ring behind badge)
  if (vineta.type === 'en_vivo') {
    const glowRing = document.createElement('div');
    glowRing.className = 'vineta-glow-ring';
    Object.assign(glowRing.style, {
      position: 'absolute',
      top: '-3px',
      left: '-3px',
      right: '-3px',
      bottom: '-3px',
      borderRadius: 'inherit',
      border: '1.5px solid rgba(239, 68, 68, 0.6)',
      animation: 'vinetaGlowRing 1.8s infinite ease-in-out',
      pointerEvents: 'none',
    });
    badge.appendChild(glowRing);
  }

  pinWrapper.appendChild(badge);
}

function renderLoboMarinoMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapStyleLayer?: string,
) {
  pinEl.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'marker-lobo-marino-container';
  Object.assign(container.style, {
    position: 'relative',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    filter: isSelected
      ? 'drop-shadow(0 0 8px rgba(255,255,255,0.8))'
      : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
    transition: 'transform 0.3s ease, filter 0.3s ease',
  });

  const isDark = mapStyleLayer === 'dark';

  if (event.markerSvg) {
    container.innerHTML = event.markerSvg;
    // Set color to blue if selected, else white/dark gray depending on theme
    const svgEl = container.querySelector('svg');
    if (svgEl) {
      svgEl.style.width = '100%';
      svgEl.style.height = '100%';
      svgEl.style.fill = isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748';
      svgEl.style.color = isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748';
    }
    pinEl.appendChild(container);
    return;
  } else if (
    event.imageUrl &&
    event.imageUrl !==
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&q=80&w=800'
  ) {
    const img = document.createElement('img');
    img.src = event.imageUrl;
    Object.assign(img.style, {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    });
    container.appendChild(img);
    pinEl.appendChild(container);
    return;
  }

  // Helper to sanitize fauna name (e.g. "Lobo Marino" -> "lobo_marino", "Pudú" -> "pudu")
  const getSanitizedName = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/(^_|_$)/g, '');
  };

  const name = getSanitizedName(event.title || 'lobo_marino');
  const suffix = isDark ? '_blanca' : '';
  const filename = `${name}${suffix}.svg`;
  const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
  const primaryUrl = `${baseUrl}/assets/svg/${filename}`;
  const fallbackUrl = `${baseUrl}/assets/svg/lobo_marino${suffix}.svg`;

  // Draw default lobo marino icon immediately as fallback
  const renderFallback = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1770 1200');
    Object.assign(svg.style, {
      width: '100%',
      height: '100%',
    });

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(0, 1200) scale(0.1, -0.1)');
    g.setAttribute('fill', isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748');

    const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p1.setAttribute(
      'd',
      'M13970 11984 c-270 -36 -493 -101 -713 -207 -467 -225 -795 -555 -995 -1002 -138 -307 -206 -591 -307 -1265 -68 -455 -187 -951 -286 -1191 l-40 -96 -87 -64 c-277 -205 -506 -438 -759 -772 -64 -84 -87 -106 -176 -165 -410 -274 -847 -459 -1787 -757 -623 -197 -947 -321 -1445 -552 -653 -304 -1357 -761 -1945 -1263 -344 -293 -486 -427 -1120 -1055 -473 -469 -559 -544 -715 -620 -345 -169 -718 -247 -1560 -325 -786 -74 -1159 -175 -1506 -409 -187 -126 -278 -217 -299 -302 -27 -108 19 -165 205 -255 120 -58 497 -193 588 -209 20 -4 37 -10 37 -14 0 -3 -28 -14 -63 -24 -187 -55 -491 -195 -642 -295 -229 -152 -388 -409 -336 -544 18 -48 61 -76 169 -112 336 -111 610 -154 1029 -163 320 -7 475 3 740 47 482 80 885 222 1381 484 157 83 220 120 664 389 114 69 229 132 255 141 111 37 256 49 588 50 185 0 375 -5 450 -12 431 -42 1071 -142 1580 -247 591 -122 951 -195 1085 -219 239 -44 545 -96 598 -103 29 -3 52 -9 52 -12 0 -3 -83 -48 -184 -99 -334 -167 -479 -306 -481 -459 0 -53 4 -67 30 -105 78 -110 330 -163 835 -175 733 -17 1779 93 2446 257 505 124 741 277 938 607 34 57 42 64 89 78 94 28 550 187 652 227 232 92 613 284 814 409 51 33 96 59 100 59 3 0 35 -42 71 -92 35 -51 116 -145 180 -209 346 -347 712 -458 1615 -490 633 -22 1204 18 1575 112 230 58 338 118 385 214 33 66 30 123 -10 191 -81 138 -288 233 -797 364 -267 70 -356 98 -439 140 -137 71 -296 205 -411 348 -190 239 -331 602 -433 1122 l-26 135 71 150 c229 476 351 894 419 1435 48 373 48 734 0 1155 -31 278 -58 422 -198 1072 -63 288 -134 671 -163 874 -17 125 -22 204 -22 419 -1 290 9 396 50 520 39 118 84 175 194 247 271 177 441 334 567 525 182 275 273 541 273 795 0 251 -68 449 -201 584 -125 126 -259 171 -644 214 -268 30 -315 46 -518 180 -307 202 -590 308 -922 345 -124 14 -369 11 -495 -6z m630 -377 c58 -14 139 -37 180 -52 112 -41 310 -144 449 -235 206 -135 298 -172 468 -189 89 -9 94 -11 135 -50 27 -27 72 -54 131 -78 106 -44 142 -80 177 -180 30 -85 58 -113 115 -113 36 0 47 5 71 33 16 19 34 42 40 53 10 16 13 8 19 -49 11 -101 -2 -220 -36 -322 -42 -126 -53 -131 -43 -20 13 153 12 172 -19 202 -50 51 -147 28 -147 -35 0 -40 -65 -151 -138 -237 -127 -148 -355 -312 -540 -390 -280 -117 -537 -119 -764 -4 -71 36 -88 36 -127 3 -41 -34 -43 -88 -5 -133 35 -42 169 -105 279 -132 114 -28 309 -30 430 -5 284 61 555 211 796 443 l86 83 16 -36 c16 -32 16 -37 1 -67 -64 -126 -222 -284 -402 -401 -163 -106 -206 -145 -280 -254 -50 -72 -73 -97 -134 -137 -40 -26 -143 -99 -228 -160 -168 -121 -336 -231 -442 -289 -37 -20 -74 -46 -83 -59 -39 -55 2 -127 73 -127 65 0 290 119 535 282 65 44 120 78 122 76 1 -2 -4 -37 -11 -78 -7 -41 -17 -147 -20 -235 l-7 -159 -58 -88 c-148 -226 -281 -550 -374 -913 -42 -162 -108 -493 -175 -869 -99 -562 -174 -886 -275 -1191 -320 -970 -829 -1702 -1539 -2214 -48 -35 -89 -62 -91 -60 -2 3 3 30 10 63 24 103 78 494 71 520 -15 59 -87 78 -123 32 -21 -26 -102 -239 -239 -628 -143 -405 -182 -554 -274 -1043 -144 -768 -302 -1165 -532 -1343 -262 -201 -1060 -365 -2173 -444 -224 -16 -992 -18 -1018 -2 -15 9 2 20 110 71 70 34 243 111 383 172 467 204 643 302 838 465 216 182 400 464 495 761 69 213 97 403 122 817 22 366 54 526 174 880 65 190 67 209 19 242 -58 41 -98 4 -186 -177 -90 -181 -140 -320 -191 -527 -37 -150 -52 -227 -106 -533 -15 -82 -21 -100 -39 -107 -23 -10 -214 -32 -446 -52 -199 -18 -1228 -18 -1490 0 -107 7 -312 22 -455 32 -718 53 -1079 50 -1570 -11 -528 -66 -983 -195 -1510 -428 -204 -91 -621 -306 -776 -402 -723 -446 -1183 -669 -1599 -774 -234 -59 -449 -96 -680 -116 -172 -15 -617 -6 -757 15 -118 18 -279 50 -343 69 l-45 13 85 56 c221 146 377 204 985 368 436 118 758 241 1036 395 222 123 594 390 737 528 48 47 56 93 22 127 -37 37 -74 26 -301 -88 -250 -127 -398 -191 -617 -266 -305 -104 -517 -146 -749 -146 -227 0 -452 35 -699 110 -159 48 -228 76 -219 90 12 20 204 110 321 150 274 94 497 133 1139 195 812 79 1246 181 1609 379 199 109 284 184 891 786 499 495 664 651 919 869 554 474 1137 867 1731 1164 478 239 911 409 1570 615 652 205 1048 351 1364 503 90 44 166 77 168 75 3 -2 -5 -22 -16 -45 -109 -213 -291 -767 -291 -885 0 -52 22 -84 65 -92 52 -10 77 21 135 168 168 428 481 971 814 1415 176 234 319 380 551 562 179 140 222 185 265 276 108 226 236 726 326 1270 140 853 175 995 314 1292 230 490 688 835 1255 947 182 36 167 34 410 31 194 -3 232 -6 325 -28z',
    );
    p1.setAttribute('fill', isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748');
    g.appendChild(p1);

    const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p2.setAttribute(
      'd',
      'M14103 11266 c-230 -56 -394 -300 -355 -529 18 -104 64 -190 141 -268 77 -76 147 -113 250 -131 278 -48 541 180 541 467 0 134 -47 241 -147 336 -122 117 -277 162 -430 125z m67 -112 c-68 -31 -134 -93 -168 -159 -19 -38 -26 -70 -30 -131 -4 -73 -1 -88 23 -143 38 -84 105 -144 192 -171 81 -25 115 -25 192 -1 60 19 117 54 154 96 16 18 16 15 -2 -21 -28 -58 -120 -138 -189 -165 -42 -17 -77 -23 -134 -23 -69 1 -86 5 -152 38 -85 41 -135 92 -173 174 -96 206 12 449 230 517 23 8 58 14 77 14 34 1 34 0 -20 -25z m307 -131 c42 -51 24 -146 -32 -171 -56 -26 -120 -9 -148 38 -70 117 95 238 180 133z',
    );
    p2.setAttribute('fill', isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748');
    g.appendChild(p2);

    const p3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p3.setAttribute(
      'd',
      'M12983 10811 c-81 -59 -165 -193 -179 -287 -13 -86 32 -153 108 -161 95 -9 165 91 107 153 l-20 22 20 40 c11 23 43 65 71 94 59 62 66 103 25 143 -34 35 -81 33 -132 -4z',
    );
    p3.setAttribute('fill', isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748');
    g.appendChild(p3);

    svg.appendChild(g);
    container.appendChild(svg);
  };

  // Immediate render fallback
  renderFallback();
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}

function renderHospitalMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';
  const container = document.createElement('div');
  container.className = 'marker-hospital-container';
  Object.assign(container.style, {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transform: isSelected ? 'scale(1.2)' : 'scale(1)',
    transformOrigin: 'bottom center',
    filter: isSelected
      ? 'drop-shadow(0px 8px 12px rgba(0,0,0,0.3))'
      : 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))',
  });

  const svgColorBase = isDark ? '#FFFFFF' : '#E2E8F0';
  const svgColorRoof = isDark ? '#CBD5E0' : '#A0AEC0';
  const svgColorDoor = isDark ? '#A0AEC0' : '#718096';
  const svgColorWindow = isDark ? '#90CDF4' : '#63B3ED';

  container.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 64 64">
      <path d="M16 48 L48 48 L48 20 L16 20 Z" fill="${svgColorBase}" />
      <path d="M12 20 L52 20 L52 16 L12 16 Z" fill="${svgColorRoof}" />
      <path d="M28 32 L36 32 L36 36 L28 36 Z" fill="#E53E3E" />
      <path d="M30 30 L34 30 L34 38 L30 38 Z" fill="#E53E3E" />
      <path d="M28 48 L36 48 L36 42 L28 42 Z" fill="${svgColorDoor}" />
      <rect x="20" y="24" width="4" height="4" fill="${svgColorWindow}" />
      <rect x="40" y="24" width="4" height="4" fill="${svgColorWindow}" />
      <rect x="20" y="32" width="4" height="4" fill="${svgColorWindow}" />
      <rect x="40" y="32" width="4" height="4" fill="${svgColorWindow}" />
    </svg>
  `;
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}

function renderBomberoMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';
  const container = document.createElement('div');
  container.className = 'marker-bombero-container';
  Object.assign(container.style, {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transform: isSelected ? 'scale(1.2)' : 'scale(1)',
    transformOrigin: 'bottom center',
    filter: isSelected
      ? 'drop-shadow(0px 8px 12px rgba(0,0,0,0.3))'
      : 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))',
  });

  const svgColorBase = isDark ? '#CBD5E0' : '#A0AEC0';
  const svgColorTop = isDark ? '#718096' : '#4A5568';
  const svgColorStroke = isDark ? '#4A5568' : '#718096';
  const svgColorLabel = isDark ? '#FEFCBF' : '#ECC94B';

  container.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 64 64">
      <path d="M22 28 L42 28 L42 48 Q42 52 32 52 Q22 52 22 48 Z" fill="#E53E3E" />
      <path d="M26 18 L38 18 L38 28 L26 28 Z" fill="${svgColorBase}" />
      <path d="M30 14 L34 14 L34 18 L30 18 Z" fill="${svgColorTop}" />
      <path d="M32 14 Q38 8 40 16" stroke="${svgColorStroke}" stroke-width="3" fill="none" />
      <rect x="26" y="34" width="12" height="10" fill="${svgColorLabel}" />
    </svg>
  `;
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}

function renderCarabineroMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';
  const container = document.createElement('div');
  container.className = 'marker-carabinero-container';
  Object.assign(container.style, {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transform: isSelected ? 'scale(1.2)' : 'scale(1)',
    transformOrigin: 'bottom center',
    filter: isSelected
      ? 'drop-shadow(0px 8px 12px rgba(0,0,0,0.3))'
      : 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))',
  });

  container.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 64 64">
      <!-- Shadow -->
      <ellipse cx="32" cy="54" rx="20" ry="6" fill="${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)'}" />
      
      <!-- Pin shape with white background -->
      <path 
        d="M32 6 C21 6 12 15 12 26 C12 40 32 58 32 58 C32 58 52 40 52 26 C52 15 43 6 32 6 Z" 
        fill="#FFFFFF" 
        stroke="#CBD5E0" 
        stroke-width="1.5" 
      />
      
      <!-- Carabineros de Chile SVG logo scaled and centered in the pin head -->
      <g transform="translate(27.33, 28.80) scale(0.28)">
        <rect x="-3.335" y="-0.4" fill="#0F5A2D" width="0.148" height="1.061"/>
        <g id="g2485_1_" transform="translate(-0.2597446,0.5324678)">
          <path id="path2487_1_" fill="#FFFFFF" d="M15.783,38.304c-2.006-2.465-5.523-5.282-8.401-6.729c-2.789-1.402-4.558-1.839-8.279-2.046c-7.498-0.418-13.829-2.773-18.41-6.853c-3.682-3.277-6.153-7.617-7.567-13.291c-0.808-3.238-1.002-4.863-1-8.365c0.002-4.698,0.641-7.862,2.446-12.116c2.931-6.909,4.501-12.394,4.666-16.308c0.098-2.31,0.023-2.569-2.527-8.812c-3.023-7.396-2.895-6.912-2.14-8.051c0.501-0.757,1.15-1.35,3.505-3.202c2.05-1.611,4.815-4.06,5.861-5.189c0.469-0.506,1.225-1.452,1.68-2.102c1.658-2.367,3.174-2.85,5.405-1.723c1.102,0.557,2.798,1.153,4.629,1.629c1.086,0.282,1.717,0.347,3.413,0.35L1.144-54.5l2.953-1.504c6.141-3.129,10.048-4.517,12.724-4.52c2.669-0.002,6.802,1.481,13.003,4.668l2.639,1.356l2.099-0.009c1.787-0.008,2.324-0.069,3.611-0.409c1.834-0.484,3.392-1.034,4.493-1.587c1.084-0.545,1.749-0.655,2.649-0.439c0.997,0.239,1.887,0.952,2.639,2.115c1.134,1.753,4.369,4.886,7.731,7.487c1.695,1.311,3.336,2.909,3.636,3.541c0.345,0.727,0.215,1.312-0.837,3.78c-0.493,1.157-1.608,3.87-2.477,6.027l-1.581,3.924l0.008,2.294c0.007,2.434,0.145,3.336,0.974,6.441c0.815,3.052,1.743,5.67,3.545,10.008c1.929,4.642,2.554,7.687,2.551,12.422c-0.003,3.435-0.206,5.086-1.018,8.34c-1.321,5.285-3.332,9.015-6.643,12.321c-3.564,3.56-8.21,5.949-13.808,7.103c-1.8,0.37-2.651,0.467-7.078,0.801c-2.321,0.175-3.965,0.618-6.144,1.654c-3.859,1.837-6.615,4.104-9.912,8.158C16.856,39.529,16.352,39.003,15.783,38.304z"/>
        </g>
        <g id="g2485" transform="translate(-0.2597446,0.5324678)">
          <path id="path2487" fill="#007328" d="M15.783,38.304c-2.006-2.465-5.523-5.282-8.401-6.729c-2.789-1.402-4.557-1.839-8.279-2.046c-7.498-0.418-13.829-2.773-18.41-6.853c-3.682-3.277-6.153-7.617-7.567-13.291c-0.808-3.238-1.002-4.863-1-8.365c0.002-4.698,0.641-7.862,2.446-12.116c2.931-6.909,4.501-12.394,4.666-16.308c0.098-2.31,0.023-2.569-2.527-8.812c-3.023-7.396-2.895-6.912-2.14-8.051c0.501-0.757,1.15-1.35,3.506-3.202c2.048-1.611,4.813-4.06,5.859-5.189c0.469-0.506,1.225-1.452,1.68-2.102c1.658-2.367,3.174-2.85,5.405-1.723c1.102,0.557,2.798,1.153,4.629,1.629c1.086,0.282,1.717,0.347,3.413,0.35L1.144-54.5l2.953-1.504c6.142-3.129,10.048-4.517,12.724-4.52c2.668-0.002,6.801,1.481,13.002,4.668l2.639,1.356l2.099-0.009c1.787-0.008,2.324-0.069,3.611-0.409c1.834-0.484,3.392-1.034,4.493-1.587c1.084-0.545,1.749-0.655,2.649-0.439c0.997,0.239,1.887,0.952,2.639,2.115c1.134,1.753,4.369,4.886,7.731,7.487c1.695,1.311,3.336,2.909,3.636,3.541c0.345,0.727,0.215,1.312-0.837,3.78c-0.493,1.157-1.608,3.87-2.477,6.027l-1.581,3.924l0.008,2.294c0.007,2.434,0.145,3.336,0.974,6.441c0.815,3.052,1.743,5.67,3.545,10.008c1.929,4.642,2.554,7.687,2.551,12.422c-0.003,3.435-0.206,5.086-1.018,8.34c-1.321,5.285-3.332,9.015-6.643,12.321c-3.564,3.56-8.21,5.949-13.808,7.103c-1.8,0.37-2.651,0.467-7.078,0.801c-2.321,0.175-3.965,0.618-6.144,1.654c-3.859,1.837-6.615,4.104-9.912,8.158C16.856,39.529,16.352,39.003,15.783,38.304z M18.244,35.945c3.604-3.689,7.763-6.234,11.833-7.24c1.1-0.272,2.246-0.423,3.959-0.52c3.867-0.22,5.268-0.438,8.25-1.282c6.763-1.915,12.108-6.25,14.866-12.053c2.207-4.642,3.376-10.848,2.978-15.789c-0.331-4.097-0.922-6.362-2.836-10.883c-3.327-7.854-4.872-14.757-4.107-18.353c0.147-0.694,3.012-8.09,3.382-8.733c0.184-0.32,1.326-3.17,1.495-3.729c0.172-0.571-0.119-1.105-1.009-1.85c-0.387-0.324-1.936-1.608-3.441-2.853c-3.296-2.726-5.293-4.682-6.404-6.273c-0.988-1.416-1.344-1.758-2.064-1.989c-0.622-0.199-1.553-0.018-2.193,0.427c-0.411,0.286-1.923,0.876-3.419,1.334c-1.616,0.495-3.382,0.776-4.946,0.789c-1.705,0.013-2.829-0.211-3.776-0.754c-2.821-1.619-7.561-3.771-10.363-4.707c-1.626-0.542-1.79-0.568-3.627-0.568s-2.001,0.025-3.618,0.566c-2.85,0.953-8.38,3.44-10.187,4.581c-2.188,1.381-6.233,1.161-10.921-0.595c-0.57-0.213-1.203-0.502-1.407-0.642c-0.601-0.41-1.416-0.616-2.006-0.505c-0.71,0.133-1.382,0.737-2.215,1.991c-1.163,1.749-4.849,5.19-8.9,8.311c-1.394,1.074-2.028,1.806-2.013,2.328c0.011,0.368,0.811,2.423,3.81,9.789c0.514,1.262,1.007,2.69,1.096,3.173c0.682,3.707-0.756,10.124-4.037,18.022c-1.66,3.999-2.101,5.372-2.53,7.872c-0.947,5.524-0.466,10.795,1.5,16.444c2.526,7.262,8.027,12.342,15.8,14.592c3.083,0.893,4.363,1.095,8.453,1.334c1.839,0.107,2.917,0.25,3.998,0.528c4.08,1.05,8.312,3.662,11.696,7.217c0.733,0.771,1.374,1.409,1.425,1.42C16.814,37.359,17.48,36.727,18.244,35.945z M15.234,34.323c-2.42-2.343-4.772-3.977-7.593-5.275c-2.942-1.354-4.516-1.718-8.573-1.978c-4.177-0.268-6.652-0.773-9.786-1.998c-7.504-2.934-11.895-8.185-13.921-16.65c-1.057-4.415-1.084-10.284-0.066-14.287c0.406-1.598,0.872-2.895,1.915-5.33c1.828-4.272,3.126-8.2,3.888-11.77c0.434-2.026,0.476-2.455,0.479-4.886l0.002-2.665l-0.607-1.555c-0.334-0.855-1.382-3.475-2.331-5.822c-1.774-4.396-1.945-5.046-1.492-5.693c0.126-0.181,0.776-0.744,1.444-1.252c3.887-2.958,7.542-6.443,9.007-8.589c0.319-0.467,0.786-0.956,1.037-1.086c0.436-0.226,0.489-0.218,1.216,0.163c1.176,0.616,4.234,1.661,5.911,2.019c1.113,0.238,2.021,0.323,3.437,0.324c1.746,0,2.029-0.038,3.036-0.414c0.611-0.228,1.295-0.545,1.521-0.705c0.596-0.421,5.396-2.713,7.214-3.446c2.822-1.136,4.183-1.481,5.848-1.481c1.688,0,2.658,0.245,5.672,1.433c1.898,0.748,6.274,2.832,7.43,3.537c1.799,1.098,4.164,1.395,7.107,0.892c1.945-0.333,5.401-1.417,6.466-2.029c0.657-0.377,1.226-0.448,1.673-0.209c0.149,0.08,0.654,0.691,1.122,1.358c0.974,1.39,2.998,3.468,5.248,5.387c0.855,0.729,1.587,1.364,1.628,1.412s0.774,0.637,1.629,1.31c0.854,0.673,1.638,1.331,1.739,1.46c0.438,0.561,0.248,1.34-1.148,4.696c-1.778,4.274-3.106,7.713-3.272,8.473c-0.256,1.168-0.213,3.964,0.085,5.666c0.755,4.304,1.99,8.234,4.319,13.736c1.822,4.306,2.392,6.777,2.528,10.945c0.278,8.598-2.625,16.48-7.693,20.879c-2.936,2.551-6.607,4.371-10.819,5.365c-2.417,0.57-3.482,0.717-6.023,0.825c-3.497,0.149-5.68,0.651-8.513,1.961c-2.873,1.327-5.128,2.899-7.626,5.311l-1.555,1.502L15.234,34.323z"/>
        </g>
        <g>
          <path fill="#FFFFFF" d="M-11.346-40.736l0.972,0.453c-0.15,0.797-0.397,1.388-0.743,1.774c-0.347,0.387-0.786,0.58-1.318,0.58c-0.659,0-1.201-0.331-1.625-0.993c-0.425-0.662-0.637-1.567-0.637-2.715c0-1.214,0.212-2.157,0.639-2.83c0.427-0.671,0.988-1.007,1.683-1.007c0.607,0,1.101,0.264,1.479,0.791c0.226,0.312,0.396,0.76,0.508,1.344l-0.992,0.349c-0.059-0.378-0.181-0.677-0.367-0.896c-0.186-0.219-0.413-0.329-0.679-0.329c-0.368,0-0.667,0.194-0.896,0.582c-0.229,0.389-0.344,1.018-0.344,1.887c0,0.922,0.113,1.579,0.338,1.971c0.226,0.392,0.519,0.587,0.88,0.587c0.267,0,0.497-0.125,0.688-0.374C-11.566-39.811-11.429-40.202-11.346-40.736z"/>
          <path fill="#FFFFFF" d="M-5.038-38.054h-1.091l-0.433-1.657h-1.984l-0.409,1.657h-1.064l1.934-7.296h1.06L-5.038-38.054z M-6.884-40.94l-0.683-2.708l-0.67,2.708H-6.884z"/>
          <path fill="#FFFFFF" d="M-4.503-38.054v-7.296h2.108c0.531,0,0.916,0.065,1.156,0.197c0.241,0.13,0.433,0.363,0.578,0.699c0.145,0.334,0.217,0.718,0.217,1.149c0,0.547-0.109,0.999-0.328,1.356c-0.219,0.356-0.546,0.581-0.981,0.674c0.215,0.186,0.396,0.39,0.536,0.612c0.142,0.222,0.332,0.617,0.571,1.185l0.606,1.423h-1.198l-0.725-1.587c-0.258-0.567-0.434-0.925-0.528-1.073c-0.095-0.148-0.195-0.249-0.302-0.304C-2.899-41.072-3.068-41.1-3.298-41.1h-0.203v3.046H-4.503z M-3.501-42.264h0.741c0.48,0,0.781-0.03,0.9-0.09c0.12-0.06,0.214-0.163,0.281-0.309s0.101-0.328,0.101-0.547c0-0.246-0.045-0.444-0.133-0.595c-0.089-0.151-0.215-0.247-0.378-0.286c-0.081-0.017-0.324-0.025-0.73-0.025h-0.782V-42.264z"/>
          <path fill="#FFFFFF" d="M4.977-38.054H3.885l-0.432-1.657H1.469L1.06-38.054h-1.063l1.933-7.296h1.061L4.977-38.054z M3.131-40.94l-0.684-2.708L1.777-40.94H3.131z"/>
          <path fill="#FFFFFF" d="M5.511-45.35h1.984c0.392,0,0.686,0.024,0.879,0.072c0.192,0.048,0.365,0.148,0.518,0.301c0.152,0.153,0.279,0.356,0.38,0.61c0.102,0.253,0.153,0.539,0.153,0.853c0,0.342-0.063,0.656-0.188,0.941c-0.126,0.285-0.295,0.499-0.51,0.642c0.303,0.129,0.535,0.35,0.697,0.662c0.163,0.312,0.244,0.679,0.244,1.1c0,0.332-0.053,0.655-0.157,0.969c-0.105,0.313-0.249,0.564-0.431,0.751c-0.182,0.188-0.405,0.303-0.672,0.346c-0.167,0.027-0.57,0.043-1.208,0.05H5.511V-45.35z M6.514-44.136v1.688H7.17c0.391,0,0.634-0.008,0.729-0.025c0.171-0.03,0.305-0.117,0.404-0.261c0.098-0.145,0.147-0.334,0.147-0.57c0-0.226-0.042-0.409-0.127-0.55c-0.084-0.142-0.21-0.227-0.377-0.257c-0.1-0.017-0.385-0.025-0.856-0.025H6.514z M6.514-41.234v1.951h0.928c0.36,0,0.589-0.016,0.687-0.045c0.149-0.04,0.271-0.137,0.364-0.291c0.094-0.154,0.141-0.361,0.141-0.62c0-0.219-0.036-0.405-0.109-0.557c-0.072-0.153-0.177-0.264-0.313-0.333c-0.137-0.07-0.433-0.104-0.889-0.104H6.514z"/>
          <path fill="#FFFFFF" d="M10.484-38.054v-7.296h1.002v7.296H10.484z"/>
          <path fill="#FFFFFF" d="M12.452-38.054v-7.296h0.975l2.031,4.873v-4.873h0.93v7.296h-1.004l-2.001-4.757v4.757H12.452z"/>
          <path fill="#FFFFFF" d="M17.449-38.054v-7.296h3.68v1.234h-2.678v1.618h2.492v1.229h-2.492v1.986h2.773v1.229H17.449z"/>
          <path fill="#FFFFFF" d="M22.077-38.054v-7.296h2.108c0.531,0,0.916,0.065,1.156,0.197c0.241,0.13,0.433,0.363,0.578,0.699c0.145,0.334,0.217,0.718,0.217,1.149c0,0.547-0.109,0.999-0.328,1.356c-0.219,0.356-0.546,0.581-0.981,0.674c0.215,0.186,0.396,0.39,0.536,0.612c0.142,0.222,0.332,0.617,0.571,1.185l0.606,1.423H25.34l-0.724-1.587c-0.258-0.567-0.434-0.925-0.528-1.073c-0.095-0.148-0.195-0.249-0.302-0.304c-0.105-0.055-0.274-0.082-0.504-0.082h-0.203v3.046H22.077z M23.079-42.264h0.741c0.48,0,0.781-0.03,0.9-0.09c0.12-0.06,0.213-0.163,0.281-0.309c0.067-0.146,0.101-0.328,0.101-0.547c0-0.246-0.045-0.444-0.133-0.595c-0.089-0.151-0.215-0.247-0.378-0.286c-0.081-0.017-0.324-0.025-0.73-0.025h-0.782V-42.264z"/>
          <path fill="#FFFFFF" d="M26.878-41.657c0-0.743,0.075-1.367,0.226-1.872c0.114-0.372,0.267-0.705,0.462-1c0.195-0.295,0.409-0.514,0.642-0.657c0.309-0.192,0.666-0.288,1.07-0.288c0.73,0,1.315,0.333,1.755,1s0.658,1.594,0.658,2.782c0,1.178-0.218,2.1-0.653,2.765c-0.436,0.666-1.018,0.998-1.747,0.998c-0.737,0-1.324-0.331-1.76-0.993C27.096-39.584,26.878-40.496,26.878-41.657z M27.91-41.707c0,0.826,0.13,1.452,0.39,1.879c0.259,0.426,0.589,0.639,0.989,0.639s0.728-0.211,0.983-0.634c0.256-0.423,0.385-1.058,0.385-1.903c0-0.837-0.125-1.46-0.375-1.872c-0.249-0.411-0.581-0.617-0.993-0.617c-0.413,0-0.746,0.208-0.999,0.625S27.91-42.546,27.91-41.707z"/>
          <path fill="#FFFFFF" d="M32.219-40.427l0.976-0.14c0.059,0.481,0.178,0.834,0.357,1.06c0.179,0.225,0.421,0.338,0.725,0.338c0.324,0,0.567-0.101,0.73-0.301c0.164-0.201,0.246-0.436,0.246-0.704c0-0.172-0.035-0.319-0.104-0.44c-0.069-0.121-0.19-0.227-0.36-0.316c-0.118-0.06-0.385-0.166-0.803-0.319c-0.537-0.196-0.914-0.436-1.131-0.722c-0.305-0.401-0.457-0.891-0.457-1.468c0-0.372,0.071-0.719,0.214-1.042c0.144-0.324,0.35-0.57,0.621-0.739c0.27-0.169,0.595-0.253,0.977-0.253c0.623,0,1.092,0.2,1.406,0.602c0.315,0.402,0.48,0.937,0.496,1.607L35.111-43.2c-0.043-0.375-0.135-0.645-0.276-0.809c-0.141-0.164-0.353-0.247-0.635-0.247c-0.291,0-0.518,0.089-0.683,0.264c-0.106,0.113-0.159,0.264-0.159,0.453c0,0.173,0.049,0.32,0.149,0.443c0.126,0.156,0.433,0.318,0.921,0.487c0.487,0.169,0.848,0.345,1.081,0.525c0.234,0.181,0.417,0.428,0.548,0.741c0.132,0.314,0.199,0.701,0.199,1.163c0,0.418-0.08,0.81-0.237,1.174c-0.159,0.365-0.382,0.637-0.67,0.814c-0.29,0.177-0.649,0.266-1.08,0.266c-0.628,0-1.109-0.213-1.446-0.64C32.486-38.99,32.285-39.611,32.219-40.427z"/>
          <path fill="#FFFFFF" d="M39.021-45.35h1.832c0.413,0,0.728,0.046,0.944,0.14c0.292,0.126,0.541,0.35,0.748,0.672c0.208,0.322,0.367,0.716,0.475,1.182c0.107,0.466,0.162,1.041,0.162,1.725c0,0.601-0.051,1.118-0.153,1.553c-0.124,0.531-0.301,0.961-0.531,1.289c-0.174,0.249-0.409,0.443-0.704,0.583c-0.222,0.103-0.518,0.154-0.888,0.154h-1.886V-45.35z M40.023-44.116v4.833h0.748c0.28,0,0.482-0.023,0.606-0.07c0.163-0.06,0.298-0.161,0.404-0.304c0.107-0.143,0.195-0.377,0.263-0.704s0.101-0.772,0.101-1.336c0-0.564-0.034-0.997-0.101-1.299c-0.067-0.302-0.162-0.538-0.284-0.707c-0.122-0.169-0.276-0.283-0.464-0.343c-0.141-0.046-0.414-0.07-0.823-0.07H40.023z"/>
          <path fill="#FFFFFF" d="M44.032-38.054v-7.296h3.681v1.234h-2.679v1.618h2.492v1.229h-2.492v1.986h2.773v1.229H44.032z"/>
          <path fill="#FFFFFF" d="M10.44-31.169l0.972,0.453c-0.148,0.796-0.396,1.388-0.744,1.774c-0.346,0.387-0.786,0.58-1.318,0.58c-0.659,0-1.201-0.33-1.625-0.993c-0.425-0.662-0.637-1.567-0.637-2.714c0-1.215,0.213-2.158,0.64-2.83c0.426-0.672,0.987-1.008,1.683-1.008c0.607,0,1.101,0.264,1.479,0.791c0.226,0.312,0.395,0.76,0.508,1.344l-0.991,0.349c-0.06-0.378-0.182-0.677-0.368-0.896c-0.186-0.219-0.412-0.328-0.679-0.328c-0.368,0-0.666,0.194-0.896,0.582c-0.229,0.388-0.344,1.017-0.344,1.886c0,0.922,0.113,1.58,0.339,1.971c0.226,0.392,0.52,0.588,0.88,0.588c0.267,0,0.496-0.125,0.688-0.373C10.22-30.244,10.357-30.635,10.44-31.169z"/>
          <path fill="#FFFFFF" d="M12.275-28.487v-7.297h1.002v2.872h1.964v-2.872h1.002v7.297h-1.002v-3.19h-1.964v3.19H12.275z"/>
          <path fill="#FFFFFF" d="M17.249-28.487v-7.297h1.002v7.297H17.249z"/>
          <path fill="#FFFFFF" d="M19.233-28.487v-7.237h1.002v6.007h2.491v1.229H19.233z"/>
          <path fill="#FFFFFF" d="M23.441-28.487v-7.297h3.679v1.234h-2.677v1.618h2.492v1.229h-2.492v1.986h2.772v1.229H23.441z"/>
        </g>
        <rect x="-6.118" y="16.047" fill="#FFFFFF" width="45.305" height="7.254"/>
        <g>
          <path fill="#007328" d="M-4.773,19.698c0-0.396,0.057-0.729,0.168-0.999c0.083-0.198,0.197-0.377,0.341-0.534c0.145-0.158,0.303-0.275,0.474-0.352C-3.563,17.71-3.299,17.659-3,17.659c0.54,0,0.972,0.179,1.296,0.535c0.324,0.355,0.486,0.852,0.486,1.486c0,0.629-0.161,1.122-0.482,1.476c-0.321,0.355-0.752,0.533-1.29,0.533c-0.545,0-0.979-0.177-1.301-0.53C-4.612,20.806-4.773,20.319-4.773,19.698z M-4.011,19.671c0,0.441,0.096,0.776,0.288,1.004c0.191,0.228,0.435,0.342,0.729,0.342s0.537-0.113,0.727-0.339c0.189-0.226,0.284-0.565,0.284-1.018c0-0.446-0.093-0.779-0.276-0.999c-0.185-0.22-0.429-0.33-0.734-0.33c-0.305,0-0.551,0.111-0.737,0.333C-3.917,18.887-4.011,19.223-4.011,19.671z"/>
          <path fill="#007328" d="M-0.638,21.623v-3.897H0.92c0.392,0,0.676,0.035,0.854,0.105c0.177,0.07,0.319,0.194,0.426,0.373c0.106,0.18,0.16,0.384,0.16,0.614c0,0.293-0.082,0.534-0.242,0.725c-0.162,0.19-0.403,0.311-0.726,0.36c0.16,0.1,0.292,0.208,0.396,0.327c0.104,0.118,0.244,0.329,0.421,0.633l0.448,0.76H1.772l-0.535-0.848c-0.189-0.304-0.319-0.494-0.39-0.573s-0.145-0.133-0.223-0.162s-0.202-0.044-0.372-0.044h-0.15v1.627H-0.638z M0.103,19.374H0.65c0.354,0,0.576-0.016,0.665-0.047c0.088-0.033,0.157-0.087,0.207-0.166c0.049-0.077,0.075-0.175,0.075-0.292c0-0.131-0.033-0.237-0.099-0.317C1.434,18.47,1.34,18.419,1.22,18.398c-0.06-0.008-0.24-0.013-0.54-0.013H0.103V19.374z"/>
          <path fill="#007328" d="M3.055,17.725h1.353c0.305,0,0.537,0.025,0.697,0.075c0.215,0.067,0.399,0.187,0.553,0.358s0.271,0.383,0.35,0.632c0.08,0.249,0.12,0.556,0.12,0.921c0,0.32-0.037,0.598-0.112,0.83c-0.092,0.283-0.223,0.513-0.393,0.688c-0.128,0.133-0.302,0.237-0.52,0.312c-0.164,0.055-0.382,0.082-0.656,0.082H3.055V17.725z M3.796,18.385v2.581h0.552c0.207,0,0.356-0.013,0.448-0.037c0.12-0.032,0.219-0.086,0.299-0.162c0.079-0.076,0.144-0.202,0.193-0.376c0.05-0.175,0.075-0.413,0.075-0.714c0-0.302-0.025-0.533-0.075-0.694s-0.12-0.287-0.21-0.377c-0.09-0.091-0.204-0.152-0.343-0.184c-0.103-0.025-0.306-0.037-0.608-0.037H3.796z"/>
          <path fill="#007328" d="M6.756,21.623v-3.897h2.717v0.66H7.496v0.863h1.84v0.657h-1.84v1.061h2.047v0.656H6.756z"/>
          <path fill="#007328" d="M10.179,21.623v-3.897h0.72l1.501,2.604v-2.604h0.688v3.897h-0.743l-1.478-2.541v2.541H10.179z"/>
          <path fill="#007328" d="M16.162,21.623v-1.64l-1.343-2.258h0.869l0.862,1.542l0.845-1.542h0.853l-1.348,2.263v1.635H16.162z"/>
          <path fill="#007328" d="M19.945,21.623v-3.897h1.188c0.45,0,0.743,0.02,0.88,0.059c0.21,0.059,0.386,0.186,0.527,0.382c0.142,0.195,0.212,0.448,0.212,0.759c0,0.239-0.041,0.44-0.123,0.604c-0.081,0.163-0.185,0.292-0.31,0.384c-0.126,0.094-0.254,0.155-0.384,0.186c-0.177,0.037-0.432,0.056-0.767,0.056h-0.483v1.47H19.945z M20.685,18.385v1.105h0.405c0.292,0,0.487-0.021,0.585-0.062c0.099-0.04,0.176-0.104,0.231-0.19c0.056-0.088,0.084-0.188,0.084-0.304c0-0.142-0.039-0.259-0.117-0.351c-0.079-0.093-0.178-0.15-0.298-0.173c-0.089-0.018-0.266-0.026-0.532-0.026H20.685z"/>
          <path fill="#007328" d="M26.285,21.623H25.48l-0.32-0.885h-1.465l-0.303,0.885h-0.785l1.427-3.897h0.784L26.285,21.623z M24.923,20.081l-0.505-1.445l-0.495,1.445H24.923z"/>
          <path fill="#007328" d="M27.123,21.623v-3.237h-1.087v-0.66h2.913v0.66h-1.085v3.237H27.123z"/>
          <path fill="#007328" d="M29.429,21.623v-3.897h1.558c0.391,0,0.677,0.035,0.854,0.105c0.178,0.07,0.32,0.194,0.427,0.373c0.106,0.18,0.16,0.384,0.16,0.614c0,0.293-0.081,0.534-0.243,0.725c-0.162,0.19-0.404,0.311-0.725,0.36c0.16,0.1,0.292,0.208,0.396,0.327c0.104,0.118,0.244,0.329,0.421,0.633l0.448,0.76h-0.886l-0.536-0.848c-0.189-0.304-0.32-0.494-0.389-0.573c-0.071-0.079-0.145-0.133-0.223-0.162s-0.203-0.044-0.373-0.044h-0.149v1.627H29.429z M30.169,19.374h0.546c0.356,0,0.578-0.016,0.666-0.047c0.089-0.033,0.158-0.087,0.208-0.166c0.05-0.077,0.075-0.175,0.075-0.292c0-0.131-0.033-0.237-0.099-0.317c-0.066-0.081-0.16-0.132-0.279-0.153c-0.06-0.008-0.24-0.013-0.54-0.013h-0.577V19.374z"/>
          <path fill="#007328" d="M33.102,21.623v-3.897h0.74v3.897H33.102z"/>
          <path fill="#007328" d="M37.853,21.623h-0.806l-0.32-0.885h-1.465l-0.303,0.885h-0.785l1.427-3.897h0.784L37.853,21.623z M36.489,20.081l-0.504-1.445l-0.495,1.445H36.489z"/>
        </g>
        <polygon fill="#FFFFFF" points="-15.716,13.64 -4.334,13.64 -4.334,15.256 -7.007,15.256 -7.007,21.051 -15.716,21.051 -9.831,17.144"/>
        <polygon fill="#FFFFFF" points="48.816,13.657 37.436,13.657 37.436,15.274 40.107,15.274 40.107,21.069 48.816,21.069 42.931,17.162"/>
        <g>
          <path fill="#FFFFFF" d="M45.979-33.354c0.177-0.562,0.395-1.192,0.946-1.486c0.709-0.27,1.293,0.351,1.754,0.796c0.337-0.156,0.678-0.302,1.025-0.441c0.071,0.373,0.136,0.748,0.185,1.125c-2.602,1.237-5.211,2.455-7.814,3.689c0.037,0.112,0.111,0.339,0.148,0.452c2.301-0.912,4.575-1.885,6.875-2.793c0.203,0.339,0.415,0.675,0.631,1.007c-3.246,1.513-6.503,3.001-9.754,4.5c-0.643,0.312-0.889,1.094-1.542,1.393c-1.932,0.979-3.883,1.922-5.788,2.947c-0.187,1.251-0.665,2.435-1.132,3.601c-0.577,1.356-1.206,2.693-1.918,3.986c0.431,0.114,0.862,0.225,1.295,0.336c-0.049,0.592-0.118,1.182-0.155,1.775c1.257,1.478,2.513,2.961,3.801,4.411c1.005,0.195,2.049,0.106,3.067,0.218c0.142,0.005,0.272,0.049,0.389,0.133c4.011,2.809,8.022,5.619,12.036,8.425c0.417,0.319,1.073,0.552,1.093,1.17c-0.036,0.575-0.477,1.062-0.957,1.341c-1.429,0.638-2.246,2.057-3.023,3.339c-0.541,0.89-0.839,1.947-1.599,2.689c-0.271,0.263-0.731,0.316-1.002,0.025c-0.513-0.431-1.027-0.856-1.535-1.291c-2.219,1.617-4.896,2.612-7.637,2.778c-0.893,0.001-1.787,0.018-2.679-0.013c-2.801-0.241-5.515-1.107-8.063-2.272c-3.045-1.412-5.88-3.259-8.454-5.407C11.86,6.256,6.752,8.621,1.33,8.822c-3.498,0.104-7.063-0.704-10.055-2.56c-0.662,0.847-1.394,1.638-2.068,2.476c-0.325,0.428-0.832,0.688-1.344,0.818c-0.441,0.135-0.86-0.271-0.883-0.695c-0.052-0.718-0.333-1.394-0.714-1.997c-0.755-1.187-1.741-2.203-2.781-3.141c-0.443-0.456-1.249-0.484-1.479-1.152c-0.191-0.66,0.235-1.361,0.715-1.794c3.688-2.587,7.387-5.158,11.081-7.734c0.563-0.361,1.067-0.817,1.659-1.128c1.115-0.138,2.252-0.033,3.362-0.212c1.231-1.441,2.329-3.013,3.518-4.497c-0.078-0.595-0.169-1.189-0.259-1.783c0.605-0.188,1.222-0.339,1.819-0.549c-1.301-2.101-1.925-4.524-2.457-6.911c-2.417-1.134-4.808-2.323-7.217-3.474c-0.545-0.251-0.566-1.005-1.056-1.311c-3.308-1.479-6.617-2.955-9.916-4.45c0.038-0.329,0.079-0.657,0.125-0.986c2.435,0.993,4.81,2.132,7.242,3.13c0.119-0.126,0.237-0.252,0.357-0.376c-2.703-1.408-5.456-2.72-8.145-4.152c0.092-0.334,0.181-0.669,0.271-1.004c0.59,0.105,1.181,0.193,1.772,0.281c0.456-0.295,1.059-0.519,1.577-0.25c0.527,0.316,0.709,0.945,0.852,1.501c9.754,4.218,19.483,8.492,29.235,12.713c6.881-3.022,13.765-6.042,20.647-9.061C40.114-30.777,43.068-32.021,45.979-33.354 M3.656-20.552c0.323,1.701,1.018,3.316,1.839,4.833c0.232-0.093,0.496-0.162,0.637-0.388c0.401-0.539,0.915-0.973,1.421-1.408c0.295,0.163,0.588,0.324,0.883,0.487c0.264-0.105,0.524-0.213,0.784-0.326C7.394-18.465,5.52-19.504,3.656-20.552 M24.318-17.355c0.267,0.114,0.537,0.224,0.81,0.327c0.297-0.161,0.593-0.323,0.888-0.487c0.57,0.487,1.146,0.983,1.561,1.618c0.167,0.055,0.336,0.111,0.505,0.167c0.781-1.532,1.522-3.115,1.825-4.819C28.022-19.524,26.177-18.429,24.318-17.355 M10.737-10.86c0.409,1.221,0.159,2.624-0.643,3.63c-0.106,0.169-0.287,0.311-0.33,0.512c0.289,0.575,0.699,1.077,1.085,1.588c1.617,1.98,3.512,3.716,5.465,5.356c2.548-2.011,4.698-4.532,6.246-7.388c-1.243-0.814-1.27-2.455-1.101-3.774c-1.702-0.933-3.374-1.921-5.069-2.866C14.495-12.846,12.604-11.879,10.737-10.86 M7.71-9.867c0.14,0.614,0.229,1.269,0.592,1.802c0.252,0.038,0.455-0.203,0.645-0.337c0.593-0.539,0.539-1.424,0.374-2.138C8.783-10.318,8.246-10.092,7.71-9.867 M23.199-10.542c-0.342,0.939-0.049,2.236,1.021,2.526c0.302-0.579,0.484-1.211,0.551-1.86C24.254-10.113,23.718-10.31,23.199-10.542 M5.177-8.146c0.475,0.392,1.121,0.313,1.69,0.284C6.677-8.277,6.482-8.69,6.296-9.104C5.909-8.801,5.536-8.482,5.177-8.146 M26.215-9.091c-0.198,0.409-0.397,0.817-0.592,1.226c0.567,0.018,1.242,0.141,1.695-0.293C26.972-8.493,26.594-8.793,26.215-9.091 M3.272-6.372c0.049,0.653-0.044,1.356-0.502,1.86c-0.75,0.951-2.062,1.134-3.2,1.114c-2.34,2.65-4.656,5.325-6.977,7.993c1.243,0.882,2.651,1.543,4.14,1.885c2.938,0.714,6.027,0.317,8.888-0.554c2.999-0.938,5.827-2.384,8.433-4.132c-0.669-0.585-1.369-1.145-1.939-1.831c-1.692-1.818-3.257-3.753-4.773-5.72C6.057-5.647,4.872-6.352,3.951-7.184C3.705-6.929,3.478-6.66,3.272-6.372 M25.033-5.761c-2.095,2.642-4.154,5.358-6.721,7.564c2.101,1.624,4.402,2.977,6.78,4.149c2.896,1.388,6.013,2.456,9.245,2.581c2.453,0.098,4.952-0.536,6.98-1.942c-2.817-3.342-5.677-6.649-8.508-9.979c-1.162,0.008-2.518-0.178-3.263-1.176c-0.419-0.504-0.473-1.173-0.434-1.801c-0.221-0.279-0.447-0.55-0.688-0.808C27.491-6.363,26.323-5.638,25.033-5.761L25.033-5.761z"/>
        </g>
      </g>
    </svg>
  `;
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}

function renderCamaraMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';
  const container = document.createElement('div');
  container.className = 'marker-camara-container';
  Object.assign(container.style, {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transform: isSelected ? 'scale(1.2)' : 'scale(1)',
    transformOrigin: 'bottom center',
    filter: isSelected
      ? 'drop-shadow(0px 8px 12px rgba(0,0,0,0.3))'
      : 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))',
  });

  const poleColor = isDark ? '#A0AEC0' : '#718096';
  const bodyColor = isDark ? '#E2E8F0' : '#CBD5E0';

  container.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 64 64">
      <rect x="30" y="24" width="4" height="40" fill="${poleColor}" />
      <path d="M16 20 L40 20 L40 32 L16 32 Z" fill="${bodyColor}" transform="rotate(-15 32 26)" />
      <rect x="12" y="22" width="6" height="8" fill="#2D3748" transform="rotate(-15 32 26)" />
      <ellipse cx="38" cy="22" rx="2" ry="2" fill="#E53E3E" transform="rotate(-15 32 26)" />
    </svg>
  `;
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}

function renderUniversityMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';
  const container = document.createElement('div');
  container.className = 'marker-university-container';
  Object.assign(container.style, {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transform: isSelected ? 'scale(1.2)' : 'scale(1)',
    transformOrigin: 'bottom center',
    filter: isSelected
      ? 'drop-shadow(0px 8px 12px rgba(0,0,0,0.3))'
      : 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))',
  });

  const svgColorMain = isDark ? '#2B6CB0' : '#4299E1';
  const svgColorTower = isDark ? '#2A4365' : '#3182CE';
  const svgColorRoof = isDark ? '#1A365D' : '#2B6CB0';
  const svgColorDoor = isDark ? '#E2E8F0' : '#E2E8F0';
  const svgColorClockStroke = '#2D3748';

  container.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 64 64">
      <path d="M12 48 L24 48 L24 28 L12 28 Z" fill="${svgColorMain}" />
      <path d="M40 48 L52 48 L52 28 L40 28 Z" fill="${svgColorMain}" />
      <path d="M24 48 L40 48 L40 16 L24 16 Z" fill="${svgColorTower}" />
      <path d="M10 28 L24 22 L24 28 Z" fill="${svgColorRoof}" />
      <path d="M54 28 L40 22 L40 28 Z" fill="${svgColorRoof}" />
      <path d="M22 16 L32 6 L42 16 Z" fill="${svgColorRoof}" />
      <ellipse cx="32" cy="24" rx="4" ry="4" fill="#E2E8F0" />
      <path d="M32 24 L32 22 M32 24 L34 24" stroke="${svgColorClockStroke}" stroke-width="1" />
      <path d="M28 48 L36 48 L36 38 Q32 34 28 38 Z" fill="${svgColorDoor}" />
      <rect x="15" y="32" width="6" height="8" fill="${svgColorDoor}" />
      <rect x="43" y="32" width="6" height="8" fill="${svgColorDoor}" />
    </svg>
  `;
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}

function renderPinMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  color: string,
  iconName: string,
  isEmergencyState: boolean,
  isSelected: boolean,
) {
  pinEl.innerHTML = '';
  const categoryLower = event.category?.toLowerCase() || '';
  if (
    categoryLower === 'parque' ||
    categoryLower === 'reserva' ||
    categoryLower === 'reservas' ||
    categoryLower === 'naturaleza'
  ) {
    pinEl.style.width = '0px';
    pinEl.style.height = '0px';
    pinEl.style.pointerEvents = 'none';
    return;
  }
  const container = document.createElement('div');
  container.className = 'marker-3d-container';
  Object.assign(container.style, {
    position: 'relative',
    width: '28px',
    height: '28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
  });

  // Standing Stem (Tapered Metallic Needle)
  const stem = document.createElement('div');
  stem.className = 'marker-3d-stem';
  Object.assign(stem.style, {
    position: 'absolute',
    bottom: '0px', // Anchored at ground level
    width: '3px',
    height: '0px',
    background: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, ${color} 100%)`,
    boxShadow: `0 0 4px ${hexToRgba(color, 0.6)}`,
    opacity: '0',
    transformOrigin: 'bottom center',
    transition: 'height 0.15s ease, opacity 0.15s ease',
    zIndex: '1',
    pointerEvents: 'none',
    clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)', // Tapered point pointing down
  });
  container.appendChild(stem);

  // Pin Wrapper (handles translation/scale JS styling)
  const pinWrapper = document.createElement('div');
  pinWrapper.className = 'marker-3d-pin-wrapper';
  Object.assign(pinWrapper.style, {
    position: 'absolute',
    bottom: '0px', // Center/base coordinate
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease',
    zIndex: '2',
    transformOrigin: 'bottom center',
  });

  // The Interactive Pin (handles local CSS anims like bobbing)
  const pin = document.createElement('div');
  pin.className = isEmergencyState ? 'marker-3d-pin emergency-pin' : 'marker-3d-pin';
  Object.assign(pin.style, {
    width: '28px',
    height: '28px',
    borderRadius: isEmergencyState ? '6px' : '50%',
    backgroundColor: isEmergencyState ? color : 'rgba(15, 23, 42, 0.85)', // Dark frosted glass
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: isEmergencyState ? '2px solid #111827' : `1.5px solid ${hexToRgba(color, 0.6)}`, // Colored glass edge
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: isEmergencyState ? '0px 2px 4px rgba(0,0,0,0.5)' : '0px 6px 16px rgba(0,0,0,0.4)', // Stronger shadow for dark mode
    zIndex: '2',
    position: 'relative',
  });
  pin.style.setProperty('--emergency-color', color);

  // Icon inside pin
  const icon = document.createElement('div');
  icon.className = 'marker-3d-icon';
  Object.assign(icon.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.15s ease',
    transform: isEmergencyState ? 'rotate(-45deg)' : 'none',
    animation: isEmergencyState ? 'none' : 'iconBreathing 2.5s infinite ease-in-out', // Micro-animation
  });

  const svgColor = isEmergencyState ? '#FFFFFF' : color;
  const svg = createSvgIcon(iconName, 15, svgColor);
  if (svg) {
    icon.appendChild(svg);
  } else {
    icon.innerText = '•';
  }

  pin.appendChild(icon);
  pinWrapper.appendChild(pin);
  container.appendChild(pinWrapper);

  // Emergency specific animations (Fire / Smoke)
  if (event.category === 'incendio') {
    const fireContainer = document.createElement('div');
    fireContainer.className = 'marker-fire-container';
    Object.assign(fireContainer.style, {
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '1',
    });
    for (let i = 0; i < 3; i++) {
      const particle = document.createElement('div');
      particle.className = `marker-fire-particle fire-particle-${i + 1}`;
      fireContainer.appendChild(particle);
    }
    container.insertBefore(fireContainer, pinWrapper);
  } else if (event.category === 'accidente' || event.category === 'choque') {
    const smokeContainer = document.createElement('div');
    smokeContainer.className = 'marker-smoke-container';
    Object.assign(smokeContainer.style, {
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '1',
    });
    for (let i = 0; i < 3; i++) {
      const particle = document.createElement('div');
      particle.className = `marker-smoke-particle smoke-particle-${i + 1}`;
      smokeContainer.appendChild(particle);
    }
    container.insertBefore(smokeContainer, pinWrapper);
  }

  // Floating Music Notes Animation
  if (event.category === 'musica') {
    const notesContainer = document.createElement('div');
    notesContainer.className = 'marker-notes-container';
    Object.assign(notesContainer.style, {
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      display: 'none',
      color: color,
    });

    const note1 = document.createElement('div');
    note1.className = 'marker-note';
    Object.assign(note1.style, {
      animation: 'floatNote1 2.5s infinite linear',
      animationDelay: '0s',
    });
    const n1Svg = createSvgIcon('music-note', 12, '#F6AD55');
    if (n1Svg) note1.appendChild(n1Svg);

    const note2 = document.createElement('div');
    note2.className = 'marker-note';
    Object.assign(note2.style, {
      animation: 'floatNote2 2.5s infinite linear',
      animationDelay: '0.8s',
    });
    const n2Svg = createSvgIcon('queue-music', 14, '#F6AD55');
    if (n2Svg) note2.appendChild(n2Svg);

    const note3 = document.createElement('div');
    note3.className = 'marker-note';
    Object.assign(note3.style, {
      animation: 'floatNote3 2.5s infinite linear',
      animationDelay: '1.6s',
    });
    const n3Svg = createSvgIcon('music-note', 10, '#F6AD55');
    if (n3Svg) note3.appendChild(n3Svg);

    notesContainer.appendChild(note1);
    notesContainer.appendChild(note2);
    notesContainer.appendChild(note3);
    pinWrapper.appendChild(notesContainer); // Anchored to pinWrapper to move with translation elevation!
  }

  // ─── Viñeta (Badge) ───────────────────────────────────────────────────────
  if (event.vineta) {
    renderVinetaBadge(pinWrapper, event.vineta);
  }

  pinEl.appendChild(container);
}

/**
 * Compute the best arc angles for a radial menu based on the element's viewport position.
 * Returns { startAngle, endAngle } in degrees (0=right, 90=down, CSS convention).
 */
function computeRadialAngles(el: HTMLElement): { startAngle: number; endAngle: number } {
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = (rect.left + rect.width / 2) / vw;
  const cy = (rect.top + rect.height / 2) / vh;
  const EDGE = 0.25;
  const nearLeft = cx < EDGE;
  const nearRight = cx > 1 - EDGE;
  const nearTop = cy < EDGE;
  const nearBottom = cy > 1 - EDGE;
  if (nearTop && nearLeft) return { startAngle: 0, endAngle: 90 };
  if (nearTop && nearRight) return { startAngle: 90, endAngle: 180 };
  if (nearBottom && nearLeft) return { startAngle: 270, endAngle: 360 };
  if (nearBottom && nearRight) return { startAngle: 180, endAngle: 270 };
  if (nearTop) return { startAngle: 10, endAngle: 170 };
  if (nearBottom) return { startAngle: 190, endAngle: 350 };
  if (nearLeft) return { startAngle: -70, endAngle: 70 };
  if (nearRight) return { startAngle: 110, endAngle: 250 };
  return { startAngle: 190, endAngle: 350 };
}

function updateMapLibreStoreModal(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  isHovered: boolean,
  isLightMode: boolean,
) {
  const showModal = isSelected || isHovered;
  let modalContainer = pinEl.querySelector('.store-modal-container') as HTMLDivElement | null;

  if (showModal) {
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.className = 'store-modal-container';
      Object.assign(modalContainer.style, {
        position: 'absolute',
        left: '50%',
        bottom: '100%',
        width: '0px',
        height: '0px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: '100',
        pointerEvents: 'auto',
        transition: 'opacity 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: '0',
      });
      pinEl.appendChild(modalContainer);

      const root = createRoot(modalContainer);
      (modalContainer as any)._reactRoot = root;

      // Trigger fade-in on next frame
      requestAnimationFrame(() => {
        if (modalContainer) modalContainer.style.opacity = '1';
      });
    }

    const root: Root = (modalContainer as any)._reactRoot;
    if (root) {
      const isAuthorityEvent = ['hospital', 'bombero', 'carabinero'].includes(
        event.category?.toLowerCase() || '',
      );
      root.render(
        isAuthorityEvent ? (
          <AuthorityModal event={event} isLightMode={isLightMode} />
        ) : (
          <MiniModal event={event} isLightMode={isLightMode} isSelected={isSelected} />
        ),
      );
    }
  } else if (modalContainer) {
    // Punto 3: animación de salida — fade out antes de destruir el React root
    modalContainer.style.opacity = '0';
    const capturedContainer = modalContainer;
    setTimeout(() => {
      const root = (capturedContainer as any)._reactRoot;
      if (root) {
        root.unmount();
        delete (capturedContainer as any)._reactRoot;
      }
      capturedContainer.remove();
    }, 220);
  }
}

function updateMapLibreRadialMenu(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  isHovered: boolean,
  onSelectEvent: (event: TurismoEvent | null) => void,
  menuId: string,
  onSaveLocation?: (data: any) => void,
) {
  const pin = pinEl.querySelector('.marker-3d-pin') as HTMLDivElement | null;
  if (!pin) return;

  // Pin actual rendered size (default 28px)
  const pinW = pin.offsetWidth || 28;
  const BUTTON_SIZE = Math.max(18, Math.min(22, pinW - 6)); // never larger than pin - 6px
  const ICON_SIZE = Math.round(BUTTON_SIZE * 0.55);
  const ORBIT_R = pinW / 2 + BUTTON_SIZE / 2 + 6; // gap of 6px

  const showMenu = isSelected || isHovered;
  let menuContainer = pin.querySelector('.radial-menu-container') as HTMLDivElement | null;

  if (showMenu) {
    // Notify registry — closes all other menus (guard to avoid recursive stack overflow)
    if (radialMenuRegistry.getCurrent() !== menuId) {
      radialMenuRegistry.open(menuId);
    }

    if (!menuContainer) {
      menuContainer = document.createElement('div');
      menuContainer.className = 'radial-menu-container';
      Object.assign(menuContainer.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '0px',
        height: '0px',
        pointerEvents: 'none',
        zIndex: '100',
      });
      pin.appendChild(menuContainer);
    }

    if (menuContainer.children.length === 0) {
      const radialItems = [
        { id: 'info', icon: 'info', tooltip: 'Detalles', action: 'info' },
        { id: 'bookmark', icon: 'bookmark', tooltip: 'Guardar', action: 'favorite' },
        { id: 'route', icon: 'directions', tooltip: 'Ruta', action: 'route' },
      ];

      const N = radialItems.length;
      const { startAngle, endAngle } = computeRadialAngles(pinEl);

      radialItems.forEach((item, index) => {
        const island = document.createElement('div');
        Object.assign(island.style, {
          position: 'absolute',
          left: '0px',
          top: '0px',
          zIndex: '150',
          transition:
            'transform 0.32s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease-out',
          transform: 'translate(0px, 0px) translate(-50%, -50%) scale(0)',
          opacity: '0',
          pointerEvents: 'auto',
        });

        const btn = document.createElement('button');
        btn.type = 'button';
        Object.assign(btn.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${BUTTON_SIZE}px`,
          height: `${BUTTON_SIZE}px`,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          transition: 'background-color 0.15s ease, transform 0.15s ease',
        });

        btn.addEventListener('mouseenter', () => {
          btn.style.backgroundColor = '#fff';
          btn.style.transform = 'scale(1.05)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.backgroundColor = 'rgba(255,255,255,0.95)';
          btn.style.transform = 'scale(1)';
        });

        const svg = createSvgIcon(item.icon, ICON_SIZE, '#002d20');
        if (svg) {
          btn.appendChild(svg);
        } else {
          const dotSpan = document.createElement('span');
          Object.assign(dotSpan.style, {
            fontSize: `${ICON_SIZE}px`,
            color: '#002d20',
            lineHeight: '1',
            userSelect: 'none',
          });
          dotSpan.innerText = '•';
          btn.appendChild(dotSpan);
        }

        // Tooltip
        const tooltip = document.createElement('span');
        Object.assign(tooltip.style, {
          position: 'absolute',
          left: '50%',
          bottom: `${-BUTTON_SIZE - 4}px`,
          transform: 'translateX(-50%)',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: 'rgba(24,24,27,0.92)',
          color: '#fff',
          fontSize: '9px',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          opacity: '0',
          transition: 'opacity 0.15s ease',
          pointerEvents: 'none',
          zIndex: '200',
          border: '1px solid rgba(255,255,255,0.1)',
        });
        tooltip.innerText = item.tooltip;

        btn.addEventListener('mouseenter', () => {
          tooltip.style.opacity = '1';
        });
        btn.addEventListener('mouseleave', () => {
          tooltip.style.opacity = '0';
        });

        btn.onclick = (e) => {
          e.stopPropagation();
          if (item.action === 'info') {
            onSelectEvent(event);
          } else if (item.action === 'favorite') {
            if (onSaveLocation) {
              onSaveLocation({
                locationType: 'event',
                refId: event.id,
                latitude: event.latitude,
                longitude: event.longitude,
                title: event.title,
                notes: event.description,
              });
            } else {
              alert(`Guardado en Pasaporte: ${event.title}`);
            }
          } else if (item.action === 'route') {
            alert(`Calculando ruta hacia: ${event.title}`);
          }
          updateMapLibreRadialMenu(pinEl, event, false, false, onSelectEvent, menuId);
          radialMenuRegistry.close(menuId);
        };

        island.appendChild(btn);
        island.appendChild(tooltip);
        menuContainer!.appendChild(island);

        // Angle distribution
        const angleDeg =
          N === 1
            ? (startAngle + endAngle) / 2
            : startAngle + index * ((endAngle - startAngle) / (N - 1));
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = ORBIT_R * Math.cos(angleRad);
        const y = ORBIT_R * Math.sin(angleRad);

        requestAnimationFrame(() => {
          island.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1)`;
          island.style.opacity = '1';
        });
      });
    }
  } else {
    if (radialMenuRegistry.getCurrent() === menuId) {
      radialMenuRegistry.close(menuId);
    }
    if (menuContainer) {
      const islands = Array.from(menuContainer.children) as HTMLElement[];
      islands.forEach((island) => {
        island.style.transform = 'translate(0px, 0px) translate(-50%, -50%) scale(0)';
        island.style.opacity = '0';
      });

      const toRemove = menuContainer;
      setTimeout(() => {
        if (toRemove && toRemove.parentNode) {
          toRemove.parentNode.removeChild(toRemove);
        }
      }, 350);
    }
  }
}

const CloudShadows = React.memo(() => {
  return (
    <div className="cloud-shadows-container">
      <div
        className="cloud-shadow"
        style={{ top: '10%', left: '-20%', animationDelay: '0s', width: '800px', height: '500px' }}
      />
      <div
        className="cloud-shadow"
        style={{ top: '40%', left: '-40%', animationDelay: '15s', width: '600px', height: '400px' }}
      />
      <div
        className="cloud-shadow"
        style={{ top: '70%', left: '-10%', animationDelay: '35s', width: '900px', height: '600px' }}
      />
    </div>
  );
});

function getBeforeRoadsOrLabelsLayerId(map: any): string | undefined {
  const style = map.getStyle();
  if (!style || !style.layers) return undefined;

  // Insertar polígonos antes del bloque final de etiquetas, no antes del primer
  // symbol que aparezca: algunos estilos CARTO (positron/voyager) intercalan
  // un symbol (waterway_label) muy temprano, antes de calles y edificios,
  // mientras que dark-matter lo deja al final. Buscar el último layer no-symbol
  // evita que los polígonos queden debajo de calles/edificios en day themes.
  let lastNonSymbolIndex = -1;
  for (let i = 0; i < style.layers.length; i++) {
    if (style.layers[i].type !== 'symbol') lastNonSymbolIndex = i;
  }

  const nextLayer = style.layers[lastNonSymbolIndex + 1];
  return nextLayer ? nextLayer.id : undefined;
}

function updateMarkerDomRefs(markerObj: any) {
  const { pinEl, flatEl } = markerObj;
  if (!pinEl) return;
  markerObj.domRefs = {
    pinWrapper: pinEl.querySelector('.marker-3d-pin-wrapper'),
    pin: pinEl.querySelector('.marker-3d-pin'),
    stem: pinEl.querySelector('.marker-3d-stem'),
    icon: pinEl.querySelector('.marker-3d-icon'),
    flatContainer: flatEl ? flatEl.querySelector('.marker-flat-container') : null,
    shadowPin: flatEl ? flatEl.querySelector('.marker-3d-shadow-pin') : null,
    shadowStem: flatEl ? flatEl.querySelector('.marker-3d-shadow-stem') : null,
    puncture: flatEl ? flatEl.querySelector('.marker-3d-puncture') : null,
    ripples: flatEl ? flatEl.querySelectorAll('.water-ripple') : null,
    storeModal: pinEl.querySelector('.store-modal-container'),
    notesContainer: pinEl.querySelector('.marker-notes-container'),
    badgeEl: pinEl.querySelector('.vineta-badge'),
    loboSVG: pinEl.querySelector('.marker-lobo-marino-container svg g'),
    boatBody: pinEl.querySelector('.marker-boat-body'),
    wakeContainer: flatEl ? flatEl.querySelector('.boat-wake-container') : null,
  };
}

export function MapLibreContainer({
  events,
  selectedEvent,
  onSelectEvent,
  mapLayer,
  userLocation,
  centerTrigger,
  tacticalMode,
  onTacticalLocationChange,
  onMapPincho,
  mapPincho,
  onMapMove,
  zoom = 13,
  onZoomChange,
  showTraffic = false,
  showCycleways = false,
  cyclewaysData = [],
  showSectors = true,
  sectorsData,
  visibleSectorIds,
  showWeather = false,
  weatherType = 'precipitation',
  onSaveLocation,
  onSectorPress,
  activeNestedZone,
  activeFloor,
  isMagicWandActive = false,
  onMagicWandSelect,
}: MapContainerProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinMarkerRef = useRef<{ marker: maplibregl.Marker; el: HTMLDivElement } | null>(null);
  const [currentBounds, setCurrentBounds] = useState<
    | {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
      }
    | undefined
  >(undefined);
  const [radarPath, setRadarPath] = useState<string | null>(null);
  const [internalFloor, setInternalFloor] = useState<number | null>(null);

  useEffect(() => {
    if (selectedEvent?.indoorMap) {
      setInternalFloor(selectedEvent.indoorMap.defaultFloor);
    } else {
      setInternalFloor(null);
    }
  }, [selectedEvent]);

  // Track our DOM markers
  const markersRef = useRef<{
    [id: string]: {
      pinMarker: maplibregl.Marker;
      pinEl: HTMLDivElement;
      flatMarker?: maplibregl.Marker;
      flatEl?: HTMLDivElement;
      isCluster?: boolean;
      event?: TurismoEvent;
      closeTimeout?: any;
      unsubRegistry?: () => void;
      domRefs?: {
        pinWrapper: HTMLDivElement | null;
        pin: HTMLDivElement | null;
        stem: HTMLDivElement | null;
        icon: HTMLDivElement | null;
        flatContainer: HTMLDivElement | null;
        shadowPin: HTMLDivElement | null;
        shadowStem: HTMLDivElement | null;
        puncture: HTMLDivElement | null;
        ripples: NodeListOf<HTMLDivElement> | null;
        storeModal: HTMLDivElement | null;
        notesContainer: HTMLDivElement | null;
        badgeEl: HTMLDivElement | null;
        loboSVG: SVGElement | null;
        boatBody: HTMLDivElement | null;
        wakeContainer: HTMLDivElement | null;
      };
    };
  }>({});
  const userMarkerRef = useRef<{ marker: maplibregl.Marker; el: HTMLDivElement } | null>(null);
  const userAccuracyRef = useRef<{ accuracyMeters: number; latitude: number } | null>(null);
  const latestUserLocationRef = useRef(userLocation);
  const onSectorPressRef = useRef(onSectorPress);
  const activeNestedZoneRef = useRef(activeNestedZone);
  const isMagicWandActiveRef = useRef(isMagicWandActive);
  const onMagicWandSelectRef = useRef(onMagicWandSelect);

  // Refs to avoid stale closures in map event listeners
  const eventsRef = useRef(events);
  const onSelectEventRef = useRef(onSelectEvent);
  const onSaveLocationRef = useRef(onSaveLocation);
  const selectedEventRef = useRef(selectedEvent);
  const mapLayerRef = useRef(mapLayer);
  const onZoomChangeRef = useRef(onZoomChange);
  const onMapPinchoRef = useRef(onMapPincho);
  const onMapMoveRef = useRef(onMapMove);
  const isDraggingRef = useRef(false);
  const updateAestheticsRef = useRef<() => void>(() => {});
  const tileCacheRef = useRef<SatelliteTileCache | null>(null);
  const trafficCacheRef = useRef<TrafficTileCache | null>(null);
  const syncUserLocationRef = useRef<() => void>(() => {});
  const syncTrafficRef = useRef<() => void>(() => {});
  const syncWeatherRef = useRef<() => void>(() => {});
  const syncZonesRef = useRef<() => void>(() => {});
  const syncCyclewaysRef = useRef<() => void>(() => {});
  const syncClustersRef = useRef<() => void>(() => {});
  const syncEventPolygonsRef = useRef<() => void>(() => {});

  const sectorsDataRef = useRef(sectorsData);
  const visibleSectorIdsRef = useRef(visibleSectorIds);
  const showSectorsRef = useRef(showSectors);

  useEffect(() => {
    isMagicWandActiveRef.current = isMagicWandActive;
    onMagicWandSelectRef.current = onMagicWandSelect;
  }, [isMagicWandActive, onMagicWandSelect]);

  useEffect(() => {
    sectorsDataRef.current = sectorsData;
    visibleSectorIdsRef.current = visibleSectorIds;
    showSectorsRef.current = showSectors;
    eventsRef.current = events;
    onSelectEventRef.current = onSelectEvent;
    onSaveLocationRef.current = onSaveLocation;
    // Only override selectedEventRef with the external prop if there's no locally-selected minimodal event
    const hasLocalMiniModal = Object.values(markersRef.current).some(
      (m) =>
        ['hospital', 'universidad', 'bombero', 'carabinero', 'camara'].includes(
          m.event?.category?.toLowerCase() || '',
        ) && m.pinEl.dataset.localSelected === 'true',
    );
    if (!hasLocalMiniModal) {
      selectedEventRef.current = selectedEvent;
    }
    mapLayerRef.current = mapLayer;
    onZoomChangeRef.current = onZoomChange;
    onMapPinchoRef.current = onMapPincho;
    onMapMoveRef.current = onMapMove;
    latestUserLocationRef.current = userLocation;
    onSectorPressRef.current = onSectorPress;
    activeNestedZoneRef.current = activeNestedZone;

    if (updateAestheticsRef.current) {
      updateAestheticsRef.current();
    }
    if (syncEventPolygonsRef.current) {
      syncEventPolygonsRef.current();
    }
  }, [
    events,
    onSelectEvent,
    selectedEvent,
    mapLayer,
    onZoomChange,
    onMapPincho,
    onMapMove,
    userLocation,
    sectorsData,
    visibleSectorIds,
    onSectorPress,
    activeNestedZone,
  ]);

  // Effect to fetch the latest RainViewer radar path when weather is enabled
  useEffect(() => {
    if (showWeather && weatherType === 'precipitation' && !radarPath) {
      getLatestRadarPath().then(setRadarPath);
    }
  }, [showWeather, weatherType, radarPath]);

  // --- Nested Zone Camera Animation & Interaction Lock ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (activeNestedZone && activeNestedZone.geojson) {
      // Guardar el maxZoom original de la capa actual para restaurarlo después
      const originalMaxZoom = MAX_ZOOM_PER_LAYER[mapLayerRef.current] || 18;

      // Permitir zoom mucho más cercano al edificio (nivel "indoor")
      map.setMaxZoom(21);

      // Deshabilitar TODA interacción del usuario con el mapa
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.dragRotate.disable();
      map.keyboard.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
      // Bloquear el canvas para que no capture eventos de puntero
      map.getCanvas().style.pointerEvents = 'none';
      map.getCanvasContainer().style.pointerEvents = 'none';

      const geojson =
        typeof activeNestedZone.geojson === 'string'
          ? JSON.parse(activeNestedZone.geojson)
          : activeNestedZone.geojson;

      if (geojson.type === 'Polygon' && geojson.coordinates && geojson.coordinates[0]) {
        let minLat = 90,
          maxLat = -90,
          minLng = 180,
          maxLng = -180;

        geojson.coordinates[0].forEach((coord: [number, number]) => {
          if (coord[1] < minLat) minLat = coord[1];
          if (coord[1] > maxLat) maxLat = coord[1];
          if (coord[0] < minLng) minLng = coord[0];
          if (coord[0] > maxLng) maxLng = coord[0];
        });

        // Primero resetear pitch y bearing a vista cenital
        map.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 400,
        });

        // Luego ajustar los bounds del edificio con animación y zoom alto
        setTimeout(() => {
          if (!mapRef.current) return;
          mapRef.current.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            { padding: 120, duration: 800, maxZoom: 21 },
          );
        }, 450);
      }

      return () => {
        // Cleanup: rehabilitar interacción y restaurar maxZoom original
        if (mapRef.current) {
          const m = mapRef.current;
          m.setMaxZoom(originalMaxZoom);
          m.dragPan.enable();
          m.scrollZoom.enable();
          m.boxZoom.enable();
          m.dragRotate.enable();
          m.keyboard.enable();
          m.doubleClickZoom.enable();
          m.touchZoomRotate.enable();
          m.getCanvas().style.pointerEvents = 'auto';
          m.getCanvasContainer().style.pointerEvents = 'auto';
        }
      };
    } else {
      // No hay zona activa: asegurar que la interacción esté habilitada
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.boxZoom.enable();
      map.dragRotate.enable();
      map.keyboard.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
      map.getCanvas().style.pointerEvents = 'auto';
      map.getCanvasContainer().style.pointerEvents = 'auto';
    }
  }, [activeNestedZone]);

  // --- Indoor Floor Plans Effect ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = 'indoor-floorplan-source';
    const layerId = 'indoor-floorplan-layer';

    if (
      activeNestedZone &&
      activeNestedZone.geojson &&
      activeFloor !== null &&
      activeFloor !== undefined
    ) {
      // In Phase 2 prototype, we use a placeholder image if activeFloor > 0
      // In production, we would fetch the floor plan URL and bounds from the API

      const geojson =
        typeof activeNestedZone.geojson === 'string'
          ? JSON.parse(activeNestedZone.geojson)
          : activeNestedZone.geojson;

      if (geojson.type === 'Polygon' && geojson.coordinates && geojson.coordinates[0]) {
        let minLat = 90,
          maxLat = -90,
          minLng = 180,
          maxLng = -180;

        geojson.coordinates[0].forEach((coord: [number, number]) => {
          if (coord[1] < minLat) minLat = coord[1];
          if (coord[1] > maxLat) maxLat = coord[1];
          if (coord[0] < minLng) minLng = coord[0];
          if (coord[0] > maxLng) maxLng = coord[0];
        });

        const coordinates = [
          [minLng, maxLat], // Top left (NW)
          [maxLng, maxLat], // Top right (NE)
          [maxLng, minLat], // Bottom right (SE)
          [minLng, minLat], // Bottom left (SW)
        ];

        // En producción, obtenemos la URL del plano de la base de datos (BuildingMedia donde type='floorplan')
        // Si el negocio no ha subido ningún plano, floorplanUrl será null y no se mostrará nada.
        const floorplanUrl: string | null = null; // TODO: Fetch from API

        if (floorplanUrl) {
          if (map.getSource(sourceId)) {
            // MapLibre requires removing layer/source to update URL
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            map.removeSource(sourceId);
          }

          map.addSource(sourceId, {
            type: 'image',
            url: floorplanUrl,
            coordinates: coordinates as any,
          });

          map.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: {
              'raster-opacity': 0.85,
              'raster-fade-duration': 300,
            },
          });
        } else {
          // Remove if no URL
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      }
    } else {
      // Remove layer if not in building or no active floor
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }

    return () => {
      // Don't remove on unmount to prevent flickering during floor changes,
      // it is handled by the else branch or parent unmount
    };
  }, [activeNestedZone, activeFloor]);

  // Sector Visibility Effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibility = showSectors ? 'visible' : 'none';
    if (map.getLayer('zones-fill')) {
      map.setLayoutProperty('zones-fill', 'visibility', visibility);
    }
    if (map.getLayer('zones-outline')) {
      map.setLayoutProperty('zones-outline', 'visibility', visibility);
    }
  }, [showSectors]);

  // Initialization
  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    // Registrar siempre el protocolo de caché de tiles satelitales
    const cache = SatelliteTileCache.getInstance();
    cache.registerProtocol();
    tileCacheRef.current = cache;

    // Registrar caché de tráfico
    const trafficCache = TrafficTileCache.getInstance();
    trafficCache.registerProtocol();
    trafficCacheRef.current = trafficCache;

    // Determinar estilo inicial
    const initialLayer = mapLayerRef.current;
    const initialMaxZoom = MAX_ZOOM_PER_LAYER[initialLayer] || 18;
    // Satélite siempre usa el protocolo cacheado para Ultra HD automático
    const initialStyle =
      initialLayer === 'satellite'
        ? getSatelliteStyle(true)
        : mapStyles[initialLayer] || CARTO_VECTOR_STYLE_URL;

    const map = new maplibregl.Map({
      container: mapNodeRef.current,
      style: initialStyle,
      center: [VALDIVIA_LNG, VALDIVIA_LAT],
      zoom: 13,
      maxZoom: initialMaxZoom,
      attributionControl: false,
    });

    mapRef.current = map;

    // Setup ResizeObserver for responsive layout updates
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    if (mapNodeRef.current) {
      resizeObserver.observe(mapNodeRef.current);
    }

    // Calcular bounds estables basados en centro + zoom, ignorando pitch.
    // map.getBounds() cambia drásticamente al inclinar la cámara (ves hasta el horizonte),
    // lo que causa que Supercluster recalcule agrupaciones completamente distintas
    // con centroides diferentes, haciendo que los clusters "salten" de posición.
    const getStableBounds = () => {
      const center = map.getCenter();
      const z = map.getZoom();
      // Calcular el span geográfico teórico para este zoom (sin pitch)
      // A zoom 0, se ven ~360° de longitud. Cada nivel de zoom reduce el span a la mitad.
      // Añadimos 1.5x padding para evitar pop-in en bordes.
      const latSpan = (180 / Math.pow(2, z)) * 1.5;
      const lngSpan = (360 / Math.pow(2, z)) * 1.5;
      return {
        minLat: Math.max(-85, center.lat - latSpan),
        maxLat: Math.min(85, center.lat + latSpan),
        minLng: Math.max(-180, center.lng - lngSpan),
        maxLng: Math.min(180, center.lng + lngSpan),
      };
    };

    // Track last center+zoom to avoid re-clustering on pure rotation/pitch
    let lastStableCenter = { lat: 0, lng: 0 };
    let lastStableZoom = -1;

    let boundsTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedUpdateBounds = () => {
      if (boundsTimer) clearTimeout(boundsTimer);
      boundsTimer = setTimeout(() => {
        const center = map.getCenter();
        const z = map.getZoom();
        // Solo recalcular si el centro o zoom cambiaron significativamente
        const centerDelta =
          Math.abs(center.lat - lastStableCenter.lat) + Math.abs(center.lng - lastStableCenter.lng);
        const zoomDelta = Math.abs(z - lastStableZoom);
        if (centerDelta < 0.0001 && zoomDelta < 0.01) return; // Sin cambio real

        lastStableCenter = { lat: center.lat, lng: center.lng };
        lastStableZoom = z;
        setCurrentBounds(getStableBounds());
      }, 80);
    };

    map.on('load', () => {
      const center = map.getCenter();
      lastStableCenter = { lat: center.lat, lng: center.lng };
      lastStableZoom = map.getZoom();
      setCurrentBounds(getStableBounds());

      // ── Native Mobiliario Layer (Static High-Perf POIs) ──
      const addSvgImageToMap = (id: string, svgString: string) => {
        if (map.hasImage(id)) return;
        const img = new Image(32, 32);
        img.onload = () => {
          map.addImage(id, img, { pixelRatio: 2 });
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      };

      const isDark = mapLayerRef.current === 'dark' || mapLayerRef.current === 'satellite';
      const svgColor = isDark ? '#A0AEC0' : '#4A5568';

      const svgBench = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${svgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/><path d="M2 18h20"/><path d="M6 12v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>`;
      const svgWaste = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${svgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
      const svgWater = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#63B3ED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`;
      const svgToilet = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${svgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M18 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M5 8v12"/><path d="M11 8v12"/><path d="M5 13h6"/><path d="M13 8l2 12"/><path d="M19 8l-2 12"/><path d="M14 13h4"/></svg>`;

      addSvgImageToMap('bench', svgBench);
      addSvgImageToMap('waste_basket', svgWaste);
      addSvgImageToMap('drinking_water', svgWater);
      addSvgImageToMap('toilets', svgToilet);

      if (!map.getSource('mobiliario-source')) {
        map.addSource('mobiliario-source', {
          type: 'geojson',
          data: MOBILIARIO_GEOJSON as any,
        });
        map.addLayer({
          id: 'mobiliario-layer',
          type: 'symbol',
          source: 'mobiliario-source',
          minzoom: 15,
          layout: {
            'icon-image': ['get', 'amenity'],
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.5, 1],
          },
        });
      }

      // ── Native Cluster Layers (rendered on WebGL canvas, not DOM) ──
      if (!map.getSource('clusters-source')) {
        map.addSource('clusters-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Circle background layer - pitch-aligned to map surface
        map.addLayer({
          id: 'cluster-circles',
          type: 'circle',
          source: 'clusters-source',
          paint: {
            'circle-color': '#0B0F19',
            'circle-radius': ['get', 'radius'],
            'circle-stroke-width': 3,
            'circle-stroke-color': ['get', 'color'],
            'circle-pitch-alignment': 'map',
            'circle-opacity': 1,
            'circle-stroke-opacity': 1,
          },
        });

        // Text label layer - also pitch-aligned to map surface
        map.addLayer({
          id: 'cluster-labels',
          type: 'symbol',
          source: 'clusters-source',
          layout: {
            'text-field': ['get', 'count'],
            'text-size': ['get', 'fontSize'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-pitch-alignment': 'map',
            'text-rotation-alignment': 'map',
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.6)',
            'text-halo-width': 1,
          },
        });
      }

      // Click handler for cluster circles
      map.on('click', 'cluster-circles', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const centroidLng = props.centroidLng as number;
        const centroidLat = props.centroidLat as number;
        const maxPossibleZoom = MAX_ZOOM_PER_LAYER[mapLayerRef.current] || 18;
        const nextZoom = Math.min(map.getZoom() + 3, maxPossibleZoom - 1);
        if (onZoomChangeRef.current) {
          onZoomChangeRef.current(nextZoom);
        }
        map.easeTo({
          center: [centroidLng, centroidLat],
          zoom: nextZoom,
          duration: 600,
        });
      });

      // Cursor feedback for clusters
      map.on('mouseenter', 'cluster-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'cluster-circles', () => {
        map.getCanvas().style.cursor = '';
      });
    });
    map.on('moveend', debouncedUpdateBounds);
    map.on('zoomend', debouncedUpdateBounds);

    // Inyectar estilos personalizados para hacer la atribución ultra-discreta y estética
    const styleId = 'maplibre-custom-attribution-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .maplibregl-ctrl-attrib {
          opacity: 0.25 !important;
          transition: opacity 0.2s ease !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .maplibregl-ctrl-attrib:hover {
          opacity: 0.85 !important;
        }
        .maplibregl-ctrl-attrib-button {
          background-color: rgba(34, 34, 34, 0.6) !important;
          border-radius: 50% !important;
        }
        @keyframes webPublicPulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(var(--max-scale, 3)); opacity: 0.3; }
          100% { transform: scale(calc(var(--max-scale, 3) * 0.4)); opacity: 0; }
        }
        @keyframes popularAuraPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes clusterDataRing {
          0% { transform: scale(1) rotate(0deg); opacity: 0.6; }
          50% { transform: scale(1.6) rotate(180deg); opacity: 0.3; }
          100% { transform: scale(1.1) rotate(360deg); opacity: 0; }
        }
        @keyframes rewardPop {
          0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -20px) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -30px) scale(1); opacity: 0; }
        }
        @keyframes emergencyPerimeterRotate {
          0% { transform: rotateZ(0deg); }
          100% { transform: rotateZ(360deg); }
        }
        @keyframes emergencyPerimeterFlash {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.8; }
        }
        .marker-3d-pin.emergency-pin::after {
          content: '';
          position: absolute;
          top: -2px; left: -2px; right: -2px; bottom: -2px;
          border-radius: inherit;
          border: 2px solid var(--emergency-color, #EF4444);
          animation: emergencyRipple 1.5s infinite cubic-bezier(0.25, 1, 0.5, 1);
          pointer-events: none;
        }
        @keyframes emergencyRipple {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.4; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        @keyframes floatNote1 {
          0% { transform: translate(-50%, 0) translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { transform: translate(-50%, 0) translateY(-65px) translateX(-18px) scale(1.1) rotate(-15deg); opacity: 0; }
        }
        @keyframes floatNote2 {
          0% { transform: translate(-50%, 0) translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { transform: translate(-50%, 0) translateY(-75px) translateX(18px) scale(1) rotate(15deg); opacity: 0; }
        }
        @keyframes floatNote3 {
          0% { transform: translate(-50%, 0) translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { transform: translate(-50%, 0) translateY(-55px) translateX(-5px) scale(1.2) rotate(5deg); opacity: 0; }
        }
        .marker-note {
          position: absolute;
          bottom: 12px;
          left: 50%;
          font-size: 14px;
          color: inherit;
          text-shadow: 0 0 3px rgba(0,0,0,0.6);
          pointer-events: none;
          opacity: 0;
          transform-origin: bottom center;
        }
        @keyframes webClusterPulse {
          0% { transform: scale(1); opacity: 0.65; }
          50% { transform: scale(2.0); opacity: 0.3; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        .cluster-marker-container {
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
        }
        .cluster-marker-entering {
          animation: clusterEnter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes clusterEnter {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pinBobbing {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
        .marker-bobbing {
          animation: pinBobbing 2.2s infinite ease-in-out !important;
        }
        @keyframes iconBreathing {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); opacity: 0.9; }
        }
        @keyframes fireRise {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 0.8; background: #fb923c; }
          50% { transform: translateY(-10px) scale(1.2) rotate(15deg); opacity: 0.9; background: #ef4444; }
          100% { transform: translateY(-20px) scale(0.5) rotate(-15deg); opacity: 0; background: #b91c1c; }
        }
        .marker-fire-particle {
          position: absolute;
          bottom: 16px;
          left: 50%;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transform-origin: center;
          filter: blur(1px);
        }
        .fire-particle-1 { animation: fireRise 1.2s infinite ease-in; margin-left: -4px; }
        .fire-particle-2 { animation: fireRise 1.4s infinite ease-in 0.3s; margin-left: -1px; width: 10px; height: 10px; }
        .fire-particle-3 { animation: fireRise 1.1s infinite ease-in 0.6s; margin-left: 2px; }

        @keyframes smokeRise {
          0% { transform: translateY(0) scale(1); opacity: 0.7; }
          100% { transform: translateY(-25px) scale(2.5); opacity: 0; }
        }
        .marker-smoke-particle {
          position: absolute;
          bottom: 16px;
          left: 50%;
          width: 10px;
          height: 10px;
          background: #94a3b8;
          border-radius: 50%;
          filter: blur(2px);
        }
        .smoke-particle-1 { animation: smokeRise 1.5s infinite ease-out; margin-left: -5px; }
        .smoke-particle-2 { animation: smokeRise 1.8s infinite ease-out 0.4s; margin-left: -2px; }
        .smoke-particle-3 { animation: smokeRise 1.6s infinite ease-out 0.8s; margin-left: 3px; }
        @keyframes boatBobbing {
          0%, 100% { transform: translateZ(0); }
          50% { transform: translateZ(1.5px) rotateX(0.5deg) rotateY(0.5deg); }
        }
        .marker-boat-bobbing {
          animation: boatBobbing 3s infinite ease-in-out !important;
          transform-style: preserve-3d;
        }
        @keyframes cloudMove {
          0% { transform: translate(-120%, -120%) scale(1); opacity: 0; }
          10% { opacity: 0.15; }
          90% { opacity: 0.15; }
          100% { transform: translate(250%, 250%) scale(1.5); opacity: 0; }
        }
        .cloud-shadows-container {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          overflow: hidden;
          pointer-events: none;
          z-index: 5;
        }
        .cloud-shadow {
          position: absolute;
          background: rgba(0, 0, 0, 0.2);
          filter: blur(80px);
          border-radius: 50%;
          width: 600px;
          height: 400px;
          animation: cloudMove 60s infinite linear;
        }
        @keyframes waterRipple {
          0% { transform: scale(0.3); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.4; }
          100% { transform: scale(0.9); opacity: 0; }
        }
        .water-ripple {
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1.5px solid #60A5FA;
          pointer-events: none;
          animation: waterRipple 2.4s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
          transform-origin: center center;
          z-index: 1;
          display: none; /* hidden by default, toggled in JS */
        }
        .water-ripple-delay {
          animation-delay: 1.2s;
        }
        @keyframes boatWakeLeft {
          0% { transform: scale(0.5, 0.5) translate(0, 0) rotate(10deg); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: scale(1.5, 3.0) translate(-18px, 45px) rotate(20deg); opacity: 0; }
        }
        @keyframes boatWakeRight {
          0% { transform: scale(0.5, 0.5) translate(0, 0) rotate(-10deg); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: scale(1.5, 3.0) translate(18px, 45px) rotate(-20deg); opacity: 0; }
        }
        @keyframes boatBowWave {
          0% { transform: scale(0.4) translateX(-50%); opacity: 0; }
          30% { opacity: 0.4; }
          100% { transform: scale(1.4) translateX(-50%); opacity: 0; }
        }
        @keyframes boatFoam {
          0% { transform: scale(0.7) translate(-50%, 0); opacity: 0.7; }
          100% { transform: scale(2.2) translate(-50%, 25px); opacity: 0; }
        }
        .boat-bow-wave {
          position: absolute;
          top: -4px;
          left: 50%;
          width: 24px;
          height: 12px;
          border-top: 2px solid rgba(255, 255, 255, 0.4);
          border-radius: 50% 50% 0 0;
          transform: translateX(-50%);
          filter: blur(1.5px);
          animation: boatBowWave 2.8s infinite ease-out;
          pointer-events: none;
          z-index: 1;
        }
        .marker-flat-container {
          overflow: visible; /* Fix: allow waves to expand beyond 28px without clipping */
        }

        /* ─── Selected Pin Glow Animation ───────────────────────────── */
        @keyframes selectedPinPulse {
          0% { box-shadow: 0 0 0 0px var(--selected-glow-color, rgba(59, 130, 246, 0.6)); }
          100% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
        }
        .marker-3d-pin.selected-pin-glow::before {
          content: '';
          position: absolute;
          top: -4px; left: -4px; right: -4px; bottom: -4px;
          border-radius: inherit;
          border: 1.5px solid var(--selected-glow-color, #3B82F6);
          animation: selectedPinPulse 1.8s infinite cubic-bezier(0.25, 1, 0.5, 1);
          pointer-events: none;
          z-index: -1;
        }

        /* ─── Viñeta (Badge) Animations ─────────────────────────────── */
        @keyframes vinetaEnter {
          0% { transform: translateX(-50%) scale(0); opacity: 0; }
          60% { transform: translateX(-50%) scale(1.15); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        @keyframes vinetaPulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 1; }
          50% { transform: translateX(-50%) scale(1.12); opacity: 0.85; }
        }
        @keyframes vinetaGlowRing {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes vinetaGoldShine {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes vinetaHeartbeat {
          0%, 100% { transform: translateX(-50%) scale(1); }
          14% { transform: translateX(-50%) scale(1.15); }
          28% { transform: translateX(-50%) scale(1); }
          42% { transform: translateX(-50%) scale(1.15); }
          70% { transform: translateX(-50%) scale(1); }
        }
        @keyframes vinetaCriticalPulse {
          0%, 100% { transform: translateX(-50%) scale(1); box-shadow: 0 2px 8px rgba(220, 38, 38, 0.6), 0 0 0 1.5px rgba(0,0,0,0.3); }
          50% { transform: translateX(-50%) scale(1.15); box-shadow: 0 2px 12px rgba(220, 38, 38, 0.95), 0 0 0 1.5px rgba(220,38,38,0.5); }
        }
        .vineta-badge {
          transition: width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), 
                      padding 0.35s ease, 
                      border-radius 0.35s ease, 
                      transform 0.2s ease, 
                      box-shadow 0.2s ease;
        }
        .vineta-label {
          transition: opacity 0.2s ease, max-width 0.35s cubic-bezier(0.25, 1, 0.5, 1), margin-left 0.35s ease;
          display: inline-block;
          max-width: 0;
          opacity: 0;
          overflow: hidden;
          vertical-align: middle;
          white-space: nowrap;
        }
        .vineta-badge.vineta-expanded .vineta-label {
          max-width: 80px;
          opacity: 1;
          margin-left: 2px;
        }
        .vineta-en_vivo {
          animation: vinetaPulse 1.8s infinite ease-in-out !important;
        }
        .vineta-gold-sparkle {
          background-size: 200% auto !important;
          animation: vinetaGoldShine 2.5s infinite linear, vinetaEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
        }
        .vineta-heartbeat {
          animation: vinetaHeartbeat 2s infinite ease-in-out !important;
        }
        .vineta-critical-pulse {
          animation: vinetaCriticalPulse 1.2s infinite ease-in-out !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Agregar atribución compacta de forma segura en la esquina inferior izquierda
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    const updateAesthetics = () => {
      const z = map.getZoom();
      const pitch = map.getPitch();
      const accuracyState = userAccuracyRef.current;
      if (accuracyState && map.getLayer('user-accuracy-layer')) {
        const radius = getAccuracyRadiusAtZoom(
          accuracyState.accuracyMeters,
          accuracyState.latitude,
          z,
        );
        map.setPaintProperty('user-accuracy-layer', 'circle-radius', radius);
      }

      Object.keys(markersRef.current).forEach((id) => {
        const markerObj = markersRef.current[id];
        if (!markerObj) return;

        if (markerObj.isCluster) {
          // Clusters are now rendered as native MapLibre layers — skip DOM handling
          return;
        }

        const pinEl = markerObj.pinEl;
        const flatEl = markerObj.flatEl;
        const isSelected =
          selectedEventRef.current?.id === id || pinEl.dataset.localSelected === 'true';

        const cat = pinEl.dataset.category || '';
        const isEmergencyState = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(cat);
        const rotateTransform = isEmergencyState ? 'rotate(45deg)' : '';

        // 1. Zoom Adaptation
        let zoomScale = 1;
        let zoomOpacity = 1;
        let showIcon = true;
        let isVisible = true;

        const isBoat = cat === 'embarcacion';
        const boatVisibilityThreshold = 14;

        if (isBoat && z < boatVisibilityThreshold) {
          isVisible = false;
          zoomScale = 0;
          zoomOpacity = 0;
        }

        // Apply visibility and pointer-events
        pinEl.style.visibility = isVisible ? 'visible' : 'hidden';
        pinEl.style.pointerEvents = isVisible ? 'auto' : 'none';

        // Update z-index dynamically: selected or hovered pins get high priority
        const isHovered = pinEl.dataset.hovered === 'true';
        const baseZ = isBoat ? '1' : '10';
        pinEl.style.zIndex = isSelected || isHovered ? '9999' : baseZ;

        const flatScale = 1;

        const surface = pinEl.dataset.surface || 'land';

        // Pitch 3D Effect Calculation

        // Dynamic Elevation: Selected pin floats even higher into the sky as zoom increases
        // to emphasize the 3D landmark pop-out effect.
        const baseMaxElevation = isBoat ? 0 : isSelected ? 26 : isHovered ? 22 : 18;
        const elevationGrow = isSelected && z > 13 ? (z - 13) * 5.0 : 0; // Floating height grows with zoom
        const maxElevation = baseMaxElevation + elevationGrow;

        const elevation = isVisible
          ? Math.sin((pitch * Math.PI) / 180) * maxElevation * zoomScale
          : 0;

        let selectedZoomGrow = 1.0;
        if (isSelected && z > 13) {
          // Crece de manera inteligente y progresiva cuando nos acercamos (hacemos zoom) al pin marcado
          selectedZoomGrow = 1.0 + (z - 13) * 0.38; // Increased growth factor for zoom-responsive scaling
        }
        const baseScale = isSelected ? 1.25 * selectedZoomGrow : isHovered ? 1.15 : 1.0;
        const finalScale = baseScale * zoomScale;

        if (!markerObj.domRefs) {
          updateMarkerDomRefs(markerObj);
        }
        const domRefs = markerObj.domRefs!;
        const pinWrapper = domRefs.pinWrapper;
        const pin = domRefs.pin;
        const stem = domRefs.stem;
        const icon = domRefs.icon;

        if (flatEl) {
          flatEl.style.visibility = isVisible ? 'visible' : 'hidden';
          flatEl.style.pointerEvents = isVisible ? 'auto' : 'none';

          // Update flat container scale/opacity based on zoom
          const flatContainer = domRefs.flatContainer;
          if (flatContainer) {
            flatContainer.style.opacity = `${zoomOpacity}`;
            flatContainer.style.transform = `scale(${flatScale})`;
          }

          // Fetch shadow/puncture/ripple elements
          const shadowPin = domRefs.shadowPin;
          const shadowStem = domRefs.shadowStem;
          const puncture = domRefs.puncture;
          const ripples = domRefs.ripples;

          if (surface === 'water') {
            // Water layout
            if (puncture) puncture.style.display = 'none';
            if (shadowStem) shadowStem.style.display = 'none';
            if (ripples) {
              ripples.forEach((r) => (r.style.display = isVisible ? 'block' : 'none'));
            }

            if (shadowPin) {
              shadowPin.style.display = isVisible ? 'block' : 'none';
              // Faint, circular refracted shadow under water
              shadowPin.style.backgroundColor = 'rgba(17, 24, 39, 0.15)';
              shadowPin.style.filter = 'blur(2.5px)';
              shadowPin.style.transform = `translateY(0px) scale(${finalScale * 0.75})`;
              shadowPin.style.opacity = `${zoomOpacity}`;
            }

            if (pin) {
              if (isBoat) {
                pin.classList.remove('marker-bobbing');
                pin.classList.add('marker-boat-bobbing');
              } else {
                pin.classList.add('marker-bobbing');
                pin.classList.remove('marker-boat-bobbing');
              }
            }
            if (stem) {
              stem.style.height = '0px';
              stem.style.opacity = '0';
            }
          } else {
            // Land layout
            if (puncture) puncture.style.display = isVisible ? 'block' : 'none';
            if (shadowStem) {
              shadowStem.style.display = isVisible ? 'block' : 'none';
              shadowStem.style.opacity = isVisible ? `${(pitch / 60) * 0.55}` : '0';
              // Stretch the stem shadow backwards on the ground
              shadowStem.style.height = `${elevation * 0.8}px`;
            }
            if (ripples) {
              ripples.forEach((r) => (r.style.display = 'none'));
            }

            if (shadowPin) {
              shadowPin.style.display = isVisible ? 'block' : 'none';
              shadowPin.style.backgroundColor = 'rgba(0, 0, 0, 0.45)';
              shadowPin.style.filter = 'blur(1.5px)';
              // The flex layout pushes shadowPin upward, we just need scale
              shadowPin.style.transform = `scale(${finalScale})`;
              shadowPin.style.opacity = isVisible ? `${zoomOpacity * 0.9}` : '0';
            }

            if (pin) {
              pin.classList.remove('marker-bobbing');
            }

            // Standing metallic needle stretches to the center of the elevated pin
            if (stem) {
              if (pitch > 0 && isVisible) {
                // Height to reach center of elevated pin: elevation + 14 * finalScale
                stem.style.height = `${elevation + 14 * finalScale}px`;
                stem.style.opacity = `${(pitch / 60) * 0.95}`;
              } else {
                stem.style.height = '0px';
                stem.style.opacity = '0';
              }
            }
          }
        }

        // Apply wrapper translation/scaling
        if (pinWrapper) {
          pinWrapper.style.transform = `translateY(-${elevation}px) scale(${finalScale})`;
          pinWrapper.style.opacity = `${zoomOpacity}`;
        }

        // Apply translation to store modal container without scaling it
        let storeModal = domRefs.storeModal;
        if (!storeModal) {
          storeModal = pinEl.querySelector('.store-modal-container') as HTMLDivElement | null;
          if (storeModal) domRefs.storeModal = storeModal;
        }
        if (storeModal) {
          storeModal.style.transform = `translateY(-${elevation}px)`;
        }

        // Apply rotation, glow, and border styles to the inner pin
        if (pin) {
          pin.style.transform = rotateTransform;
          pin.style.opacity = `${zoomOpacity}`;

          // Professional Designer glow enhancement for interactive selection/hover
          const eventColor = markerObj.event
            ? getCategoryColor(markerObj.event.category, markerObj.event.musicStyle)
            : '#3B82F6';

          if (isSelected) {
            pin.classList.add('selected-pin-glow');
            pin.style.setProperty('--selected-glow-color', eventColor);
            pin.style.boxShadow = `0 0 24px ${hexToRgba(eventColor, 0.85)}, 0 8px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)`;
            pin.style.borderColor = eventColor;
            pin.style.borderWidth = '2.5px';
          } else {
            pin.classList.remove('selected-pin-glow');
            pin.style.boxShadow = isEmergencyState
              ? '0px 2px 4px rgba(0,0,0,0.5)'
              : '0px 6px 16px rgba(0,0,0,0.4)';
            pin.style.borderColor = isEmergencyState ? '#111827' : hexToRgba(eventColor, 0.6);
            pin.style.borderWidth = isEmergencyState ? '2px' : '1.5px';
          }
        }

        const notesContainer = domRefs.notesContainer;
        if (notesContainer) {
          notesContainer.style.display = (z >= 15 || isSelected) && isVisible ? 'block' : 'none';
        }

        if (icon) {
          icon.style.opacity = showIcon ? '1' : '0';
        }

        // Dynamically update smart badge (viñeta) expansion
        const badgeEl = domRefs.badgeEl;
        if (badgeEl) {
          const isWideLabel = badgeEl.dataset.wideLabel === 'true';
          const type = badgeEl.dataset.vinetaType || '';

          // Smart Badge Expansion Rules:
          // 1. If the pin is selected or hovered, ALWAYS expand.
          // 2. High zoom (z >= 16) auto-expands ALL badges for glanceability.
          // 3. Medium zoom (14.5 <= z < 16) auto-expands only high priority badges (en_vivo, oferta).
          // 4. Otherwise, keep it collapsed (icon only) to avoid clutter.
          const isHighPriority = type === 'en_vivo' || type === 'oferta';
          const shouldExpand = isSelected || isHovered || z >= 16 || (z >= 14.5 && isHighPriority);

          if (shouldExpand) {
            badgeEl.classList.add('vineta-expanded');
            badgeEl.style.width = isWideLabel ? 'auto' : '16px';
            badgeEl.style.padding = isWideLabel ? '0 6px' : '0';
            badgeEl.style.borderRadius = isWideLabel ? '10px' : '50%';
          } else {
            badgeEl.classList.remove('vineta-expanded');
            badgeEl.style.width = '16px';
            badgeEl.style.padding = '0';
            badgeEl.style.borderRadius = '50%';
          }
        }

        // Dynamically update contextual radial menu or store modal for the pin
        if (markerObj.event) {
          const loboSVG = domRefs.loboSVG;
          if (loboSVG) {
            loboSVG.setAttribute('fill', isSelected ? '#3B82F6' : '#2D3748');
          }

          const categoryLower = markerObj.event.category?.toLowerCase() || '';
          if (
            [
              'tienda',
              'fauna',
              'hospital',
              'universidad',
              'bombero',
              'carabinero',
              'camara',
            ].includes(categoryLower)
          ) {
            updateMapLibreStoreModal(
              pinEl,
              markerObj.event,
              isSelected,
              isHovered,
              mapLayer === 'light' || mapLayer === 'streets',
            );
          } else {
            updateMapLibreRadialMenu(
              pinEl,
              markerObj.event,
              isSelected && isVisible,
              isHovered && isVisible,
              onSelectEventRef.current,
              `maplibre-pin-${markerObj.event.id}`,
              onSaveLocationRef.current,
            );
          }
        }
      });
    };

    updateAestheticsRef.current = updateAesthetics;

    // Throttle via rAF to avoid redundant DOM mutations during rapid gestures
    let aestheticsRafId: number | null = null;
    const throttledUpdateAesthetics = () => {
      if (aestheticsRafId !== null) return;
      aestheticsRafId = requestAnimationFrame(() => {
        updateAesthetics();
        aestheticsRafId = null;
      });
    };

    // Bind map events for real-time 3D updates
    map.on('zoom', throttledUpdateAesthetics);
    map.on('pitch', throttledUpdateAesthetics);
    map.on('rotate', throttledUpdateAesthetics);
    map.on('move', throttledUpdateAesthetics);

    map.on('idle', () => {
      let updated = false;
      Object.keys(markersRef.current).forEach((id) => {
        const markerObj = markersRef.current[id];
        if (
          markerObj &&
          markerObj.event &&
          (!markerObj.pinEl.dataset.surface || markerObj.pinEl.dataset.surface === 'land')
        ) {
          const surface = detectSurfaceType(
            map,
            markerObj.event.longitude,
            markerObj.event.latitude,
          );
          // Only update if it actually changed or is newly detected
          if (markerObj.pinEl.dataset.surface !== surface) {
            markerObj.pinEl.dataset.surface = surface;
            if (markerObj.flatEl) {
              markerObj.flatEl.dataset.surface = surface;
            }
            updated = true;
          }
        }
      });
      if (updated && updateAestheticsRef.current) {
        updateAestheticsRef.current();
      }
    });

    map.on('styleimagemissing', (event) => {
      addMissingStyleImage(map, event.id, mapLayerRef.current);
    });

    map.on('zoomend', () => {
      if (onZoomChangeRef.current) {
        onZoomChangeRef.current(Math.round(map.getZoom()));
      }
    });

    map.on('dragstart', () => {
      isDraggingRef.current = true;
      if (onMapMoveRef.current) {
        onMapMoveRef.current();
      }
    });

    map.on('dragend', () => {
      // Pequeño delay para que el mouseleave no se dispare antes de que el drag haya terminado
      setTimeout(() => {
        isDraggingRef.current = false;
        // After drag ends, close any tooltips whose markers are no longer under the cursor.
        // This handles the case where mouseleave fired during drag and was deferred.
        Object.values(markersRef.current).forEach((markerObj: any) => {
          if (!markerObj || !markerObj.pinEl) return;
          const pinEl = markerObj.pinEl as HTMLDivElement;
          // If not currently under mouse (dataset.hovered stays true but mouse moved away),
          // force-close it now.
          if (pinEl.dataset.hovered === 'true' && !pinEl.matches(':hover')) {
            if (markerObj.closeTimeout) {
              clearTimeout(markerObj.closeTimeout);
              delete markerObj.closeTimeout;
            }
            pinEl.dataset.hovered = 'false';
            if (pinEl.dataset.localSelected === 'true') {
              pinEl.dataset.localSelected = 'false';
              if (selectedEventRef.current?.id === markerObj.event?.id) {
                selectedEventRef.current = null;
                if (syncEventPolygonsRef.current) syncEventPolygonsRef.current();
              }
            }
          }
        });
        if (updateAestheticsRef.current) updateAestheticsRef.current();
      }, 150);
    });

    // Helper to close hover-triggered tooltips (used by movestart, rotatestart, pitchstart)
    const closeHoverTooltips = () => {
      let needsUpdate = false;
      Object.values(markersRef.current).forEach((markerObj: any) => {
        if (!markerObj || !markerObj.pinEl) return;
        const pinEl = markerObj.pinEl as HTMLDivElement;
        // Only close hover-triggered tooltips — leave click-selected ones open
        if (pinEl.dataset.hovered === 'true' && pinEl.dataset.localSelected !== 'true') {
          if (markerObj.closeTimeout) {
            clearTimeout(markerObj.closeTimeout);
            delete markerObj.closeTimeout;
          }
          pinEl.dataset.hovered = 'false';
          needsUpdate = true;
        }
      });
      if (needsUpdate && updateAestheticsRef.current) updateAestheticsRef.current();
    };

    // When the map starts moving (pan, programmatic fly, etc.), force-close any
    // hover-only tooltips that are not click-selected. This prevents tooltips from
    // appearing "glued" to a fixed screen position as the map pans beneath them.
    map.on('movestart', closeHoverTooltips);

    // Close tooltips when user starts rotating map
    map.on('rotatestart', closeHoverTooltips);

    // Close tooltips when user starts changing pitch (3D tilt)
    map.on('pitchstart', closeHoverTooltips);

    map.on('zoomstart', () => {
      if (onMapMoveRef.current) {
        onMapMoveRef.current();
      }
    });

    map.on('style.load', () => {
      if (mapLayerRef.current === 'dark') {
        applyDarkTheme(map);
      }
      if (syncUserLocationRef.current) {
        syncUserLocationRef.current();
      }
      if (syncTrafficRef.current) {
        syncTrafficRef.current();
      }
      if (syncWeatherRef.current) {
        syncWeatherRef.current();
      }
      if (syncZonesRef.current) {
        syncZonesRef.current();
      }
      if (syncCyclewaysRef.current) {
        syncCyclewaysRef.current();
      }

      // Re-add cluster source+layers after style change
      if (!map.getSource('clusters-source')) {
        map.addSource('clusters-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'cluster-circles',
          type: 'circle',
          source: 'clusters-source',
          paint: {
            'circle-color': '#0B0F19',
            'circle-radius': ['get', 'radius'],
            'circle-stroke-width': 3,
            'circle-stroke-color': ['get', 'color'],
            'circle-pitch-alignment': 'map',
            'circle-opacity': 1,
            'circle-stroke-opacity': 1,
          },
        });
        map.addLayer({
          id: 'cluster-labels',
          type: 'symbol',
          source: 'clusters-source',
          layout: {
            'text-field': ['get', 'count'],
            'text-size': ['get', 'fontSize'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-pitch-alignment': 'map',
            'text-rotation-alignment': 'map',
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.6)',
            'text-halo-width': 1,
          },
        });
      }
      // Immediately sync cluster data after style reload
      if (syncClustersRef.current) {
        syncClustersRef.current();
      }
    });

    const syncZones = async () => {
      const map = mapRef.current;
      if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

      try {
        let zones = sectorsDataRef.current;
        if (!zones || zones.length === 0) {
          const baseUrl =
            process.env.EXPO_PUBLIC_BACKEND_URL ||
            process.env.EXPO_PUBLIC_API_URL ||
            'http://localhost:8080';
          const response = await fetch(`${baseUrl}/api/v1/zones`);
          if (!response.ok) throw new Error('Error al cargar zonas');
          zones = await response.json();
        }

        if (!map.hasImage('reserva-pattern')) {
          const isDark = mapLayerRef.current === 'dark';
          const rLine = isDark ? 'rgba(52,211,153,0.2)' : 'rgba(5,150,105,0.2)';
          const rFill = isDark ? 'rgba(16,185,129,0.3)' : 'rgba(6,78,59,0.3)';
          const svgStringReserva = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <line x1="-10" y1="50" x2="50" y2="-10" stroke="${rLine}" stroke-width="1.5"/>
            <line x1="-10" y1="30" x2="30" y2="-10" stroke="${rLine}" stroke-width="1.5"/>
            <line x1="10" y1="50" x2="50" y2="10" stroke="${rLine}" stroke-width="1.5"/>
            <path d="M 15 15 C 10 10, 20 5, 20 15 C 25 20, 15 25, 15 15" fill="${rFill}"/>
            <path d="M 30 30 C 25 25, 35 20, 35 30 C 40 35, 30 40, 30 30" fill="${rFill}"/>
          </svg>`;
          const imgReserva = new Image(40, 40);
          imgReserva.src =
            'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStringReserva);
          imgReserva.onload = () => {
            if (
              mapRef.current &&
              typeof mapRef.current.hasImage === 'function' &&
              !mapRef.current.hasImage('reserva-pattern')
            ) {
              mapRef.current.addImage('reserva-pattern', imgReserva);
              if (syncZonesRef.current) syncZonesRef.current();
            }
          };
        }

        const currentVisibleIds = visibleSectorIdsRef.current;
        const activeZones = currentVisibleIds
          ? (Array.isArray(zones) ? zones : []).filter((z: any) => currentVisibleIds.includes(z.id))
          : Array.isArray(zones)
            ? zones
            : [];

        // Ordenar las zonas para que 'edificio' se renderice al final (encima de 'ciudad' y 'reserva')
        const sortedZones = [...(Array.isArray(activeZones) ? activeZones : [])].sort((a, b) => {
          const getPriority = (cat: string) => {
            if (cat === 'edificio') return 3;
            if (cat === 'reserva') return 2;
            return 1;
          };
          return getPriority(a.category || 'ciudad') - getPriority(b.category || 'ciudad');
        });

        // Convertir array de zonas a un FeatureCollection de GeoJSON
        const featureCollection = {
          type: 'FeatureCollection',
          features: sortedZones.map((z: any) => ({
            type: 'Feature',
            properties: {
              id: z.id,
              name: z.name,
              color: z.color || '#10B981',
              category: z.category || 'ciudad',
            },
            geometry: typeof z.geojson === 'string' ? JSON.parse(z.geojson) : z.geojson,
          })),
        };

        if (map.getSource('zones-source')) {
          (map.getSource('zones-source') as maplibregl.GeoJSONSource).setData(
            featureCollection as any,
          );
        } else {
          map.addSource('zones-source', {
            type: 'geojson',
            data: featureCollection as any,
          });

          const beforeId = getBeforeRoadsOrLabelsLayerId(map);

          // Capa de Relleno (Fill) diferenciada por tipo
          map.addLayer(
            {
              id: 'zones-fill',
              type: 'fill',
              source: 'zones-source',
              layout: {
                visibility: showSectorsRef.current ? 'visible' : 'none',
              },
              paint: {
                'fill-color': ['get', 'color'],
                'fill-opacity': [
                  'step',
                  ['zoom'],
                  ['match', ['get', 'category'], 'edificio', 0, 'reserva', 0, 0.08],
                  11.5,
                  ['match', ['get', 'category'], 'edificio', 0, 'reserva', 0, 0.08],
                  14,
                  ['match', ['get', 'category'], 'edificio', 0.35, 'reserva', 0, 0.08],
                ],
              },
            },
            beforeId,
          );

          // Capa de patrón específico para reservas
          map.addLayer(
            {
              id: 'zones-reserva-pattern',
              type: 'fill',
              source: 'zones-source',
              filter: ['==', ['get', 'category'], 'reserva'],
              layout: {
                visibility: showSectorsRef.current ? 'visible' : 'none',
              },
              paint: {
                'fill-pattern': 'reserva-pattern',
                'fill-opacity': 0.8,
              },
            },
            beforeId,
          );

          // Capa de Borde diferenciada por tipo
          map.addLayer(
            {
              id: 'zones-outline',
              type: 'line',
              source: 'zones-source',
              layout: {
                visibility: showSectorsRef.current ? 'visible' : 'none',
              },
              paint: {
                'line-color': ['get', 'color'],
                'line-width': [
                  'match',
                  ['get', 'category'],
                  'edificio',
                  3,
                  'reserva',
                  2,
                  1.5, // Ciudad
                ],
                'line-blur': 1,
                'line-opacity': [
                  'step',
                  ['zoom'],
                  ['match', ['get', 'category'], 'edificio', 0, 'reserva', 0, 0.4],
                  11.5,
                  ['match', ['get', 'category'], 'edificio', 0, 'reserva', 0, 0.4],
                  11.5,
                  ['match', ['get', 'category'], 'edificio', 0, 'reserva', 0, 0.4],
                  14,
                  ['match', ['get', 'category'], 'edificio', 0.9, 'reserva', 0, 0.4],
                ],
                'line-dasharray': [
                  'match',
                  ['get', 'category'],
                  'reserva',
                  ['literal', [4, 4]], // dashed para reservas
                  'ciudad',
                  ['literal', [2, 4]], // dotted/dashed espaciado para ciudad
                  ['literal', [1]], // solid para edificio
                ],
              },
            },
            beforeId,
          );
        }
      } catch (error: any) {
        if (error && error.message && error.message.includes('Style is not done loading')) {
          // Ignorar silenciosamente: el estilo se está cargando y se reintentará en el evento style.load
          return;
        }
        console.error('Error sincronizando zonas:', error);
      } finally {
        if (map.getLayer('cluster-circles')) map.moveLayer('cluster-circles');
        if (map.getLayer('cluster-labels')) map.moveLayer('cluster-labels');
      }
    };
    syncZonesRef.current = syncZones;

    // Click on Sector
    map.on('click', 'zones-fill', (e) => {
      if ((e.originalEvent as any)._turismoHandled) return;
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
      if (!e.features?.length) return;
      (e.originalEvent as any)._turismoHandled = true;
      const featureId = e.features[0].properties?.id;
      if (featureId && onSelectEventRef.current) {
        const event = eventsRef.current.find((ev) => ev.id === featureId);
        if (event) {
          const categoryLower = event.category?.toLowerCase() || '';
          if (
            ['hospital', 'universidad', 'bombero', 'carabinero', 'camara', 'fauna'].includes(
              categoryLower,
            )
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

    // Deselect when clicking on empty map (or intercept for magic wand)
    map.on('click', (e) => {
      if ((e.originalEvent as any)._turismoHandled) return;

      if (isMagicWandActiveRef.current && onMagicWandSelectRef.current) {
        // Find building features under the click
        const features = map.queryRenderedFeatures(e.point, {
          layers: map
            .getStyle()
            .layers.filter(
              (l: any) => l.id.includes('building') || l['source-layer']?.includes('building'),
            )
            .map((l: any) => l.id),
        });

        if (features && features.length > 0) {
          onMagicWandSelectRef.current(features[0].geometry);
          return;
        }
      }

      onSelectEventRef.current(null);

      // Punto 1: cerrar todos los minimodales locales al hacer clic en el mapa vacío
      Object.values(markersRef.current).forEach((markerObj: any) => {
        if (markerObj.pinEl && markerObj.pinEl.dataset.localSelected === 'true') {
          markerObj.pinEl.dataset.localSelected = 'false';
          markerObj.pinEl.dataset.hovered = 'false';
          if (markerObj.closeTimeout) {
            clearTimeout(markerObj.closeTimeout);
            delete markerObj.closeTimeout;
          }
        }
      });
      if (selectedEventRef.current) {
        selectedEventRef.current = null;
        if (syncEventPolygonsRef.current) syncEventPolygonsRef.current();
      }
      if (updateAestheticsRef.current) updateAestheticsRef.current();

      if (onMapPinchoRef.current) {
        onMapPinchoRef.current({
          latitude: e.lngLat.lat,
          longitude: e.lngLat.lng,
          x: e.point.x,
          y: e.point.y,
          surface: detectSurfaceType(map, e.lngLat.lng, e.lngLat.lat),
        });
      }
    });

    return () => {
      // Cleanup all markers
      Object.values(markersRef.current).forEach(({ pinMarker, flatMarker }) => {
        pinMarker.remove();
        if (flatMarker) flatMarker.remove();
      });
      markersRef.current = {};

      if (userMarkerRef.current) {
        userMarkerRef.current.marker.remove();
        userMarkerRef.current = null;
      }

      // Disconnect ResizeObserver
      resizeObserver.disconnect();

      if (map) {
        map.off('zoom', throttledUpdateAesthetics);
        map.off('pitch', throttledUpdateAesthetics);
        map.off('rotate', throttledUpdateAesthetics);
        map.off('move', throttledUpdateAesthetics);
        if (aestheticsRafId !== null) cancelAnimationFrame(aestheticsRafId);
        if (boundsTimer) clearTimeout(boundsTimer);
        map.remove();
      }
      mapRef.current = null;
    };
  }, []);

  // Ejecutar sincronización de zonas cuando cambien los datos externos o IDs visibles
  useEffect(() => {
    if (syncZonesRef.current) {
      syncZonesRef.current();
    }
  }, [sectorsData, visibleSectorIds]);

  // Sync Markers and Data
  const clusteredItems = useSuperclusterEvents(events, zoom, currentBounds);

  const syncEventPolygons = () => {
    const map = mapRef.current;
    if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

    if (!map.hasImage('humedal-pattern')) {
      const isDark = mapLayerRef.current === 'dark';
      const hWater = isDark ? 'rgba(59,130,246,0.3)' : 'rgba(37,99,235,0.4)';
      const hReed = isDark ? 'rgba(52,211,153,0.4)' : 'rgba(5,150,105,0.5)';
      const svgString = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 32 Q 10 29 15 32 T 25 32" stroke="${hWater}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M18 36 Q 23 33 28 36 T 38 36" stroke="${hWater}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M15 32 Q 13 20 8 15" stroke="${hReed}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M15 32 L 15 10" stroke="${hReed}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M15 32 Q 17 20 22 15" stroke="${hReed}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <rect x="13.5" y="12" width="3" height="8" rx="1.5" fill="${hReed}" />
      </svg>`;
      const img = new Image(40, 40);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      img.onload = () => {
        if (
          mapRef.current &&
          typeof mapRef.current.hasImage === 'function' &&
          !mapRef.current.hasImage('humedal-pattern')
        ) {
          mapRef.current.addImage('humedal-pattern', img);
          syncEventPolygons();
        }
      };
    }

    if (!map.hasImage('parque-pattern')) {
      const isDark = mapLayerRef.current === 'dark';
      const pTree = isDark ? 'rgba(52,211,153,0.3)' : 'rgba(16,185,129,0.4)';
      const pTrunk = isDark ? 'rgba(16,185,129,0.4)' : 'rgba(6,78,59,0.5)';
      const svgStringParque = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M 10 15 L 15 25 L 5 25 Z" fill="${pTree}"/>
        <rect x="9" y="25" width="2" height="4" fill="${pTrunk}"/>
        <path d="M 30 5 L 34 13 L 26 13 Z" fill="${pTree}"/>
        <rect x="29.5" y="13" width="1" height="3" fill="${pTrunk}"/>
        <path d="M 22 28 L 26 36 L 18 36 Z" fill="${pTree}"/>
        <rect x="21.5" y="36" width="1.5" height="3" fill="${pTrunk}"/>
      </svg>`;
      const imgParque = new Image(40, 40);
      imgParque.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStringParque);
      imgParque.onload = () => {
        if (
          mapRef.current &&
          typeof mapRef.current.hasImage === 'function' &&
          !mapRef.current.hasImage('parque-pattern')
        ) {
          mapRef.current.addImage('parque-pattern', imgParque);
          syncEventPolygons();
        }
      };
    }

    if (!map.hasImage('agua-pattern')) {
      const isDark = mapLayerRef.current === 'dark';
      const aWave = isDark ? 'rgba(96,165,250,0.4)' : 'rgba(37,99,235,0.4)';
      const svgStringAgua = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0 10 Q 10 5, 20 10 T 40 10" stroke="${aWave}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M -10 20 Q 0 15, 10 20 T 30 20 T 50 20" stroke="${aWave}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M 0 30 Q 10 35, 20 30 T 40 30" stroke="${aWave}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;
      const imgAgua = new Image(40, 40);
      imgAgua.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStringAgua);
      imgAgua.onload = () => {
        if (
          mapRef.current &&
          typeof mapRef.current.hasImage === 'function' &&
          !mapRef.current.hasImage('agua-pattern')
        ) {
          mapRef.current.addImage('agua-pattern', imgAgua);
          syncEventPolygons();
        }
      };
    }

    const polyEvents = events.filter((e) => e.polygon && e.polygon.length > 0);
    const featureCollection = {
      type: 'FeatureCollection',
      features: polyEvents.map((e) => ({
        type: 'Feature',
        properties: {
          id: e.id,
          category: e.category,
          color: getCategoryColor(e.category, e.musicStyle),
        },
        geometry: {
          type: 'Polygon',
          coordinates: [e.polygon!.map((c) => [c.longitude, c.latitude])],
        },
      })),
    };

    if (map.getSource('event-polygons-source')) {
      (map.getSource('event-polygons-source') as maplibregl.GeoJSONSource).setData(
        featureCollection as any,
      );
      if (map.getLayer('event-polygons-fill')) {
        map.setPaintProperty('event-polygons-fill', 'fill-opacity', [
          'match',
          ['get', 'category'],
          ['agua', 'humedal', 'parque', 'naturaleza'],
          0,
          ['case', ['==', ['get', 'id'], selectedEventRef.current?.id ?? ''], 0.35, 0],
        ]);
        map.setPaintProperty('event-polygons-outline', 'line-opacity', [
          'match',
          ['get', 'category'],
          ['agua', 'humedal', 'parque', 'naturaleza'],
          0,
          ['case', ['==', ['get', 'id'], selectedEventRef.current?.id ?? ''], 0.8, 0],
        ]);
      }
    } else {
      map.addSource('event-polygons-source', { type: 'geojson', data: featureCollection as any });

      const beforeId = getBeforeRoadsOrLabelsLayerId(map);

      // Capa base de relleno
      map.addLayer(
        {
          id: 'event-polygons-fill',
          type: 'fill',
          source: 'event-polygons-source',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'match',
              ['get', 'category'],
              ['agua', 'humedal', 'parque', 'naturaleza'],
              0,
              ['case', ['==', ['get', 'id'], selectedEventRef.current?.id ?? ''], 0.35, 0.01],
            ],
          },
        },
        beforeId,
      );

      // Capa específica de patrón para humedales
      map.addLayer(
        {
          id: 'event-polygons-humedal-pattern',
          type: 'fill',
          source: 'event-polygons-source',
          filter: ['==', ['get', 'category'], 'humedal'],
          paint: {
            'fill-pattern': 'humedal-pattern',
            'fill-opacity': 0.8,
          },
        },
        beforeId,
      );

      // Capa específica de patrón para parques
      map.addLayer(
        {
          id: 'event-polygons-parque-pattern',
          type: 'fill',
          source: 'event-polygons-source',
          filter: ['in', ['get', 'category'], ['literal', ['parque', 'naturaleza']]],
          paint: {
            'fill-pattern': 'parque-pattern',
            'fill-opacity': 0.8,
          },
        },
        beforeId,
      );

      // Capa específica de patrón para agua
      map.addLayer(
        {
          id: 'event-polygons-agua-pattern',
          type: 'fill',
          source: 'event-polygons-source',
          filter: ['==', ['get', 'category'], 'agua'],
          paint: {
            'fill-pattern': 'agua-pattern',
            'fill-opacity': 0.8,
          },
        },
        beforeId,
      );

      // Borde exterior
      map.addLayer(
        {
          id: 'event-polygons-outline',
          type: 'line',
          source: 'event-polygons-source',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': [
              'match',
              ['get', 'category'],
              ['agua', 'humedal'],
              0.8,
              ['case', ['==', ['get', 'id'], selectedEventRef.current?.id ?? ''], 0.8, 0],
            ],
          },
        },
        beforeId,
      );
    }
  };

  syncEventPolygonsRef.current = syncEventPolygons;

  const sync = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    syncEventPolygons();

    // Filter out clusters — they are now rendered as native MapLibre layers
    const nonClusterItems = clusteredItems.filter(
      (item) => !('isCluster' in item && item.isCluster),
    );
    const clusterItems = clusteredItems.filter(
      (item) => 'isCluster' in item && item.isCluster,
    ) as Cluster[];

    // ── Update native cluster layers ──
    const clusterFeatures = clusterItems.map((cluster) => {
      const count = cluster.events.length;
      const dominantColor = getClusterDominantColor(cluster.events);
      const badgeRadius = Math.min(22, Math.max(16, 16 + Math.log2(count) * 2));
      const fontSize = badgeRadius < 18 ? 12 : badgeRadius < 20 ? 13 : 14;

      // Compute true centroid for click zoom target
      let cLat = 0,
        cLng = 0;
      for (const ev of cluster.events) {
        cLat += ev.latitude;
        cLng += ev.longitude;
      }
      cLat /= cluster.events.length;
      cLng /= cluster.events.length;

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [cluster.longitude, cluster.latitude],
        },
        properties: {
          id: cluster.id,
          count: String(count),
          color: dominantColor,
          radius: badgeRadius,
          fontSize,
          centroidLng: cLng,
          centroidLat: cLat,
        },
      };
    });

    if (map.getSource('clusters-source')) {
      (map.getSource('clusters-source') as any).setData({
        type: 'FeatureCollection',
        features: clusterFeatures,
      });
    }

    // Store syncClusters for style.load re-sync
    syncClustersRef.current = () => {
      if (map.getSource('clusters-source')) {
        (map.getSource('clusters-source') as any).setData({
          type: 'FeatureCollection',
          features: clusterFeatures,
        });
      }
    };

    const newMarkerIds = new Set(nonClusterItems.map((e) => e.id));

    // Remove old markers (only non-cluster)
    Object.keys(markersRef.current).forEach((id) => {
      if (!newMarkerIds.has(id)) {
        const markerObj = markersRef.current[id];
        markerObj.pinMarker.remove();
        if (markerObj.flatMarker) markerObj.flatMarker.remove();
        // Clean up registry subscription if any
        if ((markerObj as any).unsubRegistry) (markerObj as any).unsubRegistry();
        delete markersRef.current[id];
      }
    });

    // Add or update markers
    // Add or update non-cluster markers only (clusters are handled via native layers above)
    nonClusterItems.forEach((item) => {
      const event = item as TurismoEvent;
      const isSelected = selectedEvent?.id === event.id;
      const color = getCategoryColor(event.category, event.musicStyle);
      const iconName = getCategoryIcon(event.category, event.musicStyle);
      const isEmergencyState = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
        event.category,
      );

      let markerObj = markersRef.current[event.id];

      if (!markerObj) {
        // 1. Create flat DOM element for shadow & waves
        const flatEl = document.createElement('div');
        flatEl.style.pointerEvents = 'none';
        flatEl.style.display = 'flex';
        flatEl.style.alignItems = 'center';
        flatEl.style.justifyContent = 'center';

        const rotationAlignment = event.category === 'embarcacion' ? 'map' : 'viewport';

        const flatMarker = new maplibregl.Marker({
          element: flatEl,
          pitchAlignment: 'map',
          rotationAlignment,
          anchor: 'center',
        })
          .setLngLat([event.longitude, event.latitude])
          .addTo(map);

        // 2. Create interactive vertical DOM element for pin
        const pinEl = document.createElement('div');
        pinEl.id = `maplibre-pin-${event.id}`;
        pinEl.style.cursor = 'pointer';
        pinEl.style.display = 'flex';
        pinEl.style.alignItems = 'center';
        pinEl.style.justifyContent = 'center';

        const catLower = event.category?.toLowerCase() || '';
        if (catLower === 'fauna') {
          pinEl.style.width = '48px';
          pinEl.style.height = '48px';
        } else if (
          ['camara', 'hospital', 'universidad', 'bombero', 'carabinero'].includes(catLower)
        ) {
          pinEl.style.width = '40px';
          pinEl.style.height = '40px';
        } else if (catLower === 'embarcacion') {
          let w = 24;
          if (event.boatSize === 'grande') w = 32;
          else if (event.boatSize === 'mediana') w = 28;
          pinEl.style.width = `${w}px`;
          pinEl.style.height = `${w}px`;
        } else if (['parque', 'reserva', 'reservas', 'naturaleza'].includes(catLower)) {
          pinEl.style.width = '0px';
          pinEl.style.height = '0px';
        } else {
          pinEl.style.width = '28px';
          pinEl.style.height = '28px';
        }

        pinEl.dataset.hovered = 'false';
        pinEl.dataset.category = event.category;

        pinEl.addEventListener('mouseenter', () => {
          // Immediately force-close any other hovered/tooltip markers to prevent multiple mini-modals
          Object.values(markersRef.current).forEach((otherObj: any) => {
            if (otherObj.event?.id !== event.id && otherObj.pinEl) {
              if (otherObj.closeTimeout) {
                clearTimeout(otherObj.closeTimeout);
                delete otherObj.closeTimeout;
              }
              // Force hovered off and immediately close their store modal
              if (otherObj.pinEl.dataset.hovered === 'true') {
                otherObj.pinEl.dataset.hovered = 'false';
              }
            }
          });
          // Trigger aesthetics update so previously hovered tooltips are removed from DOM immediately
          if (updateAestheticsRef.current) updateAestheticsRef.current();

          const markerObj = markersRef.current[event.id];
          if (markerObj && markerObj.closeTimeout) {
            clearTimeout(markerObj.closeTimeout);
            delete markerObj.closeTimeout;
          }
          pinEl.dataset.hovered = 'true';

          if (updateAestheticsRef.current) updateAestheticsRef.current();
        });

        pinEl.addEventListener('mouseleave', () => {
          const markerObj = markersRef.current[event.id];
          if (!markerObj) return;

          if (markerObj.closeTimeout) clearTimeout(markerObj.closeTimeout);

          // During drag, schedule closure to fire after drag ends instead of skipping entirely.
          // This prevents tooltips from getting permanently stuck when the user drags the map
          // while the cursor is over a marker.
          const delayMs = isDraggingRef.current ? 1200 : 800;

          markerObj.closeTimeout = setTimeout(() => {
            // If this timeout fires, the mouse has not re-entered the pin
            // (mouseenter would have cancelled it). Safe to close unconditionally.
            pinEl.dataset.hovered = 'false';

            // Si el pin tenía estado local seleccionado, lo limpiamos al quitar el mouse
            if (pinEl.dataset.localSelected === 'true') {
              pinEl.dataset.localSelected = 'false';
              if (selectedEventRef.current?.id === event.id) {
                selectedEventRef.current = null;
                if (syncEventPolygonsRef.current) syncEventPolygonsRef.current();
              }
            }

            if (updateAestheticsRef.current) updateAestheticsRef.current();
            delete markerObj.closeTimeout;
          }, delayMs);
        });

        pinEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const categoryLower = event.category?.toLowerCase() || '';
          if (categoryLower === 'fauna') {
            const isLocal = pinEl.dataset.localSelected === 'true';
            pinEl.dataset.localSelected = isLocal ? 'false' : 'true';
            if (updateAestheticsRef.current) updateAestheticsRef.current();
            return;
          }
          if (
            ['hospital', 'universidad', 'bombero', 'carabinero', 'camara'].includes(categoryLower)
          ) {
            const isLocal = pinEl.dataset.localSelected === 'true';
            const nextLocal = !isLocal;
            // Clear any other local minimodal that may be locally selected
            if (nextLocal) {
              Object.values(markersRef.current).forEach((m) => {
                if (
                  ['hospital', 'universidad', 'bombero', 'carabinero', 'camara'].includes(
                    m.event?.category?.toLowerCase() || '',
                  ) &&
                  m.pinEl !== pinEl
                ) {
                  m.pinEl.dataset.localSelected = 'false';
                }
              });
            }
            pinEl.dataset.localSelected = nextLocal ? 'true' : 'false';
            // Update selectedEventRef so syncEventPolygons can show/hide the building area
            selectedEventRef.current = nextLocal ? event : null;
            if (updateAestheticsRef.current) updateAestheticsRef.current();
            if (syncEventPolygonsRef.current) syncEventPolygonsRef.current();
            return;
          }
          onSelectEventRef.current(event);
        });

        const isBoat = event.category === 'embarcacion';
        const pinMarker = new maplibregl.Marker({
          element: pinEl,
          pitchAlignment: isBoat ? 'map' : 'viewport',
          rotationAlignment: isBoat ? 'map' : 'viewport',
          anchor: isBoat ? 'center' : 'bottom',
        })
          .setLngLat([event.longitude, event.latitude])
          .addTo(map);

        markersRef.current[event.id] = {
          pinMarker,
          pinEl,
          flatMarker,
          flatEl,
          event,
        };
        markerObj = markersRef.current[event.id];
        updateMarkerDomRefs(markerObj);

        // Subscribe to registry: close this menu if another one opens
        const menuId = `maplibre-pin-${event.id}`;
        const unsubRegistry = radialMenuRegistry.subscribe((openId) => {
          if (openId !== menuId && openId !== null) {
            // Another menu opened — force-close this one
            const obj = markersRef.current[event.id];
            if (obj && obj.closeTimeout) {
              clearTimeout(obj.closeTimeout);
              delete obj.closeTimeout;
            }
            if (pinEl.dataset.hovered === 'true') {
              pinEl.dataset.hovered = 'false';
              if (updateAestheticsRef.current) {
                requestAnimationFrame(() => {
                  if (updateAestheticsRef.current) updateAestheticsRef.current();
                });
              }
            }
          }
        });
        // Store unsub for cleanup (attach to the markerObj for later)
        (markersRef.current[event.id] as any).unsubRegistry = unsubRegistry;

        // Detect and assign surface type
        let initialSurface: 'land' | 'water' = 'land';
        if (event.category === 'embarcacion') {
          initialSurface = 'water';
        } else if (map.isStyleLoaded()) {
          initialSurface = detectSurfaceType(map, event.longitude, event.latitude);
        }
        pinEl.dataset.surface = initialSurface;
        if (flatEl) {
          flatEl.dataset.surface = initialSurface;
        }

        // Render vanilla DOM contents once during creation
        if (event.category === 'embarcacion') {
          renderBoatFlatMarker(flatEl, event);
          renderBoatMarker(pinEl, event, isSelected);
        } else if (event.category?.toLowerCase() === 'fauna') {
          renderLoboMarinoMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'hospital') {
          renderHospitalMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'universidad') {
          renderUniversityMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'bombero') {
          renderBomberoMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'carabinero') {
          renderCarabineroMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'camara') {
          renderCamaraMarker(pinEl, event, isSelected, mapLayer);
        } else {
          renderFlatMarker(flatEl, event, color, isEmergencyState);
          renderPinMarker(pinEl, event, color, iconName, isEmergencyState, isSelected);
        }
      } else {
        // Update position if it changed
        markerObj.pinMarker.setLngLat([event.longitude, event.latitude]);
        if (markerObj.flatMarker) {
          markerObj.flatMarker.setLngLat([event.longitude, event.latitude]);
        }
        // Force re-render of custom markers to adapt to the map style layer
        let didReRender = false;
        if (event.category?.toLowerCase() === 'fauna') {
          renderLoboMarinoMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'hospital') {
          renderHospitalMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'universidad') {
          renderUniversityMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'bombero') {
          renderBomberoMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'carabinero') {
          renderCarabineroMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'camara') {
          renderCamaraMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        }
        if (didReRender) {
          updateMarkerDomRefs(markerObj);
        }
      }

      // Update Marker z-index to bring selected to front
      if (markerObj.pinEl) {
        const isHovered = markerObj.pinEl.dataset.hovered === 'true';
        const isSel = isSelected || isHovered;
        markerObj.pinEl.style.zIndex = isSel ? '9999' : '10';
        if (isSel && markerObj.pinEl.parentElement) {
          markerObj.pinEl.parentElement.appendChild(markerObj.pinEl);
        }
      }
      if (markerObj.flatEl) {
        markerObj.flatEl.style.zIndex = isSelected ? '999' : '0';
      }
    });

    // Handle Map Pincho (Persistent Tool Pin)
    if (mapPincho) {
      if (!pinMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'pincho-marker';
        Object.assign(el.style, {
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#10B981',
          border: '2px solid #FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: '1500',
        });

        // Add the push-pin icon
        const svg = createSvgIcon('push-pin', 18, '#FFFFFF');
        if (svg) {
          el.appendChild(svg);
        }

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([mapPincho.longitude, mapPincho.latitude])
          .addTo(map);

        pinMarkerRef.current = { marker, el };
      } else {
        pinMarkerRef.current.marker.setLngLat([mapPincho.longitude, mapPincho.latitude]);
      }
    } else if (pinMarkerRef.current) {
      pinMarkerRef.current.marker.remove();
      pinMarkerRef.current = null;
    }

    if (map.getLayer('cluster-circles')) map.moveLayer('cluster-circles');
    if (map.getLayer('cluster-labels')) map.moveLayer('cluster-labels');

    // Apply immediate 3D and Zoom styling to all markers
    if (updateAestheticsRef.current) {
      updateAestheticsRef.current();
    }
  }, [clusteredItems, selectedEvent, zoom, mapPincho, mapLayer]);

  // Update tactical location pixel coordinates when map moves, so HUD stays glued to the pincho
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapPincho || !tacticalMode) return;

    const updatePosition = () => {
      const point = map.project([mapPincho.longitude, mapPincho.latitude]);
      if (onTacticalLocationChange) {
        onTacticalLocationChange({
          latitude: mapPincho.latitude,
          longitude: mapPincho.longitude,
          x: point.x,
          y: point.y,
          surface: mapPincho.surface,
        });
      }
    };

    map.on('move', updatePosition);
    // Execute once to set initial position
    updatePosition();

    return () => {
      map.off('move', updatePosition);
    };
  }, [mapPincho, tacticalMode, onTacticalLocationChange]);

  // High-Frequency Imperative User Location Marker updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleHighFreqLocation = (e: Event) => {
      const customEvent = e as CustomEvent;
      const loc = customEvent.detail;
      if (!loc) return;

      latestUserLocationRef.current = loc;

      // 1. Accuracy circle layer handling (only if map style is loaded)
      if (map.isStyleLoaded() && loc.accuracy) {
        const accuracyMeters = Math.max(1, loc.accuracy);
        userAccuracyRef.current = { accuracyMeters, latitude: loc.latitude };
        const radius = getAccuracyRadiusAtZoom(accuracyMeters, loc.latitude, map.getZoom());
        const accuracyData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [loc.longitude, loc.latitude],
              },
              properties: {},
            },
          ],
        };

        if (!map.getSource('user-accuracy')) {
          map.addSource('user-accuracy', {
            type: 'geojson',
            data: accuracyData,
          });
          map.addLayer({
            id: 'user-accuracy-layer',
            type: 'circle',
            source: 'user-accuracy',
            paint: {
              'circle-radius': radius,
              'circle-color': '#3B82F6',
              'circle-opacity': 0.15,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#3B82F6',
            },
          });
        } else {
          const source = map.getSource('user-accuracy') as maplibregl.GeoJSONSource;
          if (source.setData) {
            source.setData(accuracyData);
          }
          if (map.getLayer('user-accuracy-layer')) {
            map.setPaintProperty('user-accuracy-layer', 'circle-radius', radius);
          }
        }
      } else if (!loc.accuracy || !map.isStyleLoaded()) {
        userAccuracyRef.current = null;
        if (map.isStyleLoaded()) {
          if (map.getLayer('user-accuracy-layer')) map.removeLayer('user-accuracy-layer');
          if (map.getSource('user-accuracy')) map.removeSource('user-accuracy');
        }
      }

      // 2. DOM marker rendering
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'user-marker';

        const coneEl = document.createElement('div');
        coneEl.className = 'user-cone';
        el.appendChild(coneEl);

        const styleId = 'user-marker-styles';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.innerHTML = `
            .user-marker {
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background-color: #3B82F6;
              border: 3px solid #FFFFFF;
              box-shadow: 0 0 10px rgba(0,0,0,0.3);
              position: relative;
              z-index: 2000;
            }
            .user-marker::after {
              content: '';
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 48px;
              height: 48px;
              background-color: rgba(59, 130, 246, 0.3);
              border-radius: 50%;
              z-index: -1;
              animation: userPulse 2s infinite;
            }
            .user-cone {
              position: absolute;
              top: -24px;
              left: 50%;
              width: 0;
              height: 0;
              border-left: 14px solid transparent;
              border-right: 14px solid transparent;
              border-bottom: 28px solid rgba(59, 130, 246, 0.3);
              transform-origin: bottom center;
              transform: translateX(-50%) scaleX(0.6);
              pointer-events: none;
              display: none;
              z-index: -2;
            }
            @keyframes userPulse {
              0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.8; }
              50% { transform: translate(-50%, -50%) scale(1.8); opacity: 0.4; }
              100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0; }
            }
          `;
          document.head.appendChild(style);
        }

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([loc.longitude, loc.latitude])
          .addTo(map);

        userMarkerRef.current = { marker, el };
      } else {
        userMarkerRef.current.marker.setLngLat([loc.longitude, loc.latitude]);
      }

      // 3. Directional cone rotation
      const userEl = userMarkerRef.current?.el;
      if (userEl) {
        const cone = userEl.querySelector('.user-cone') as HTMLDivElement | null;
        if (cone) {
          if (loc.heading !== null && loc.heading !== undefined) {
            cone.style.display = 'block';
            cone.style.transform = `translateX(-50%) rotate(${loc.heading}deg)`;
          } else {
            cone.style.display = 'none';
          }
        }
      }
    };

    window.addEventListener('high-frequency-user-location', handleHighFreqLocation);

    // Initial marker rendering if location is already loaded
    if (userLocation) {
      handleHighFreqLocation(
        new CustomEvent('high-frequency-user-location', { detail: userLocation }),
      );
    }

    return () => {
      window.removeEventListener('high-frequency-user-location', handleHighFreqLocation);
    };
  }, [userLocation]);

  useEffect(() => {
    syncUserLocationRef.current = sync;
    sync();
  }, [sync]);

  // Sync Traffic Layer
  const syncTraffic = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (showTraffic) {
      if (!map.getSource('google-traffic')) {
        map.addSource('google-traffic', {
          type: 'raster',
          tiles: [`${TRAFFIC_PROTOCOL}://{z}/{x}/{y}`],
          tileSize: 256,
        });
      }
      if (!map.getLayer('google-traffic-layer')) {
        map.addLayer({
          id: 'google-traffic-layer',
          type: 'raster',
          source: 'google-traffic',
          paint: {
            'raster-opacity': 0.8,
          },
        });
      }
    } else {
      if (map.getLayer('google-traffic-layer')) {
        map.removeLayer('google-traffic-layer');
      }
      if (map.getSource('google-traffic')) {
        map.removeSource('google-traffic');
      }
    }
  }, [showTraffic]);

  useEffect(() => {
    syncTrafficRef.current = syncTraffic;
    if (mapRef.current?.isStyleLoaded()) {
      syncTraffic();
    }
  }, [syncTraffic]);

  // Sync Weather Layer
  const syncWeather = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const sourceId = 'weather-tile-source';
    const layerId = 'weather-tile-layer';

    if (showWeather) {
      const tileUrl =
        weatherType === 'precipitation'
          ? `https://tilecache.rainviewer.com${radarPath || '/v2/radar/now'}/256/{z}/{x}/{y}/1/1_1.png`
          : `https://tile.openweathermap.org/map/${weatherType}_new/{z}/{x}/{y}.png?appid=YOUR_OWM_API_KEY`;

      if (map.getSource(sourceId)) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        map.removeSource(sourceId);
      }

      // If we are waiting for the radar path, don't add the source yet to avoid 400 errors
      if (weatherType === 'precipitation' && !radarPath) return;

      map.addSource(sourceId, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        maxzoom: weatherType === 'precipitation' ? MAX_RAINVIEWER_ZOOM : MAX_WEATHER_ZOOM,
      });

      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': 0.6,
        },
      });
    } else {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  }, [showWeather, weatherType, radarPath]);

  useEffect(() => {
    syncWeatherRef.current = syncWeather;
    if (mapRef.current?.isStyleLoaded()) {
      syncWeather();
    }
  }, [syncWeather]);

  // ─── Sync Ciclovías Layer ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const SOURCE_ID = 'cycleways-source';
    const LAYER_BG = 'cycleways-layer-bg';
    const LAYER_LINE = 'cycleways-layer-line';
    const LAYER_GLOW = 'cycleways-layer-glow';

    const geoJSONData =
      cyclewaysData && cyclewaysData.length > 0
        ? {
            type: 'FeatureCollection',
            features: cyclewaysData.map((c: any) => ({
              type: 'Feature',
              id: c.id,
              properties: {
                IDENTIFICA: c.id,
                EJE_VIA: c.eje,
                INICIO: c.inicio,
                FIN: c.fin,
                KM: c.km,
                TIPO: 'ciclovía',
                COMUNA: 'Valdivia',
              },
              geometry: {
                type: 'LineString',
                coordinates: c.coordinates,
              },
            })),
          }
        : CICLOVIAS_GEOJSON;

    const addLayers = () => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geoJSONData as any,
        });
      } else {
        (map.getSource(SOURCE_ID) as any).setData(geoJSONData as any);
      }
      if (!map.getLayer(LAYER_GLOW)) {
        map.addLayer({
          id: LAYER_GLOW,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#00d2ff',
            'line-width': 12,
            'line-opacity': 0.22,
            'line-blur': 5,
          },
        });
      }
      if (!map.getLayer(LAYER_BG)) {
        map.addLayer({
          id: LAYER_BG,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'butt' },
          paint: {
            'line-color': '#072030',
            'line-width': 7,
            'line-opacity': 0.6,
          },
        });
      }
      if (!map.getLayer(LAYER_LINE)) {
        map.addLayer({
          id: LAYER_LINE,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#00d2ff',
            'line-width': 4,
            'line-opacity': 1,
            'line-dasharray': [1, 2],
          },
        });
      }
      // Attach click popup once
      if (!(map as any)._cyclewayListenersAttached) {
        map.on('click', LAYER_LINE, (e: any) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties as any;
          new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
            .setLngLat(e.lngLat)
            .setHTML(
              `
              <div style="font-family:sans-serif;padding:4px 2px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                  <i class="material-icons" style="font-size:20px;color:#00d2ff;">directions_bike</i>
                  <strong style="color:#00d2ff;font-size:13px;">${props.EJE_VIA || 'Ciclovía'}</strong>
                </div>
                <div style="font-size:11px;color:#ccc;line-height:1.8;">
                  <div>Desde: <b style="color:#fff;">${props.INICIO}</b></div>
                  <div>Hasta: <b style="color:#fff;">${props.FIN}</b></div>
                  <div>Largo: <b style="color:#00d2ff;">${props.KM} km</b></div>
                </div>
              </div>
            `,
            )
            .addTo(map);
        });
        map.on('mouseenter', LAYER_LINE, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', LAYER_LINE, () => {
          map.getCanvas().style.cursor = '';
        });
        (map as any)._cyclewayListenersAttached = true;
      }

      if (map.getLayer('cluster-circles')) map.moveLayer('cluster-circles');
      if (map.getLayer('cluster-labels')) map.moveLayer('cluster-labels');
    };

    const removeLayers = () => {
      for (const id of [LAYER_LINE, LAYER_BG, LAYER_GLOW]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      (map as any)._cyclewayListenersAttached = false;
    };

    const sync = () => {
      if (!map.isStyleLoaded()) return;
      if (showCycleways) {
        addLayers();
      } else {
        removeLayers();
      }
    };

    // Register in ref so style.load can call it too
    syncCyclewaysRef.current = sync;

    // Run immediately if map is ready, otherwise wait for next idle
    if (map.isStyleLoaded()) {
      sync();
    } else {
      const onIdle = () => {
        sync();
      };
      map.once('idle', onIdle);
      return () => {
        map.off('idle', onIdle);
      };
    }
  }, [showCycleways, cyclewaysData]); // eslint-disable-line react-hooks/exhaustive-deps
  // ───────────────────────────────────────────────────────────────────────────

  // Sync Style (with dynamic maxZoom per layer)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.hasImage('wood-pattern')) {
      map.removeImage('wood-pattern');
    }

    // Update maxZoom based on the current layer
    const layerMaxZoom = MAX_ZOOM_PER_LAYER[mapLayer] || 18;
    map.setMaxZoom(layerMaxZoom);

    // Satélite siempre usa el protocolo cacheado para Ultra HD
    const selectedStyle = mapLayer === 'satellite' ? getSatelliteStyle(true) : mapStyles[mapLayer];

    if (selectedStyle) {
      map.setStyle(selectedStyle);
    }
  }, [mapLayer]);

  // Sync Map Camera on Selection change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedEvent) {
      map.flyTo({
        center: [selectedEvent.longitude, selectedEvent.latitude],
        zoom: Math.max(map.getZoom(), 16),
        essential: true,
      });
    }
  }, [selectedEvent]);

  // Sync Zoom Level
  useEffect(() => {
    const map = mapRef.current;
    if (map && zoom !== undefined) {
      if (Math.round(map.getZoom()) !== zoom) {
        map.setZoom(zoom);
      }
    }
  }, [zoom]);

  // Center on User Location
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (centerTrigger && userLocation) {
      map.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 14,
        essential: true,
      });
    }
  }, [centerTrigger, userLocation]);

  // Cursor manager (Tactical Mode & Pincho Tool)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (onMapPincho) {
      const pinchoCursor = `url("data:image/svg+xml;utf8,%3Csvg width='32' height='32' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' fill='%23EF4444' stroke='%23FFFFFF' stroke-width='1.5'/%3E%3C/svg%3E") 16 32, crosshair`;
      map.getCanvas().style.cursor = pinchoCursor;
    } else if (tacticalMode) {
      const customCursor = `url('data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2310B981" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8"/><line x1="12" y1="0" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="24"/><line x1="0" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="24" y2="12"/><circle cx="12" cy="12" r="1" fill="%2310B981"/></svg>') 12 12, crosshair`;
      map.getCanvas().style.cursor = customCursor;
    } else {
      map.getCanvas().style.cursor = '';
    }
  }, [onMapPincho, tacticalMode]);

  // Dynamic boat movement simulation on water using steering AI
  useEffect(() => {
    // Persistent state for boat simulation to avoid "jittery" or "spinning" behavior
    const simulationState: { [id: string]: { lastHeading: number; turnCooldown: number } } = {};

    const interval = setInterval(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      Object.values(markersRef.current).forEach((markerObj) => {
        const event = markerObj.event;
        if (!event || event.category !== 'embarcacion') return;

        if (!simulationState[event.id]) {
          simulationState[event.id] = {
            lastHeading: event.boatHeading || 0,
            turnCooldown: 0,
          };
        }
        const state = simulationState[event.id];

        // Step size calculated for a smooth 100ms update step (0.1s)
        const speed = event.boatSpeed || 8;
        const stepSize = 0.0000005 * speed;

        let currentHeading = event.boatHeading || 0;

        // 1. Subtle natural drift (small random changes while in open water)
        if (state.turnCooldown <= 0) {
          // Add a very small random drift (-0.2 to 0.2 degree) to make movement look natural
          currentHeading = (currentHeading + (Math.random() * 0.4 - 0.2) + 360) % 360;
        } else {
          state.turnCooldown--;
        }

        const headingRad = (currentHeading * Math.PI) / 180;
        const candidateLng = event.longitude + Math.sin(headingRad) * stepSize;
        const candidateLat = event.latitude + Math.cos(headingRad) * stepSize;

        // 2. Collision Detection & Avoidance
        if (detectSurfaceTypeForBoat(map, candidateLng, candidateLat) === 'water') {
          // Path is clear: Update position
          event.longitude = candidateLng;
          event.latitude = candidateLat;
          event.boatHeading = currentHeading;

          markerObj.pinMarker.setLngLat([candidateLng, candidateLat]);
          if (markerObj.flatMarker) {
            markerObj.flatMarker.setLngLat([candidateLng, candidateLat]);
          }
        } else {
          // Bank hit! Find best escape angle
          let foundNewDirection = false;
          // Strategy: Try wider turns first to avoid immediate re-collision
          const anglesToTry = [45, -45, 90, -90, 135, -135, 180];

          for (const angleOffset of anglesToTry) {
            const testHeading = (currentHeading + angleOffset + 360) % 360;
            const testHeadingRad = (testHeading * Math.PI) / 180;
            const testLng = event.longitude + Math.sin(testHeadingRad) * stepSize * 15; // Test further ahead (1.5s ahead)
            const testLat = event.latitude + Math.cos(testHeadingRad) * stepSize * 15;

            if (detectSurfaceTypeForBoat(map, testLng, testLat) === 'water') {
              event.boatHeading = testHeading;
              state.turnCooldown = 30; // Prevent jittery turns for 3 seconds (30 cycles of 100ms)
              foundNewDirection = true;
              break;
            }
          }

          if (!foundNewDirection) {
            // Desperate move: complete reversal
            event.boatHeading = (currentHeading + 180) % 360;
            state.turnCooldown = 60;
          }
        }

        // 3. Smooth Visual Rotation Update
        if (!markerObj.domRefs) {
          updateMarkerDomRefs(markerObj);
        }
        const domRefs = markerObj.domRefs!;
        const finalHeading = event.boatHeading;

        const boatBody = domRefs.boatBody;
        if (boatBody) {
          // Slower, more majestic rotation transition
          boatBody.style.transition = 'transform 2.5s ease-in-out';
          boatBody.style.transform = `rotate(${finalHeading}deg)`;
        }
        const wakeContainer = domRefs.wakeContainer;
        if (wakeContainer) {
          // Keep wake in sync with boat rotation
          wakeContainer.style.transition = 'transform 2.5s ease-in-out';
          wakeContainer.style.transform = `translate(-50%, -50%) rotate(${finalHeading}deg)`;
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <div ref={mapNodeRef} style={{ width: '100%', height: '100%' }}>
        <CloudShadows />
      </div>
      {selectedEvent?.indoorMap && internalFloor !== null && (
        <FloorSelector
          floors={selectedEvent.indoorMap.floors}
          activeFloor={internalFloor}
          onSelectFloor={setInternalFloor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
  },
  mapElement: {
    height: '100%',
    width: '100%',
  },
});
