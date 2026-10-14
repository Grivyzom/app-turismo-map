// Capa de contexto natural para react-native-maps (iOS/Android).
// Ver src/data/natureAreas.ts y design/natureAreaStyle.ts para el porqué.
import React, { useMemo } from 'react';
import { Polygon } from 'react-native-maps';

import { NATURE_AREA_SHAPES, NatureAreaCategory } from '../../data/natureAreas';

import {
  getNatureAreaPalette,
  NATURE_AREA_MIN_ZOOM,
  NATURE_AREA_FADE_ZOOM,
  NATURE_AREA_FADE_FACTOR,
  NATURE_AREA_OUTLINE_WIDTH,
  withAlpha,
} from './design/natureAreaStyle';
import type { MapLayer } from './types';

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface NatureAreasLayerProps {
  /** Categorías activas por filtros, unidas por coma (prop primitiva para el memo). */
  categoriesKey: string;
  zoom: number;
  bounds?: Bounds;
  highlightId?: string | null;
  mapLayer: MapLayer;
  onPressArea: (id: string) => void;
}

const NatureAreasLayerInner = ({
  categoriesKey,
  zoom,
  bounds,
  highlightId,
  mapLayer,
  onPressArea,
}: NatureAreasLayerProps) => {
  const palette = getNatureAreaPalette(mapLayer);

  // Sólo lo que está en pantalla, en una categoría activa y a escala de
  // barrio o más cerca. El área resaltada se mantiene a cualquier zoom.
  const visibleShapes = useMemo(() => {
    if (!categoriesKey) return [];
    const cats = new Set(categoriesKey.split(','));
    const showRest = zoom >= NATURE_AREA_MIN_ZOOM;
    return NATURE_AREA_SHAPES.filter((s) => {
      if (!cats.has(s.category)) return false;
      const isHighlighted = s.id === highlightId;
      if (!showRest && !isHighlighted) return false;
      // Sin relleno en reposo y sin info al tocar → no hay nada que montar.
      if (!isHighlighted && !s.interactive && palette.restOpacity[s.category] === 0) return false;
      if (!bounds) return true;
      const [minLng, minLat, maxLng, maxLat] = s.bbox;
      return !(
        maxLng < bounds.minLng ||
        minLng > bounds.maxLng ||
        maxLat < bounds.minLat ||
        minLat > bounds.maxLat
      );
    });
  }, [categoriesKey, zoom, bounds, highlightId, palette]);

  const fade = zoom >= NATURE_AREA_FADE_ZOOM ? NATURE_AREA_FADE_FACTOR : 1;
  const fillFor = (cat: NatureAreaCategory, isHighlighted: boolean) =>
    withAlpha(
      palette.color[cat],
      isHighlighted ? palette.selectedOpacity : palette.restOpacity[cat] * fade,
    );

  return (
    <>
      {visibleShapes.flatMap((shape) => {
        const isHighlighted = shape.id === highlightId;
        const fillColor = fillFor(shape.category, isHighlighted);
        const strokeColor = isHighlighted ? palette.color[shape.category] : 'transparent';
        return shape.parts.map((part, i) => (
          <Polygon
            key={`nature-${shape.id}-${i}`}
            coordinates={part.coordinates}
            holes={part.holes.length > 0 ? part.holes : undefined}
            fillColor={fillColor}
            strokeColor={strokeColor}
            strokeWidth={isHighlighted ? NATURE_AREA_OUTLINE_WIDTH : 0}
            tappable={shape.interactive}
            onPress={shape.interactive ? () => onPressArea(shape.id) : undefined}
            zIndex={0}
          />
        ));
      })}
    </>
  );
};

export const NatureAreasLayer = React.memo(NatureAreasLayerInner);
