import React, { useEffect, useState, useRef, ComponentProps } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getLocalizedWeather, ZoneWeather, getWeatherIcon } from '../../utils/weatherUtils';
import { calculateDistance } from '../../utils/locationUtils';
import { useUserLocationContext } from '../../context/UserLocationContext';

interface WeatherForecastWidgetProps {
  isDark?: boolean;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

export function WeatherForecastWidget({ isDark }: WeatherForecastWidgetProps) {
  const { userLocation } = useUserLocationContext();
  const [weatherData, setWeatherData] = useState<ZoneWeather[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [opacity] = useState(new Animated.Value(0));

  // local override for theme: null means follow isDark prop, otherwise override manually
  const [userThemeOverride, setUserThemeOverride] = useState<'light' | 'dark' | null>(null);

  // Derive final dark mode setting without calling setState inside an effect
  const localIsDark = userThemeOverride !== null ? userThemeOverride === 'dark' : !!isDark;

  const lastFetchedLocation = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    async function load() {
      const lat = userLocation?.latitude;
      const lon = userLocation?.longitude;

      // Avoid refetching if movement is less than 2km (2000 meters)
      if (lat !== undefined && lon !== undefined && lastFetchedLocation.current !== null) {
        const dist = calculateDistance(
          lastFetchedLocation.current.lat,
          lastFetchedLocation.current.lon,
          lat,
          lon,
        );
        if (dist < 2000 && weatherData.length > 0) {
          return; // Skip fetch
        }
      }

      const data = await getLocalizedWeather(lat, lon);

      if (lat !== undefined && lon !== undefined) {
        lastFetchedLocation.current = { lat, lon };
      }

      setWeatherData(data);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
    load();
    const interval = setInterval(load, 600000); // 10 min
    return () => clearInterval(interval);
  }, [userLocation?.latitude, userLocation?.longitude, opacity, weatherData.length]);

  if (weatherData.length === 0) return null;

  // We show Valdivia by default in the pill
  const valdivia = weatherData.find((d) => d.name === 'Valdivia') || weatherData[0];

  // Dynamic Theme Styling (Premium Glassmorphism)
  const theme = {
    bg: localIsDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.85)',
    border: localIsDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.12)',
    text: localIsDark ? '#FFFFFF' : '#1F2937',
    textSec: localIsDark ? '#9CA3AF' : '#4B5563',
    textMuted: localIsDark ? '#6B7280' : '#6B7280',
    pillBg: localIsDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.85)',
    pillBorder: localIsDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
    pillText: localIsDark ? '#FFFFFF' : '#1F2937',
    progressBg: localIsDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    cardBg: localIsDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
    cardBorder: localIsDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
    shadowColor: localIsDark ? '#000000' : 'rgba(0, 0, 0, 0.15)',
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
        style={[
          styles.pill,
          {
            backgroundColor: theme.pillBg,
            borderColor: theme.pillBorder,
            shadowColor: theme.shadowColor,
          },
        ]}
      >
        <View style={styles.mainInfo}>
          <Ionicons
            name={getWeatherIcon(valdivia.weatherCode, valdivia.isNight) as IconName}
            size={18}
            color={localIsDark ? '#FFFFFF' : '#0284C7'}
          />
          <Text style={[styles.tempText, { color: theme.pillText }]}>{valdivia.currentTemp}°</Text>
          <View style={styles.divider} />
          <Text style={[styles.zoneText, { color: theme.pillText }]}>{valdivia.name}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.textSec}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View
          style={[
            styles.expandedContent,
            {
              backgroundColor: theme.bg,
              borderColor: theme.border,
              shadowColor: theme.shadowColor,
            },
          ]}
        >
          {weatherData.map((zone) => {
            const humInfo = getHumidityLabel(zone.humidity);
            const aqiInfo = getAqiLabel(zone.aqi);
            const windDir = getWindDirection(zone.windDirection);

            return (
              <View key={zone.name} style={styles.zoneRow}>
                {/* Zone Header with name and local theme toggle */}
                <View style={styles.zoneHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.zoneTitle, { color: theme.text }]}>{zone.name}</Text>
                    <Text style={[styles.zoneStatus, { color: theme.textSec }]}>
                      {zone.currentCondition}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setUserThemeOverride(localIsDark ? 'light' : 'dark')}
                    style={styles.themeToggleBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={localIsDark ? 'sunny' : 'moon'}
                      size={16}
                      color={localIsDark ? '#FBBF24' : '#475569'}
                    />
                  </TouchableOpacity>
                </View>

                {/* Big Temperature Section */}
                <View style={styles.tempSection}>
                  <View style={styles.tempLeft}>
                    <Text style={[styles.bigTempText, { color: theme.text }]}>
                      {zone.currentTemp}°
                    </Text>
                    <View style={styles.apparentRow}>
                      <Text style={[styles.apparentText, { color: theme.textSec }]}>
                        Sensación:{' '}
                      </Text>
                      <Text style={[styles.apparentValue, { color: theme.text }]}>
                        {zone.apparentTemp}°
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={getWeatherIcon(zone.weatherCode, zone.isNight) as IconName}
                    size={40}
                    color={localIsDark ? '#38BDF8' : '#0284C7'}
                  />
                </View>

                {/* Compact Environmental & Meteorological Grid */}
                <View style={styles.miniGrid}>
                  {/* Humedad */}
                  <View
                    style={[
                      styles.miniCard,
                      { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                    ]}
                  >
                    <Ionicons name="water" size={14} color="#60A5FA" />
                    <View>
                      <Text style={[styles.miniLabel, { color: theme.textSec }]}>Humedad</Text>
                      <Text style={[styles.miniValue, { color: theme.text }]}>
                        {zone.humidity}%
                      </Text>
                    </View>
                  </View>

                  {/* AQI */}
                  <View
                    style={[
                      styles.miniCard,
                      { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                    ]}
                  >
                    <Ionicons name="leaf" size={14} color="#34D399" />
                    <View>
                      <Text style={[styles.miniLabel, { color: theme.textSec }]}>AQI</Text>
                      <Text style={[styles.miniValue, { color: theme.text }]}>{zone.aqi}</Text>
                    </View>
                  </View>

                  {/* Viento */}
                  <View
                    style={[
                      styles.miniCard,
                      { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                    ]}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={14}
                      color={localIsDark ? '#38BDF8' : '#0284C7'}
                    />
                    <View>
                      <Text style={[styles.miniLabel, { color: theme.textSec }]}>Viento</Text>
                      <Text style={[styles.miniValue, { color: theme.text }]}>
                        {zone.windSpeed} km/h
                      </Text>
                    </View>
                  </View>

                  {/* Lluvia */}
                  <View
                    style={[
                      styles.miniCard,
                      { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                    ]}
                  >
                    <Ionicons name="rainy-outline" size={14} color="#60A5FA" />
                    <View>
                      <Text style={[styles.miniLabel, { color: theme.textSec }]}>Lluvia</Text>
                      <Text style={[styles.miniValue, { color: theme.text }]}>
                        {zone.precipitation} mm
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Hourly Forecast */}
                <Text style={[styles.forecastTitle, { color: theme.text }]}>Próximas Horas</Text>
                <View style={styles.forecastGrid}>
                  {zone.forecast.map((f, i) => (
                    <View
                      key={i}
                      style={[
                        styles.forecastCard,
                        { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                      ]}
                    >
                      <Text style={[styles.forecastTime, { color: theme.textSec }]}>{f.time}</Text>
                      <Ionicons
                        name={f.icon as IconName}
                        size={16}
                        color={localIsDark ? '#38BDF8' : '#0284C7'}
                      />
                      <Text style={[styles.forecastTemp, { color: theme.text }]}>{f.temp}°</Text>
                      {f.rainProb > 0 && (
                        <View style={styles.rainProbContainer}>
                          <Ionicons name="umbrella" size={8} color="#60A5FA" />
                          <Text style={styles.rainProbText}>{f.rainProb}%</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

// Helpers for UX descriptions and color themes
function getHumidityLabel(humidity: number): { text: string; color: string } {
  if (humidity < 30) return { text: 'Seco', color: '#F59E0B' };
  if (humidity <= 60) return { text: 'Confortable', color: '#10B981' };
  if (humidity <= 85) return { text: 'Húmedo', color: '#3B82F6' };
  return { text: 'Muy húmedo', color: '#2563EB' };
}

// AQI Color mapping using US standard scale
function getAqiLabel(aqi: number): { text: string; color: string } {
  if (aqi <= 50) return { text: 'Excelente', color: '#10B981' };
  if (aqi <= 100) return { text: 'Moderado', color: '#FBBF24' };
  if (aqi <= 150) return { text: 'Dañino p. sensibles', color: '#F97316' };
  return { text: 'Insalubre', color: '#EF4444' };
}

function getWindDirection(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round((deg % 360) / 45) % 8;
  return directions[index];
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 16,
    right: 16,
    zIndex: 2500,
    alignItems: 'flex-end',
  },
  pill: {
    borderRadius: 30,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  mainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tempText: {
    fontSize: 15,
    fontWeight: '800',
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  expandedContent: {
    marginTop: 8,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    width: 260,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  zoneRow: {
    gap: 12,
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  zoneTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  zoneStatus: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  themeToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tempLeft: {
    flexDirection: 'column',
  },
  bigTempText: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  apparentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  apparentText: {
    fontSize: 11,
    fontWeight: '500',
  },
  apparentValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
    justifyContent: 'space-between',
  },
  miniCard: {
    width: '48%',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  miniValue: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  forecastTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  forecastGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  forecastCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  forecastTime: {
    fontSize: 9,
    fontWeight: '700',
  },
  forecastTemp: {
    fontSize: 11,
    fontWeight: '800',
  },
  rainProbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  rainProbText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#60A5FA',
  },
});
