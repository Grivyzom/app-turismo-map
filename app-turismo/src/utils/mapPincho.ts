const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

export const formatPinchoCoordinates = (latitude: number, longitude: number) =>
  `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

export const buildGoogleStreetViewUrl = (latitude: number, longitude: number) => {
  const params = new URLSearchParams({
    size: '900x500',
    location: `${latitude},${longitude}`,
    fov: '85',
    pitch: '0',
    heading: '0',
  });

  if (GOOGLE_MAPS_API_KEY) {
    params.set('key', GOOGLE_MAPS_API_KEY);
  }

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
};

export const buildGoogleMapsSearchUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${latitude},${longitude}`,
  )}`;

/**
 * Realiza reverse geocoding para obtener la dirección exacta.
 * Prioriza Google Maps si hay API Key, si no usa Nominatim (OSM).
 */
export const reverseGeocode = async (
  latitude: number,
  longitude: number,
): Promise<string | null> => {
  // 1. Intentar con Google Maps Geocoding si hay API Key
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=es`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        // El primer resultado suele ser el más exacto (dirección con número)
        return data.results[0].formatted_address;
      }
    } catch (err) {
      console.warn('Google Geocoding error:', err);
    }
  }

  // 2. Fallback a Nominatim (OpenStreetMap)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=es`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AppTurismoMap/1.0 (antigravity)',
      },
    });
    const data = await response.json();

    if (data && data.display_name) {
      // Intentamos construir una dirección "limpia" pero completa
      if (data.address) {
        const a = data.address;
        const road = a.road || a.pedestrian || a.suburb || '';
        const houseNumber = a.house_number || '';
        const city = a.city || a.town || a.village || '';
        const county = a.county || '';

        if (road) {
          let addr = road;
          if (houseNumber) addr += ` ${houseNumber}`;
          if (city) addr += `, ${city}`;
          else if (county) addr += `, ${county}`;
          return addr;
        }
      }
      // Si no podemos construirla por partes, usamos el display_name completo
      return data.display_name;
    }
  } catch (err) {
    console.warn('Nominatim Geocoding error:', err);
  }

  return null;
};
