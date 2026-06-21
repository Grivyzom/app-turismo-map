import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { CheckInRecord, loadCheckIns } from '../utils/checkInStorage';

// ─── Catálogo de POIs con sellos ─────────────────────────────────────────────

interface LockedStamp {
  id: string;
  name: string;
  category: string;
  icon: string;
  points: number;
}

const ALL_CATALOGUE_STAMPS: LockedStamp[] = [
  {
    id: '1',
    name: 'Muestra Gastronómica Kunstmann',
    category: 'gastronomia',
    icon: 'restaurant',
    points: 100,
  },
  { id: '2', name: 'Exposición Histórica Maele', category: 'cultura', icon: 'museum', points: 120 },
  {
    id: '3',
    name: 'Sendero Lotos en Parque Saval',
    category: 'naturaleza',
    icon: 'park',
    points: 150,
  },
  {
    id: '4',
    name: 'Concierto de Jazz en Esmeralda',
    category: 'musica',
    icon: 'queue-music',
    points: 110,
  },
  {
    id: '5',
    name: 'Regata Universitaria de Remo',
    category: 'deportes',
    icon: 'sports',
    points: 130,
  },
  { id: '6', name: 'Gran Carnaval del Río', category: 'publico', icon: 'groups', points: 80 },
  {
    id: 'ev-new-1',
    name: 'Tarde Recreativa Playa Collico',
    category: 'naturaleza',
    icon: 'beach-access',
    points: 150,
  },
  {
    id: 'ev-new-2',
    name: 'Exposición MAC Valdivia',
    category: 'cultura',
    icon: 'museum',
    points: 120,
  },
  {
    id: 'ev-new-3',
    name: 'Folk Acústico Robles Prochelle',
    category: 'musica',
    icon: 'mic',
    points: 110,
  },
  {
    id: 'ev-new-4',
    name: 'Observación Aves Humedal',
    category: 'naturaleza',
    icon: 'park',
    points: 150,
  },
  {
    id: 'ev-new-5',
    name: 'Feria Costumbrista de Niebla',
    category: 'gastronomia',
    icon: 'restaurant',
    points: 100,
  },
  {
    id: 'music-new-1',
    name: 'Sunset Electrónico Helipuerto',
    category: 'musica',
    icon: 'headset',
    points: 110,
  },
  {
    id: 'music-new-2',
    name: 'Valdivia Rock Festival',
    category: 'musica',
    icon: 'album',
    points: 110,
  },
];

interface TravelRoute {
  id: string;
  title: string;
  stampIds: string[];
  xpBonus: number;
}

