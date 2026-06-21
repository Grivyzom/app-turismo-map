import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useAuth } from '../../src/context/AuthContext';
import { loadUserProfile, type NormalUserProfile } from '../../src/utils/userProfileStorage';

// ─── Colores del portal empresarial ──────────────────────────────────────────
const GREEN = '#1a4335';
const GREEN_LIGHT = '#e8f5e9';
const NAVY = '#002d20';

export default function BusinessDashboardScreen() {
  const { signOut } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<NormalUserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    void loadUserProfile().then((p) => {
      setProfile(p);
      setIsLoadingProfile(false);
    });
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.replace('/business/ingresar');
  };

  const displayName = profile?.fullName ?? 'Mi Empresa';
  const userType = profile?.userType ?? 'partner_owner';
  const entityType = profile?.entityType ?? 'business';

  // ─── Estadísticas ficticias (placeholder hasta conectar API) ─────────────────
  const STATS = [
    { label: 'Check-ins', value: '—', icon: 'location-on' },
    { label: 'Eventos', value: '—', icon: 'event' },
    { label: 'Votos', value: '—', icon: 'thumb-up' },
  ];

  // ─── Acciones según tipo de usuario ──────────────────────────────────────────
  const ALL_ACTIONS = [
    {
      label: 'Crear Evento',
      icon: 'add-circle-outline',
      route: '/business/create-event',
      roles: ['partner_owner', 'partner_manager', 'partner_worker', 'partner_staff'],
    },
    {
      label: 'Sucursales',
      icon: 'store',
      route: '/business/branches',
      roles: ['partner_owner', 'partner_manager'],
      hideForIndependent: true,
    },
    {
      label: entityType === 'independent' ? 'Mi Ubicación' : 'Geolocalizar',
      icon: 'my-location',
      route: '/business/geolocalizar',
      roles: ['partner_owner', 'partner_manager'],
    },
    {
      label: 'Delimitar Zonas',
      icon: 'map',
      route: '/business/delimitar-zonas',
      roles: ['partner_owner', 'partner_manager'],
    },
    {
      label: 'Personal',
      icon: 'group',
      route: '/business/team',
      roles: ['partner_owner', 'partner_manager'],
      hideForIndependent: true,
      hideForSME: true, // PYMEs are single-person
    },
    {
      label: 'Estadísticas',
      icon: 'bar-chart',
      route: '/business/stats',
      roles: ['partner_owner', 'partner_manager'],
    },
    {
      label: 'Configuración',
      icon: 'settings',
      route: '/business/settings',
      roles: ['partner_owner'],
    },
    {
      label: 'Check-ins',
      icon: 'how-to-reg',
      route: '/business/checkins',
      roles: ['partner_owner', 'partner_manager', 'partner_worker', 'partner_staff'],
    },
  ];

  const visibleActions = ALL_ACTIONS.filter((a) => {
    if (!a.roles.includes(userType)) return false;
    if (entityType === 'independent' && (a as any).hideForIndependent) return false;
    if (entityType === 'sme' && (a as any).hideForSME) return false;
    return true;
  });

  // SSR Guard para evitar hydration mismatches
  if (!isMounted || isLoadingProfile) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f8f9fa',
        }}
      >
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerLabel}>
              {entityType === 'independent' ? 'Perfil Independiente' : entityType === 'sme' ? 'Perfil PYME' : 'Panel de Control Corporativo'}
            </Text>
            <Text style={styles.headerTitle}>{displayName}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{ROLE_LABELS[userType] ?? userType}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialIcons name="logout" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <MaterialIcons name={stat.icon as any} size={20} color="rgba(255,255,255,0.9)" />
              {stat.value === '—' ? (
                <View style={styles.statSkeleton} />
              ) : (
                <Text style={styles.statValue}>{stat.value}</Text>
              )}
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Acciones rápidas */}
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        <View style={styles.actionsGrid}>
          {visibleActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionCard}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.75}
            >
              <View style={styles.actionIcon}>
                <MaterialIcons name={action.icon as any} size={26} color={GREEN} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Estado de verificación */}
        <View style={styles.verificationCard}>
          <View style={styles.verificationIcon}>
            <MaterialIcons name="info" size={22} color={GREEN} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.verificationTitle}>Estado de verificación</Text>
            <Text style={styles.verificationText}>
              Tu cuenta está en proceso de revisión por el equipo de Valdivia.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom Nav ── */}
      <View style={styles.bottomNav}>
        <NavItem icon="dashboard" label="Panel" active />
        <NavItem icon="list-alt" label="Órdenes" />
        <NavItem icon="notifications-none" label="Alertas" />
        <NavItem icon="person-outline" label="Perfil" />
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  partner_owner: 'Propietario',
  partner_manager: 'Gerente',
  partner_worker: 'Personal',
  partner_staff: 'Personal',
  admin: 'Administrador',
};

function NavItem({
  icon,
  label,
  active = false,
}: {
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.navItem}>
      <MaterialIcons name={icon as any} size={24} color={active ? GREEN : '#9ca3af'} />
      <Text style={[styles.navLabel, active && { color: GREEN, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'web' ? 0 : 0,
  },
  // Header
  header: {
    backgroundColor: GREEN,
    paddingTop: Platform.OS === 'web' ? 32 : 56,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(26,67,53,0.25)' },
      ios: {
        shadowColor: GREEN,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  } as any,
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  roleBadgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  logoutBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statSkeleton: {
    width: 32,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginVertical: 2,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 8 },
  sectionTitle: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  // Actions grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  actionCard: {
    backgroundColor: '#ffffff',
    width: '47%',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(0,45,32,0.06)', cursor: 'pointer' },
      ios: {
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  } as any,
  actionIcon: {
    width: 48,
    height: 48,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    color: NAVY,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Verification
  verificationCard: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  verificationIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationTitle: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  verificationText: {
    color: `${GREEN}99`,
    fontSize: 12,
    lineHeight: 16,
  },
  // Bottom nav
  bottomNav: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'web' ? 16 : 28,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f4',
    ...Platform.select({
      web: { boxShadow: '0 -2px 12px rgba(0,0,0,0.04)' },
    }),
  } as any,
  navItem: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
  },
  navLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },
});
