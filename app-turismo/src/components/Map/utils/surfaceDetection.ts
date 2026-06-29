import type maplibregl from 'maplibre-gl';

export function detectSurfaceType(map: maplibregl.Map, lng: number, lat: number): 'land' | 'water' {
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

export function detectSurfaceTypeForBoat(map: maplibregl.Map, lng: number, lat: number): 'land' | 'water' {
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
