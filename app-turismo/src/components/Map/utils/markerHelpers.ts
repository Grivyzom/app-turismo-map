export const metersPerPixelAtZoom = (latitude: number, zoom: number) => {
  const latRad = (latitude * Math.PI) / 180;
  return (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom);
};

export function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const getAccuracyRadiusAtZoom = (accuracyMeters: number, latitude: number, zoom: number) => {
  const minRadius = 2;
  const metersPerPixel = metersPerPixelAtZoom(latitude, zoom);
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
    return minRadius;
  }
  return Math.max(minRadius, accuracyMeters / metersPerPixel);
};

export const WAVE_PERIOD_MS = 1700;
export const WAVE_MIN_RADIUS_PX = 6;
export const WAVE_STROKE_WIDTH = 2;

export const getUserWaveColor = (mapLayer: string) => {
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';
  return isDark ? '#60A5FA' : '#1D4ED8';
};
