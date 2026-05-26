import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

interface Stamp {
  id: string;
  name: string;
  category: string;
  dateUnlocked?: string;
  icon: string;
  points: number;
}

interface TravelRoute {
  id: string;
  title: string;
  progress: number;
  total: number;
  unlockedStamps: number;
  xpBonus: number;
}

const UNLOCKED_STAMPS: Stamp[] = [
  { id: 's1', name: 'Cervecería Kunstmann', category: 'gastronomia', dateUnlocked: '26/05/2026', icon: 'local-drink', points: 100 },
  { id: 's2', name: 'Parque Saval', category: 'naturaleza', dateUnlocked: '24/05/2026', icon: 'park', points: 150 },
  { id: 's3', name: 'Maurice van de Maele', category: 'cultura', dateUnlocked: '22/05/2026', icon: 'museum', points: 120 },
];

const LOCKED_STAMPS: Stamp[] = [
  { id: 's4', name: 'Fuerte de Niebla', category: 'cultura', icon: 'fort', points: 200 },
  { id: 's5', name: 'Mercado Fluvial', category: 'gastronomia', icon: 'shopping-cart', points: 80 },
  { id: 's6', name: 'Punucapa', category: 'naturaleza', icon: 'nature-people', points: 180 },
];

const TRAVEL_ROUTES: TravelRoute[] = [
  { id: 'r1', title: 'Ruta de Humedales y Parques', progress: 1, total: 3, unlockedStamps: 1, xpBonus: 300 },
  { id: 'r2', title: 'Patrimonio e Historia Colonial', progress: 1, total: 4, unlockedStamps: 1, xpBonus: 400 },
  { id: 'r3', title: 'Tradición Cervecera y Fluvial', progress: 1, total: 2, unlockedStamps: 1, xpBonus: 200 },
];

