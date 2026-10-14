import type { Map as MapLibreMap } from 'maplibre-gl';
import { applyBuildingMaterialColors } from '../../../utils/mapWebUtils';
import {
  BUILDING_3D_MAX_RADIUS_METERS,
  BUILDING_3D_MIN_PITCH,
  BUILDING_3D_FULL_PITCH,
} from './mapLibreConfig';

interface BuildingLODOptions {
  map: MapLibreMap;
  /** Mapa vigente (puede diferir del inicial tras recrear estilo). */
  getMap: () => MapLibreMap | null;
  /** Modo de capa activo ('dark', 'streets', ...). */
  getLayerMode: () => string;
}

/**
 * LOD de edificios 3D: extrusión limitada a un radio alrededor de la cámara
 * con altura procedural según el pitch. Registra sus propios listeners en
 * el mapa; `dispose()` los remueve y cancela el rAF pendiente.
 */
export function createBuildingLOD({ map, getMap, getLayerMode }: BuildingLODOptions) {
  const sync3DBuildings = () => {
    const currentMap = getMap() || map;
    if (!currentMap || typeof currentMap.isStyleLoaded !== 'function' || !currentMap.isStyleLoaded()) return;

    // El estilo 'liberty' ya incluye 'building-3d' de forma nativa.
    // Ajustar el zoom del footprint 2D para no superponerse con la extrusión 3D.
    if (currentMap.getLayer('building')) {
      try { currentMap.setLayerZoomRange('building', 0, 14); } catch {}
    }

    // Colorear los edificios según la altura, con paleta según el modo
    // activo. El modo Noche (dark) ya es tratado por applyDarkTheme(); aquí
    // aplicamos la paleta de DÍA para streets/light. El material real no
    // cambia durante el crecimiento — solo varía CUÁNDO cada edificio
    // llega a su altura (ver stagger por altura en updateBuildingLOD).
    const isDark = getLayerMode() === 'dark';
    if (!isDark) {
      applyBuildingMaterialColors(currentMap, false);
    }

    if (currentMap.getLayer('building-3d')) {
      try {
        // Transición corta: la rampa procedural (updateBuildingLOD, atada
        // al pitch real cuadro a cuadro) ya anima el crecimiento; esta
        // transición solo suaviza el paso entre los pasos discretos de
        // esa rampa y el salto al entrar/salir del radio de la zona 3D,
        // sin introducir un retraso perceptible respecto al ángulo real.
        currentMap.setPaintProperty('building-3d', 'fill-extrusion-height-transition', {
          duration: 150,
          delay: 0,
        });
        currentMap.setPaintProperty('building-3d', 'fill-extrusion-color-transition', {
          duration: 220,
          delay: 0,
        });
        currentMap.setPaintProperty('building-3d', 'fill-extrusion-opacity-transition', {
          duration: 220,
          delay: 0,
        });
      } catch {}
    }

    updateBuildingLOD();
  };

  // Limita la extrusión 3D real a un círculo alrededor del centro de
  // cámara (BUILDING_3D_MAX_RADIUS_METERS), y la altura crece de forma
  // procedural con el pitch en vez de aparecer de golpe al soltar el
  // drag: entre BUILDING_3D_MIN_PITCH y BUILDING_3D_FULL_PITCH la altura
  // real se escala por una rampa 0→1 según el ángulo actual, así que el
  // edificio crece cuadro a cuadro mientras el usuario inclina la
  // cámara, no en un solo salto al terminar el gesto.
  let lastBuildingLodT = -1;
  const updateBuildingLOD = () => {
    const currentMap = getMap() || map;
    if (
      !currentMap ||
      typeof currentMap.isStyleLoaded !== 'function' ||
      !currentMap.isStyleLoaded() ||
      !currentMap.getLayer('building-3d')
    ) {
      return;
    }

    const heightExpr: any[] = ['coalesce', ['get', 'render_height'], ['get', 'height'], 8];

    try {
      const pitch = currentMap.getPitch();
      const t = Math.max(
        0,
        Math.min(
          1,
          (pitch - BUILDING_3D_MIN_PITCH) / (BUILDING_3D_FULL_PITCH - BUILDING_3D_MIN_PITCH),
        ),
      );

      // Evita recompilar la expresión (y repintar 'building-3d') cuando
      // el ángulo no cambió lo suficiente como para notarse.
      if (Math.abs(t - lastBuildingLodT) < 0.01) return;
      lastBuildingLodT = t;

      if (t <= 0) {
        currentMap.setPaintProperty('building-3d', 'fill-extrusion-height', 0);
        return;
      }

      // Ease-out-back: pasa levemente 1 cerca del final del gesto y
      // vuelve a asentarse en 1 justo al llegar — el edificio "sobre-
      // sube" un poco y cae en su lugar, sensación de peso/resorte en
      // vez de una rampa lineal robótica. f(0)=0 y f(1)=1 exactos.
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const eased = 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;

      // Stagger por altura: cada edificio arranca a crecer con un delay
      // proporcional a su altura normalizada (0=casa baja, 1=rascacielos
      // de 150m+), así que las construcciones bajas brotan primero y los
      // edificios más altos van "alcanzando" después — la ciudad se
      // ensambla en cascada en vez de que todo suba a la vez de golpe.
      // Todo evaluado como expresión nativa (min/max/get), sin loop JS
      // por-feature: el único valor calculado en JS es el escalar 'eased'.
      const normHeight: any = ['/', ['min', heightExpr, 150], 150];
      const delay: any = ['*', normHeight, 0.35];
      const denom: any = ['max', 0.0001, ['-', 1, delay]];
      const localT: any = ['max', 0, ['/', ['-', eased, delay], denom]];
      const rampedHeight: any = ['*', heightExpr, localT];

      // La expresión 'within' de maplibre solo evalúa Point/LineString —
      // para features Polygon (el footprint de cada edificio) SIEMPRE
      // devuelve false, así que no sirve para esto. 'distance' sí soporta
      // Polygon (polygonToGeometryDistance): mide la distancia real del
      // footprint al punto de cámara, 0 si el punto cae dentro. Con eso
      // se puede acotar la extrusión a un radio real alrededor de lo que
      // el usuario está mirando de cerca, sin construir geometría propia.
      const center = currentMap.getCenter();
      const centerPoint: any = { type: 'Point', coordinates: [center.lng, center.lat] };

      currentMap.setPaintProperty('building-3d', 'fill-extrusion-height', [
        'case',
        ['<', ['distance', centerPoint], BUILDING_3D_MAX_RADIUS_METERS],
        rampedHeight,
        0,
      ]);
    } catch {}
  };

  // 'pitch' dispara en cada cuadro del drag de inclinación — de ahí sale
  // el crecimiento procedural. Se throttlea a 1 vez por frame con rAF
  // (igual que throttledUpdateAesthetics más abajo) para no recompilar
  // la expresión más rápido de lo que se puede pintar.
  let buildingLodRafId: number | null = null;
  const throttledUpdateBuildingLOD = () => {
    if (buildingLodRafId !== null) return;
    buildingLodRafId = requestAnimationFrame(() => {
      updateBuildingLOD();
      buildingLodRafId = null;
    });
  };

  map.on('pitch', throttledUpdateBuildingLOD);
  map.on('moveend', updateBuildingLOD);
  map.on('zoomend', updateBuildingLOD);

  const dispose = () => {
    map.off('pitch', throttledUpdateBuildingLOD);
    map.off('moveend', updateBuildingLOD);
    map.off('zoomend', updateBuildingLOD);
    if (buildingLodRafId !== null) cancelAnimationFrame(buildingLodRafId);
  };

  return { sync3DBuildings, updateBuildingLOD, dispose };
}