const TRAVEL_ROUTES: TravelRoute[] = [
  {
    id: 'r1',
    title: 'Ruta de Humedales y Parques',
    stampIds: ['3', 'ev-new-1', 'ev-new-4'],
    xpBonus: 300,
  },
  {
    id: 'r2',
    title: 'Patrimonio e Historia Colonial',
    stampIds: ['2', 'ev-new-2', '6', 'ev-new-5'],
    xpBonus: 400,
  },
  {
    id: 'r3',
    title: 'Tradición Musical de Valdivia',
    stampIds: ['4', 'ev-new-3', 'music-new-1'],
    xpBonus: 200,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryColor(cat: string): string {
  switch (cat.toLowerCase()) {
    case 'gastronomia':
      return '#F59E0B';
    case 'naturaleza':
      return '#10B981';
    case 'cultura':
      return '#8B5CF6';
    case 'musica':
      return '#EC4899';
    case 'deportes':
      return '#06B6D4';
    case 'publico':
      return '#FBBF24';
    default:
      return '#3B82F6';
  }
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function levelFromXp(xp: number): { level: number; label: string } {
  if (xp >= 1000) return { level: 5, label: 'Maestro Local' };
  if (xp >= 600) return { level: 4, label: 'Explorador Pro' };
  if (xp >= 300) return { level: 3, label: 'Viajero' };
  if (xp >= 100) return { level: 2, label: 'Iniciado' };
  return { level: 1, label: 'Curioso' };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PassportScreen() {
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const records = await loadCheckIns();
    setCheckIns(records);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unlockedIds = new Set(checkIns.map((r) => r.eventId));
  const lockedStamps = ALL_CATALOGUE_STAMPS.filter((s) => !unlockedIds.has(s.id));
  const totalXp = checkIns.reduce((sum, r) => sum + r.pointsEarned, 0);
  const allCount = ALL_CATALOGUE_STAMPS.length;
  const { level, label: levelLabel } = levelFromXp(totalXp);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#34D399" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── TARJETA PASAPORTE VIRTUAL ── */}
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

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>
              {checkIns.length}/{allCount}
            </Text>
            <Text style={styles.statLbl}>Sellos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{totalXp} XP</Text>
            <Text style={styles.statLbl}>Prestigio</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>Nv. {level}</Text>
            <Text style={styles.statLbl}>{levelLabel}</Text>
          </View>
        </View>

        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${(checkIns.length / allCount) * 100}%` as any },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {checkIns.length === 0
              ? 'Realiza tu primer Check-in para comenzar'
              : `${Math.round((checkIns.length / allCount) * 100)}% de exploración completada`}
          </Text>
        </View>
      </View>

      {/* ── SELLOS DESBLOQUEADOS ── */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Mis Sellos Desbloqueados</Text>
        <Text style={styles.cardSubtitle}>
          Lugares que has visitado físicamente con check-in geográfico verificado.
        </Text>

        {checkIns.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={44} color="#1F2937" />
            <Text style={styles.emptyTitle}>Sin sellos todavía</Text>
            <Text style={styles.emptySubtitle}>
              Selecciona un pin en el mapa, acércate al lugar y toca{' '}
              <Text style={{ color: '#34D399', fontWeight: '700' }}>"Check-in"</Text> para
              desbloquear tu primer sello.
            </Text>
          </View>
        ) : (
          <View style={styles.stampsGrid}>
            {checkIns.map((record) => {
              const catColor = getCategoryColor(record.category);
              return (
                <TouchableOpacity key={record.eventId} activeOpacity={0.8} style={styles.stampItem}>
                  <View style={[styles.stampOuterRing, { borderColor: catColor }]}>
                    <View style={[styles.stampInnerCircle, { backgroundColor: `${catColor}18` }]}>
                      <MaterialIcons name={record.icon as any} size={26} color={catColor} />
                    </View>
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={10} color="#040914" />
                    </View>
                  </View>
                  <Text numberOfLines={2} style={styles.stampName}>
                    {record.eventTitle}
                  </Text>
                  <Text style={styles.stampDate}>{formatShortDate(record.checkedInAt)}</Text>
                  <Text style={styles.stampXpGained}>+{record.pointsEarned} XP</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* ── SELLOS BLOQUEADOS ── */}
      {lockedStamps.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Sellos por Descubrir</Text>
          <Text style={styles.cardSubtitle}>
            Acércate a estos lugares y realiza Check-In para desbloquearlos.
          </Text>

          <View style={styles.stampsGrid}>
            {lockedStamps.map((stamp) => (
              <View key={stamp.id} style={[styles.stampItem, { opacity: 0.45 }]}>
                <View style={[styles.stampOuterRing, { borderColor: '#374151' }]}>
                  <View style={[styles.stampInnerCircle, { backgroundColor: '#111827' }]}>
                    <MaterialIcons name={stamp.icon as any} size={26} color="#4B5563" />
                  </View>
                </View>
                <Text numberOfLines={2} style={[styles.stampName, { color: '#6B7280' }]}>
                  {stamp.name}
                </Text>
                <Text style={styles.stampXp}>+{stamp.points} XP</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── RUTAS Y DESAFÍOS ── */}
      <View style={styles.card}>
        <View style={styles.flexRowBetween}>
          <Text style={styles.cardSectionTitle}>Desafíos de Itinerarios</Text>
          <Text style={styles.routeCounter}>
            {TRAVEL_ROUTES.filter((r) => r.stampIds.every((id) => unlockedIds.has(id))).length}/
            {TRAVEL_ROUTES.length} Activas
          </Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Completa grupos temáticos de visitas para obtener bonificaciones de prestigio.
        </Text>

        <View style={styles.routesList}>
          {TRAVEL_ROUTES.map((route) => {
            const unlockedInRoute = route.stampIds.filter((id) => unlockedIds.has(id)).length;
            const completionPct = (unlockedInRoute / route.stampIds.length) * 100;
            const isCompleted = unlockedInRoute === route.stampIds.length;
            return (
              <View key={route.id} style={styles.routeItem}>
                <View style={styles.flexRowBetween}>
                  <Text style={styles.routeItemTitle}>{route.title}</Text>
                  <Text style={styles.routeItemProgressText}>
                    {unlockedInRoute}/{route.stampIds.length}
                  </Text>
                </View>
                <View style={styles.routeBarBg}>
                  <View style={[styles.routeBarFill, { width: `${completionPct}%` as any }]} />
                </View>
                <View style={styles.flexRowBetween}>
                  <Text style={styles.routeBonusText}>+{route.xpBonus} XP Bonus</Text>
                  <Text style={styles.routeStatusText}>
                    {isCompleted ? 'Completada' : 'En curso'}
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

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    paddingTop: 32,
    paddingBottom: 90,
    gap: 24,
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(110, 231, 183, 0.15)',
  },
  cardGlowRight: {
    position: 'absolute',
    bottom: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  passportKicker: {
    color: '#6EE7B7',
    textTransform: 'uppercase' as const,
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
  statItem: { alignItems: 'center' },
  statVal: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  statLbl: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressBarWrapper: { marginTop: 20, zIndex: 1 },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#34D399', borderRadius: 4 },
  progressText: { color: '#9CA3AF', fontSize: 11, marginTop: 6, textAlign: 'center' },
  card: {
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(16, 24, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardSectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  cardSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyTitle: { color: '#374151', fontSize: 16, fontWeight: '700' },
  emptySubtitle: {
    color: '#374151',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  stampsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'flex-start' },
  stampItem: { width: '28%', alignItems: 'center', marginBottom: 8 },
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
  stampDate: { color: '#9CA3AF', fontSize: 9, marginTop: 2 },
  stampXpGained: { color: '#34D399', fontSize: 10, fontWeight: '700', marginTop: 2 },
  stampXp: { color: '#4ADE80', fontSize: 10, fontWeight: '700', marginTop: 2 },
  flexRowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeCounter: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(110,231,183,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  routesList: { gap: 16 },
  routeItem: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 8,
  },
  routeItemTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  routeItemProgressText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600' },
  routeBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  routeBarFill: { height: '100%', backgroundColor: '#34D399', borderRadius: 3 },
  routeBonusText: { color: '#6EE7B7', fontSize: 10, fontWeight: '700' },
  routeStatusText: { color: '#9CA3AF', fontSize: 10, fontWeight: '600' },
});