export default function PassportScreen() {
  const allStampsCount = UNLOCKED_STAMPS.length + LOCKED_STAMPS.length;
  const totalXp = UNLOCKED_STAMPS.reduce((sum, s) => sum + s.points, 0);

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'gastronomia':
        return '#EF4444'; // Red
      case 'naturaleza':
        return '#10B981'; // Green
      case 'cultura':
        return '#8B5CF6'; // Purple
      default:
        return '#3B82F6'; // Blue
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* TARJETA PASAPORTE VIRTUAL */}
      <View style={styles.passportCard}>
        <View style={styles.cardGlowLeft} />
        <View style={styles.cardGlowRight} />

        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.passportKicker}>PASAPORTE TURÍSTICO</Text>
            <Text style={styles.passportTitle}>Bitácora de Viaje</Text>
          </View>
          <MaterialIcons name="workspace-premium" size={36} color="#6EE7B7" />
        </View>

        {/* STATS RAPIDAS */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{UNLOCKED_STAMPS.length}/{allStampsCount}</Text>
            <Text style={styles.statLbl}>Sellos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{totalXp} XP</Text>
            <Text style={styles.statLbl}>Prestigio</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>Nivel 3</Text>
            <Text style={styles.statLbl}>Rango</Text>
          </View>
        </View>

        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${(UNLOCKED_STAMPS.length / allStampsCount) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>Progreso de Exploración Local</Text>
        </View>
      </View>

      {/* SECCIÓN SELLOS ADQUIRIDOS */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>🏆 Mis Sellos Desbloqueados</Text>
        <Text style={styles.cardSubtitle}>
          Has visitado estos lugares físicamente. Toca un sello para ver tus recuerdos.
        </Text>

        <View style={styles.stampsGrid}>
          {UNLOCKED_STAMPS.map((stamp) => {
            const catColor = getCategoryColor(stamp.category);
            return (
              <TouchableOpacity key={stamp.id} activeOpacity={0.8} style={styles.stampItem}>
                <View style={[styles.stampOuterRing, { borderColor: catColor }]}>
                  <View style={[styles.stampInnerCircle, { backgroundColor: `${catColor}15` }]}>
                    <MaterialIcons name={stamp.icon} size={28} color={catColor} />
                  </View>
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={10} color="#040914" />
                  </View>
                </View>
                <Text numberOfLines={2} style={styles.stampName}>
                  {stamp.name}
                </Text>
                <Text style={styles.stampDate}>{stamp.dateUnlocked}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SECCIÓN SELLOS BLOQUEADOS */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>🔒 Sellos por Descubrir</Text>
        <Text style={styles.cardSubtitle}>
          Realiza Check-In en estos POIs en el mapa cuando estés cerca para desbloquearlos.
        </Text>

        <View style={styles.stampsGrid}>
          {LOCKED_STAMPS.map((stamp) => {
            return (
              <View key={stamp.id} style={[styles.stampItem, { opacity: 0.5 }]}>
                <View style={[styles.stampOuterRing, { borderColor: '#4B5563' }]}>
                  <View style={[styles.stampInnerCircle, { backgroundColor: '#1F2937' }]}>
                    <MaterialIcons name={stamp.icon} size={28} color="#9CA3AF" />
                  </View>
                </View>
                <Text numberOfLines={2} style={[styles.stampName, { color: '#9CA3AF' }]}>
                  {stamp.name}
                </Text>
                <Text style={styles.stampXp}>+{stamp.points} XP</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* RUTAS Y DESAFÍOS */}
      <View style={styles.card}>
        <View style={styles.flexRowBetween}>
          <Text style={styles.cardSectionTitle}>🗺️ Desafíos de Itinerarios</Text>
          <Text style={styles.routeCounter}>3 Activas</Text>
        </View>
        <Text style={styles.cardSubtitle}>Completa grupos temáticos de visitas para obtener bonificaciones de prestigio.</Text>

        <View style={styles.routesList}>
          {TRAVEL_ROUTES.map((route) => {
            const completionPercent = (route.unlockedStamps / route.total) * 100;
            return (
              <View key={route.id} style={styles.routeItem}>
                <View style={styles.flexRowBetween}>
                  <Text style={styles.routeItemTitle}>{route.title}</Text>
                  <Text style={styles.routeItemProgressText}>{route.unlockedStamps}/{route.total}</Text>
                </View>
                <View style={styles.routeBarBg}>
                  <View style={[styles.routeBarFill, { width: `${completionPercent}%` }]} />
                </View>
                <View style={styles.flexRowBetween}>
                  <Text style={styles.routeBonusText}>+{route.xpBonus} XP Bonus</Text>
                  <Text style={styles.routeStatusText}>
                    {route.unlockedStamps === route.total ? 'Completada 🎉' : 'En curso'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 32,
    paddingBottom: 90,
    gap: 24,
    backgroundColor: '#040914',
  },
  passportCard: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(16, 24, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardGlowLeft: {
    position: 'absolute',
    top: -60,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(110, 231, 183, 0.15)', // Emerald
  },
  cardGlowRight: {
    position: 'absolute',
    bottom: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // Blue
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  passportKicker: {
    color: '#6EE7B7',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
    fontWeight: '800',
  },
  passportTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 12,
    marginTop: 20,
    zIndex: 1,
  },
  statItem: {
    alignItems: 'center',
  },
  statVal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statLbl: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressBarWrapper: {
    marginTop: 20,
    zIndex: 1,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#34D399',
    borderRadius: 4,
  },
  progressText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(16, 24, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardSectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  stampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  stampItem: {
    width: '28%',
    alignItems: 'center',
    marginBottom: 8,
  },
  stampOuterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
  },
  stampInnerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#040914',
  },
  stampName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 14,
  },
  stampDate: {
    color: '#9CA3AF',
    fontSize: 9,
    marginTop: 2,
  },
  stampXp: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  flexRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeCounter: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(110,231,183,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  routesList: {
    gap: 16,
  },
  routeItem: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 8,
  },
  routeItemTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  routeItemProgressText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  routeBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  routeBarFill: {
    height: '100%',
    backgroundColor: '#34D399',
    borderRadius: 3,
  },
  routeBonusText: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '700',
  },
  routeStatusText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
  },
});
