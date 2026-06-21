export interface WeatherForecast {
  temp: number;
  condition: string;
  icon: string;
  time: string;
  rainProb: number;
  rainMm: number;
}

export interface ZoneWeather {
  name: string;
  currentTemp: number;
  apparentTemp: number;
  currentCondition: string;
  weatherCode: number;
  isNight: boolean;
  humidity: number;
  precipitation: number;
  rain: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  aqi: number;
  forecast: WeatherForecast[];
}

/**
 * Mapeo de códigos WMO según la guía de la Organización Meteorológica Mundial
 */
export function getWeatherDescription(code: number): string {
  if (code === 0) return 'Cielo despejado';
  if (code === 1) return 'Mayormente despejado';
  if (code === 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nuboso';
  if (code === 51 || code === 53 || code === 55) return 'Llovizna';
  if (code === 61 || code === 63 || code === 65) return 'Lluvia persistente';
  if (code === 71 || code === 73 || code === 75) return 'Nieve o aguanieve';
  if (code === 80 || code === 81 || code === 82) return 'Chubascos aislados';
  if (code === 95 || code === 96 || code === 99) return 'Tormenta eléctrica';
  return 'Condiciones variables';
}

/**
 * Obtiene el ícono de Ionicons correspondiente al código meteorológico
 */
export function getWeatherIcon(code: number, isNight = false): string {
  if (code === 0) return isNight ? 'moon' : 'sunny';
  if (code === 1 || code === 2 || code === 3) return isNight ? 'cloudy-night' : 'partly-sunny';
  if (code === 51 || code === 53 || code === 55) return 'rainy-outline';
  if (code === 61 || code === 63 || code === 65) return 'rainy';
  if (code === 71 || code === 73 || code === 75) return 'snow';
  if (code === 80 || code === 81 || code === 82) return 'rainy';
  if (code === 95 || code === 96 || code === 99) return 'thunderstorm';
  return 'cloud-outline';
}

/**
 * Fetches weather and air quality for a specific location using Open-Meteo matching Windy precision
 */
export async function getLocalizedWeather(lat?: number, lon?: number): Promise<ZoneWeather[]> {
  try {
    const latitude = lat ?? -39.8142;
    const longitude = lon ?? -73.2459;

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,rain,wind_speed_10m,weather_code&models=ecmwf_ifs&timezone=America%2FSantiago`;
    const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi&timezone=America%2FSantiago`;
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=12`;

    // Fetch everything in parallel to significantly optimize data update speed
    const [weatherRes, airQualityRes, geoRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(airQualityUrl),
      fetch(geoUrl, { headers: { 'User-Agent': 'AppTurismoMap/1.0' } }).catch(() => null),
    ]);

    let placeName = 'Valdivia';
    if (geoRes && geoRes.ok) {
      try {
        const geoData = await geoRes.json();
        if (geoData.address) {
          placeName =
            geoData.address.city ||
            geoData.address.town ||
            geoData.address.village ||
            geoData.address.suburb ||
            'Valdivia';
        }
      } catch (e) {
        console.warn('Geocoding parsing failed', e);
      }
    }

    if (!weatherRes.ok) {
      throw new Error(`Error en comunicación API Clima. Status: ${weatherRes.status}`);
    }

    const weatherData = await weatherRes.json();
    const airQualityData = await airQualityRes.json();

    const current = weatherData.current;
    const hourly = weatherData.hourly;

    // Parse current conditions
    const currentTemp = Math.round(current.temperature_2m);
    const apparentTemp = Math.round(current.apparent_temperature);
    const humidity = Math.round(current.relative_humidity_2m);
    const precipitation = current.precipitation;
    const rain = current.rain;
    const weatherCode = current.weather_code;
    const windSpeed = Math.round(current.wind_speed_10m);
    const windGusts = Math.round(current.wind_gusts_10m);
    const windDirection = Math.round(current.wind_direction_10m);

    // Parse AQI
    let aqi = 15; // default fallback
    if (airQualityData && airQualityData.current && airQualityData.current.us_aqi !== undefined) {
      aqi = Math.round(airQualityData.current.us_aqi);
    }

    // Determine if it is night time to choose icons (e.g. from 19:00 to 07:00)
    const currentHourStr = current.time ? current.time.split('T')[1] : '';
    const currentHour = currentHourStr ? parseInt(currentHourStr.split(':')[0], 10) : 12;
    const isNight = currentHour >= 19 || currentHour < 7;

    const currentCondition = getWeatherDescription(weatherCode);

    // Get next 4 hours forecast
    const next4Hours: WeatherForecast[] = [];
    let nowIdx = -1;
    if (hourly && hourly.time && current.time) {
      // Clean target hour matching the hourly array format (e.g. "2026-06-09T12:00")
      const targetHourStr = current.time.substring(0, 13) + ':00';
      nowIdx = hourly.time.indexOf(targetHourStr);
    }

    if (nowIdx === -1) {
      nowIdx = new Date().getHours();
    }

    if (hourly && hourly.time) {
      for (let i = 1; i <= 4; i++) {
        const idx = nowIdx + i;
        if (hourly.time[idx]) {
          const forecastHourStr = hourly.time[idx].split('T')[1]; // e.g. "13:00"
          const forecastHour = parseInt(forecastHourStr.split(':')[0], 10);
          const fIsNight = forecastHour >= 19 || forecastHour < 7;

          next4Hours.push({
            temp: Math.round(hourly.temperature_2m[idx]),
            condition: getWeatherDescription(hourly.weather_code[idx]),
            icon: getWeatherIcon(hourly.weather_code[idx], fIsNight),
            time: forecastHourStr,
            rainProb: Math.round(hourly.precipitation_probability[idx]),
            rainMm: hourly.rain ? hourly.rain[idx] : 0,
          });
        }
      }
    }

    return [
      {
        name: placeName,
        currentTemp,
        apparentTemp,
        currentCondition,
        weatherCode,
        isNight,
        humidity,
        precipitation,
        rain,
        windSpeed,
        windGusts,
        windDirection,
        aqi,
        forecast: next4Hours,
      },
    ];
  } catch (error) {
    console.error('[WEATHER_SERVICE_ERROR]:', error);
    return [];
  }
}

/**
 * Obtiene la ruta más reciente para las teselas de radar de RainViewer.
 * Evita el error 400 al no usar el alias 'now' que no siempre es válido.
 */
export async function getLatestRadarPath(): Promise<string | null> {
  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!response.ok) return null;
    const data = await response.json();
    if (data.radar && data.radar.past && data.radar.past.length > 0) {
      // El último elemento del array 'past' es el más reciente
      return data.radar.past[data.radar.past.length - 1].path;
    }
    return null;
  } catch (error) {
    console.error('[RAINVIEWER_ERROR]:', error);
    return null;
  }
}
