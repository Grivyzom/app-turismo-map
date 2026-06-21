// Haversine para calcular distancia en metros entre dos coordenadas
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radio de la Tierra en metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Rumbo geodésico (bearing) entre dos puntos en grados
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

// Calcula el centro (centroide de los vértices) de un polígono o camino
export function getPolygonCenter(points: { latitude: number; longitude: number }[]): { latitude: number; longitude: number } {
  if (!points || points.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  let sumLat = 0;
  let sumLng = 0;
  
  // Si es un polígono cerrado (el primer y el último punto son iguales), omitimos el último para no darle doble peso
  const first = points[0];
  const last = points[points.length - 1];
  const isClosed = points.length > 1 && first.latitude === last.latitude && first.longitude === last.longitude;
  
  const limit = isClosed ? points.length - 1 : points.length;
  if (limit <= 0) {
    return { latitude: first.latitude, longitude: first.longitude };
  }

  for (let i = 0; i < limit; i++) {
    sumLat += points[i].latitude;
    sumLng += points[i].longitude;
  }

  return {
    latitude: sumLat / limit,
    longitude: sumLng / limit,
  };
}
