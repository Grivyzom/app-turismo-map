import { useCallback, useEffect, useState } from 'react';

import { getWeatherDescription, getWeatherIcon } from '../../utils/weatherUtils';

/**
 * Clima completo para la pantalla "Clima en Sector" y el chip del Inicio.
 * Usa Open-Meteo (mismo proveedor que weatherUtils) pero pide además el pronóstico
 * diario, índice UV y amanecer/atardecer, que la vista web no necesita.
 */

export interface HourlyPoint {
  label: string; // "Ahora" | "14:00"
  temp: number;
  rainProb: number;
  icon: string;
}

export interface DailyPoint {
  label: string; // "Hoy" | "Mié"
  min: number;
  max: number;
  icon: string;
}

export interface MobileWeather {
  temp: number;
  apparent: number;
  min: number;
  max: number;
  condition: string;
  icon: string;
  weatherCode: number;
  isNight: boolean;
  windSpeed: number;
  windGusts: number;
  windDirLabel: string;
  rainProb: number;
  rainMm: number;
  humidity: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  updatedAt: string;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  alert: string | null;
  recommendation: string;
  isRainy: boolean;
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

export function windDirectionLabel(degrees: number): string {
  const idx = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return CARDINALS[idx];
}

function hhmm(iso: string): string {
  return iso.split('T')[1]?.slice(0, 5) ?? '';
}

const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);

function buildAlert(maxRainProb: number, gusts: number, uv: number, code: number): string | null {
  if (code >= 95) return 'Tormenta eléctrica en las próximas horas. Evita zonas abiertas y el río.';
  if (gusts >= 60) return `Ráfagas de viento de hasta ${gusts} km/h. Precaución en la costanera.`;
  if (maxRainProb >= 80) return 'Lluvia intensa probable en las próximas horas.';
  if (uv >= 8) return `Índice UV muy alto (${uv}). Usa protector solar y busca sombra.`;
  return null;
}

function buildRecommendation(isRainy: boolean, temp: number, isNight: boolean): string {
  if (isRainy) return 'Hoy conviene planear panoramas bajo techo: museos, mercado y cafés.';
  if (isNight) return 'Noche tranquila para recorrer la costanera y cenar cerca del río.';
  if (temp >= 24) return 'Día caluroso: ideal para paseos en lancha y parques con sombra.';
  if (temp <= 8) return 'Día frío: abrígate y combina paseos cortos con lugares bajo techo.';
  return 'Buen clima para caminar: recorre el centro y la costanera a pie.';
}

export async function fetchMobileWeather(lat: number, lon: number): Promise<MobileWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day' +
    '&hourly=temperature_2m,precipitation_probability,weather_code' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum' +
    '&forecast_days=5&timezone=auto';

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
  const data = await res.json();
  const { current, hourly, daily } = data;

  const isNight = current.is_day === 0;
  const currentHourKey = String(current.time).slice(0, 13) + ':00';
  let nowIdx = (hourly.time as string[]).indexOf(currentHourKey);
  if (nowIdx < 0) nowIdx = 0;

  const hourlyPoints: HourlyPoint[] = [];
  for (let i = 0; i < 24 && nowIdx + i < hourly.time.length; i++) {
    const idx = nowIdx + i;
    const hour = parseInt(hhmm(hourly.time[idx]).slice(0, 2), 10);
    hourlyPoints.push({
      label: i === 0 ? 'Ahora' : hhmm(hourly.time[idx]),
      temp: Math.round(hourly.temperature_2m[idx]),
      rainProb: Math.round(hourly.precipitation_probability[idx] ?? 0),
      icon: getWeatherIcon(hourly.weather_code[idx], hour >= 20 || hour < 7),
    });
  }

  const dailyPoints: DailyPoint[] = (daily.time as string[]).map((day, i) => ({
    label: i === 0 ? 'Hoy' : WEEKDAYS[new Date(`${day}T12:00:00`).getDay()],
    min: Math.round(daily.temperature_2m_min[i]),
    max: Math.round(daily.temperature_2m_max[i]),
    icon: getWeatherIcon(daily.weather_code[i]),
  }));

  const next6Rain = hourlyPoints.slice(0, 6).map((h) => h.rainProb);
  const maxRainProb = next6Rain.length ? Math.max(...next6Rain) : 0;
  const weatherCode: number = current.weather_code;
  const isRainy = RAIN_CODES.has(weatherCode) || maxRainProb >= 60;
  const uvIndex = Math.round(current.uv_index ?? daily.uv_index_max?.[0] ?? 0);
  const temp = Math.round(current.temperature_2m);
  const windGusts = Math.round(current.wind_gusts_10m);

  return {
    temp,
    apparent: Math.round(current.apparent_temperature),
    min: dailyPoints[0]?.min ?? temp,
    max: dailyPoints[0]?.max ?? temp,
    condition: getWeatherDescription(weatherCode),
    icon: getWeatherIcon(weatherCode, isNight),
    weatherCode,
    isNight,
    windSpeed: Math.round(current.wind_speed_10m),
    windGusts,
    windDirLabel: windDirectionLabel(current.wind_direction_10m),
    rainProb: hourlyPoints[0]?.rainProb ?? 0,
    rainMm: Math.round((daily.precipitation_sum?.[0] ?? current.precipitation ?? 0) * 10) / 10,
    humidity: Math.round(current.relative_humidity_2m),
    uvIndex,
    sunrise: hhmm(daily.sunrise[0]),
    sunset: hhmm(daily.sunset[0]),
    updatedAt: hhmm(current.time),
    hourly: hourlyPoints,
    daily: dailyPoints,
    alert: buildAlert(maxRainProb, windGusts, uvIndex, weatherCode),
    recommendation: buildRecommendation(isRainy, temp, isNight),
    isRainy,
  };
}

const REFRESH_MS = 15 * 60 * 1000;

export function useMobileWeather(lat: number, lon: number) {
  const [weather, setWeather] = useState<MobileWeather | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redondeo a ~1 km para no re-consultar con cada lectura del GPS
  const rLat = Math.round(lat * 100) / 100;
  const rLon = Math.round(lon * 100) / 100;

  const load = useCallback(
    () =>
      fetchMobileWeather(rLat, rLon)
        .then((w) => {
          setWeather(w);
          setError(null);
        })
        .catch((err) => {
          console.warn('[MobileWeather]', err);
          setError('No pudimos actualizar el clima');
        }),
    [rLat, rLon],
  );

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return { weather, error, refresh: load };
}
