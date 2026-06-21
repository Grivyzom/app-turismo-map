import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import {
  getAdminTokenAsync,
  getAdminUserAsync,
  clearAdminAuthAsync,
} from '../../../src/utils/adminAuthStorage';

interface AuditLog {
  id: number;
  admin_id: number;
  admin_name?: string;
  action: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [isAdminLoaded, setIsAdminLoaded] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  // Estados de KPIs
  const [kpis, setKpis] = useState<any>(null);
  const [isLoadingKpis, setIsLoadingKpis] = useState(false);
  const [kpisError, setKpisError] = useState('');

  // Estados de Tendencias
  const [trends, setTrends] = useState<any>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [trendsError, setTrendsError] = useState('');

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const token = await getAdminTokenAsync();
      const user = await getAdminUserAsync();

      if (!token || !user) {
        // Redirigir a la nueva ruta /admin/login/ si no está autenticado
        router.replace('/admin/login/');
        return;
      }

      // Restricción de acceso: Solo 'superadmin' y 'admin' tienen permitido el acceso al panel.
      // Si el rol es moderador u otro tipo de cuenta, se deniega el acceso.
      if (user.role !== 'superadmin' && user.role !== 'admin') {
        setAccessDenied(true);
        setIsAdminLoaded(true);
        return;
      }

      setAdminUser(user);
      setIsAdminLoaded(true);

      // Cargar logs de auditoría, KPIs y Tendencias
      fetchAuditLogs(token);
      fetchKPIs(token);
      fetchTrends(token);
    };

    checkAuthAndLoad();
  }, []);

  const fetchTrends = async (token: string) => {
    setIsLoadingTrends(true);
    setTrendsError('');
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(`${backendUrl}/admin/api/v1/trends`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('No se pudieron obtener las tendencias globales.');
      }

      const data = await response.json();
      setTrends(data);
    } catch (err: any) {
      console.error('Error al obtener tendencias:', err);
      setTrendsError(err.message || 'Error al conectar con la API de tendencias.');
    } finally {
      setIsLoadingTrends(false);
    }
  };

  const fetchKPIs = async (token: string) => {
    setIsLoadingKpis(true);
    setKpisError('');
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(`${backendUrl}/admin/api/v1/kpis`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('No se pudieron obtener los KPIs del sistema.');
      }

      const data = await response.json();
      setKpis(data);
    } catch (err: any) {
      console.error('Error al obtener KPIs:', err);
      setKpisError(err.message || 'Error al conectar con la API de KPIs.');
    } finally {
      setIsLoadingKpis(false);
    }
  };

  const fetchAuditLogs = async (token: string) => {
    setIsLoadingLogs(true);
    setLogsError('');
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(`${backendUrl}/admin/api/v1/audit-log`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('No se pudieron obtener los logs de auditoría.');
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setLogs(data);
      } else if (data && Array.isArray(data.logs)) {
        setLogs(data.logs);
      } else {
        setLogs([]);
      }
    } catch (err: any) {
      console.error('Error al obtener logs:', err);
      setLogsError(err.message || 'Error al conectar con la API de logs.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSignOut = async () => {
    await clearAdminAuthAsync();
    router.replace('/admin/login/');
  };

  if (!isAdminLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Verificando credenciales del sistema...</Text>
      </View>
    );
  }

  // Vista de Acceso Denegado para usuarios no autorizados (Moderadores u otros)
  if (accessDenied) {
    return (
      <View style={styles.deniedContainer}>
        <View style={styles.deniedCard}>
          <View style={styles.deniedIconWrapper}>
            <MaterialIcons name="gavel" size={48} color="#ef4444" />
          </View>
          <Text style={styles.deniedTitle}>Acceso Restringido</Text>
          <Text style={styles.deniedText}>
            Tu cuenta de usuario no dispone de los privilegios necesarios de nivel jerárquico
            ('superadmin' o 'admin') para visualizar esta consola.
          </Text>
          <TouchableOpacity style={styles.deniedBtn} onPress={handleSignOut}>
            <Text style={styles.deniedBtnText}>Volver al Portal</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderLogItem = ({ item }: { item: AuditLog }) => {
    const date = new Date(item.created_at).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <View style={styles.logActionWrapper}>
            <MaterialIcons name="event-note" size={16} color="#3b82f6" />
            <Text style={styles.logAction}>{item.action}</Text>
          </View>
          <Text style={styles.logDate}>{date}</Text>
        </View>

        <View style={styles.logDetails}>
          <View style={styles.detailRow}>
            <MaterialIcons name="person" size={14} color="#9ca3af" />
            <Text style={styles.detailText}>
              Admin ID: <Text style={styles.boldText}>{item.admin_id}</Text>
            </Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="dns" size={14} color="#9ca3af" />
            <Text style={styles.detailText}>IP: {item.ip_address}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="devices" size={14} color="#9ca3af" style={styles.detailIcon} />
            <Text style={styles.detailText} numberOfLines={1}>
              Dispositivo: {item.user_agent}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Premium */}
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View style={styles.securityIcon}>
            <MaterialIcons name="admin-panel-settings" size={24} color="#fff" />
          </View>
          <View>
            <Text style={styles.topBarTitle}>Consola de Seguridad</Text>
            <Text style={styles.topBarSubtitle}>TurismoMap Admin Panel</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
          <MaterialIcons name="logout" size={20} color="#ff4a4a" />
          <Text style={styles.logoutBtnText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Fila de Perfil del Admin */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {adminUser?.name?.charAt(0).toUpperCase() || 'A'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.adminName}>{adminUser?.name}</Text>
            <Text style={styles.adminEmail}>{adminUser?.email}</Text>
            <View style={styles.badgeContainer}>
              <View
                style={[
                  styles.roleBadge,
                  adminUser?.role === 'superadmin' ? styles.superAdminBadge : styles.adminBadge,
                ]}
              >
                <Text style={styles.roleText}>{adminUser?.role?.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sección de Indicadores Clave de Rendimiento (KPIs) */}
        <View style={styles.kpiSection}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>Indicadores de Rendimiento (KPIs)</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={async () => {
                const token = await getAdminTokenAsync();
                if (token) fetchKPIs(token);
              }}
              disabled={isLoadingKpis}
            >
              <MaterialIcons name="refresh" size={18} color="#3b82f6" />
              <Text style={styles.refreshBtnText}>Sincronizar</Text>
            </TouchableOpacity>
          </View>

          {isLoadingKpis ? (
            <View style={styles.centerSpinner}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingLogsText}>Cargando estadísticas de uso...</Text>
            </View>
          ) : kpisError ? (
            <View style={styles.errorLogsBox}>
              <MaterialIcons name="warning" size={24} color="#ff4a4a" />
              <Text style={styles.errorLogsText}>{kpisError}</Text>
            </View>
          ) : kpis ? (
            <View style={styles.kpiGridContainer}>
              {/* Tarjetas Principales */}
              <View style={styles.kpiGrid}>
                <View style={[styles.kpiCard, styles.kpiCardBlue]}>
                  <View style={styles.kpiCardHeader}>
                    <Text style={styles.kpiLabel}>Usuarios Totales</Text>
                    <MaterialIcons name="people" size={20} color="#3b82f6" />
                  </View>
                  <Text style={styles.kpiValue}>{kpis.totalUsers}</Text>
                  <Text style={styles.kpiSubtext}>Registrados en la plataforma</Text>
                </View>

                <View style={[styles.kpiCard, styles.kpiCardGreen]}>
                  <View style={styles.kpiCardHeader}>
                    <Text style={styles.kpiLabel}>Usuarios Activos</Text>
                    <MaterialIcons name="person-add" size={20} color="#22c55e" />
                  </View>
                  <Text style={styles.kpiValue}>{kpis.activeUsers}</Text>
                  <Text style={styles.kpiSubtext}>Cuentas operacionales</Text>
                </View>

                <View style={[styles.kpiCard, styles.kpiCardPurple]}>
                  <View style={styles.kpiCardHeader}>
                    <Text style={styles.kpiLabel}>Nuevos (7 Días)</Text>
                    <MaterialIcons name="trending-up" size={20} color="#a855f7" />
                  </View>
                  <Text style={styles.kpiValue}>{kpis.registeredLast7Days}</Text>
                  <Text style={styles.kpiSubtext}>Ingresos la última semana</Text>
                </View>

                <View style={[styles.kpiCard, styles.kpiCardOrange]}>
                  <View style={styles.kpiCardHeader}>
                    <Text style={styles.kpiLabel}>Nuevos (30 Días)</Text>
                    <MaterialIcons name="calendar-today" size={20} color="#f97316" />
                  </View>
                  <Text style={styles.kpiValue}>{kpis.registeredLast30Days}</Text>
                  <Text style={styles.kpiSubtext}>Ingresos el último mes</Text>
                </View>
              </View>

              {/* Sub-Sección de Distribuciones */}
              <View style={styles.distributionContainer}>
                {/* Distribución por Tipo */}
                <View style={styles.distCard}>
                  <Text style={styles.distTitle}>Tipos de Usuario</Text>
                  <View style={styles.distContent}>
                    {Object.entries(kpis.userTypes || {}).map(([type, count]: [string, any]) => {
                      const total = kpis.totalUsers || 1;
                      const percentage = Math.round((count / total) * 100);
                      const displayType =
                        type === 'citizen'
                          ? 'Ciudadano'
                          : type === 'partner_owner'
                            ? 'Partner Owner'
                            : type;
                      return (
                        <View key={type} style={styles.distRow}>
                          <View style={styles.distRowLabels}>
                            <Text style={styles.distName}>{displayType}</Text>
                            <Text style={styles.distValue}>
                              {count} ({percentage}%)
                            </Text>
                          </View>
                          <View style={styles.progressBarBg}>
                            <View
                              style={[
                                styles.progressBarFill,
                                { width: `${percentage}%`, backgroundColor: '#3b82f6' },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Distribución por Estado */}
                <View style={styles.distCard}>
                  <Text style={styles.distTitle}>Estados de Cuentas</Text>
                  <View style={styles.distContent}>
                    {Object.entries(kpis.userStatuses || {}).map(
                      ([status, count]: [string, any]) => {
                        const total = kpis.totalUsers || 1;
                        const percentage = Math.round((count / total) * 100);
                        const displayStatus =
                          status === 'active'
                            ? 'Activo'
                            : status === 'pending'
                              ? 'Pendiente'
                              : status === 'suspended'
                                ? 'Suspendido'
                                : status;
                        const color =
                          status === 'active'
                            ? '#22c55e'
                            : status === 'pending'
                              ? '#eab308'
                              : '#ef4444';
                        return (
                          <View key={status} style={styles.distRow}>
                            <View style={styles.distRowLabels}>
                              <Text style={styles.distName}>{displayStatus}</Text>
                              <Text style={styles.distValue}>
                                {count} ({percentage}%)
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${percentage}%`, backgroundColor: color },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      },
                    )}
                  </View>
                </View>
              </View>

              {/* Estadísticas de Entidades del Sistema */}
              <View style={styles.entityStatsRow}>
                <View style={styles.entityStatItem}>
                  <MaterialIcons name="business" size={18} color="#9ca3af" />
                  <Text style={styles.entityStatText}>
                    Empresas registradas: <Text style={styles.boldText}>{kpis.totalCompanies}</Text>
                  </Text>
                </View>
                <View style={styles.entityStatItem}>
                  <MaterialIcons name="event" size={18} color="#9ca3af" />
                  <Text style={styles.entityStatText}>
                    Eventos creados: <Text style={styles.boldText}>{kpis.totalEvents}</Text>
                  </Text>
                </View>
                <View style={styles.entityStatItem}>
                  <MaterialIcons name="report" size={18} color="#9ca3af" />
                  <Text style={styles.entityStatText}>
                    Reportes ciudadanos: <Text style={styles.boldText}>{kpis.totalReports}</Text>
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* Sección de Tendencias Globales (Algoritmo de Análisis de Preferencias) */}
        <View style={styles.kpiSection}>
          <View style={styles.sectionHeaderContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons
                name="analytics"
                size={20}
                color="#8b5cf6"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.sectionTitle}>Tendencias Globales de Usuarios</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={async () => {
                const token = await getAdminTokenAsync();
                if (token) fetchTrends(token);
              }}
              disabled={isLoadingTrends}
            >
              <MaterialIcons name="refresh" size={18} color="#3b82f6" />
              <Text style={styles.refreshBtnText}>Analizar</Text>
            </TouchableOpacity>
          </View>

          {isLoadingTrends ? (
            <View style={styles.centerSpinner}>
              <ActivityIndicator size="large" color="#8b5cf6" />
              <Text style={styles.loadingLogsText}>Analizando preferencias de usuarios...</Text>
            </View>
          ) : trendsError ? (
            <View style={styles.errorLogsBox}>
              <MaterialIcons name="warning" size={24} color="#ff4a4a" />
              <Text style={styles.errorLogsText}>{trendsError}</Text>
            </View>
          ) : trends ? (
            <View style={styles.kpiGridContainer}>
              <View style={styles.distributionContainer}>
                {/* Categorías más Populares */}
                <View style={styles.distCard}>
                  <Text style={styles.distTitle}>Top Categorías de Interés</Text>
                  <View style={styles.distContent}>
                    {trends.topCategories?.length > 0 ? (
                      trends.topCategories.map((ct: any) => {
                        const total = trends.totalWithPreferences || 1;
                        const percentage = Math.round((ct.count / total) * 100);
                        return (
                          <View key={ct.category} style={styles.distRow}>
                            <View style={styles.distRowLabels}>
                              <Text style={styles.distName}>{ct.category}</Text>
                              <Text style={styles.distValue}>
                                {ct.count} ({percentage}%)
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${percentage}%`, backgroundColor: '#8b5cf6' },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyLogsText}>No hay datos de categorías aún.</Text>
                    )}
                  </View>
                </View>

                {/* Estilos de Viaje */}
                <View style={styles.distCard}>
                  <Text style={styles.distTitle}>Estilos de Viaje</Text>
                  <View style={styles.distContent}>
                    {Object.entries(trends.travelStyles || {}).map(
                      ([style, count]: [string, any]) => {
                        const total = trends.totalWithPreferences || 1;
                        const percentage = Math.round((count / total) * 100);
                        return (
                          <View key={style} style={styles.distRow}>
                            <View style={styles.distRowLabels}>
                              <Text style={styles.distName}>{style}</Text>
                              <Text style={styles.distValue}>
                                {count} ({percentage}%)
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${percentage}%`, backgroundColor: '#3b82f6' },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      },
                    )}
                  </View>
                </View>

                {/* Duración de Estadía */}
                <View style={styles.distCard}>
                  <Text style={styles.distTitle}>Duración de Estadía Preferida</Text>
                  <View style={styles.distContent}>
                    {Object.entries(trends.stayDurations || {}).map(
                      ([dur, count]: [string, any]) => {
                        const total = trends.totalWithPreferences || 1;
                        const percentage = Math.round((count / total) * 100);
                        return (
                          <View key={dur} style={styles.distRow}>
                            <View style={styles.distRowLabels}>
                              <Text style={styles.distName}>{dur}</Text>
                              <Text style={styles.distValue}>
                                {count} ({percentage}%)
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${percentage}%`, backgroundColor: '#22c55e' },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      },
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.entityStatsRow}>
                <View style={styles.entityStatItem}>
                  <MaterialIcons name="assignment-ind" size={18} color="#9ca3af" />
                  <Text style={styles.entityStatText}>
                    Perfiles con preferencias:{' '}
                    <Text style={styles.boldText}>{trends.totalWithPreferences}</Text>
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* Sección de Logs de Auditoría */}
        <View style={styles.logsSection}>
          <View style={styles.logsHeaderContainer}>
            <Text style={styles.logsTitle}>Registro de Auditoría (Audit Logs)</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={async () => {
                const token = await getAdminTokenAsync();
                if (token) fetchAuditLogs(token);
              }}
            >
              <MaterialIcons name="refresh" size={18} color="#3b82f6" />
              <Text style={styles.refreshBtnText}>Actualizar</Text>
            </TouchableOpacity>
          </View>

          {isLoadingLogs ? (
            <View style={styles.centerSpinner}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingLogsText}>Consultando logs de auditoría...</Text>
            </View>
          ) : logsError ? (
            <View style={styles.errorLogsBox}>
              <MaterialIcons name="warning" size={24} color="#ff4a4a" />
              <Text style={styles.errorLogsText}>{logsError}</Text>
            </View>
          ) : logs.length === 0 ? (
            <View style={styles.emptyLogsBox}>
              <MaterialIcons name="folder-open" size={32} color="#6b7280" />
              <Text style={styles.emptyLogsText}>
                No se registran eventos de auditoría en la base de datos.
              </Text>
            </View>
          ) : (
            <FlatList
              data={logs}
              renderItem={renderLogItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              style={styles.logsList}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 15,
    fontSize: 15,
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  deniedCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 30,
    alignItems: 'center',
  },
  deniedIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 10,
    textAlign: 'center',
  },
  deniedText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 25,
  },
  deniedBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  deniedBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  topBar: {
    height: 70,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)' as any,
      },
    }),
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  topBarSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  logoutBtnText: {
    color: '#ff4a4a',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollContent: {
    padding: 20,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    marginBottom: 25,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  roleBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  superAdminBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  adminBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  roleText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  logsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
  },
  logsHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 12,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#3b82f6',
    fontSize: 13,
    marginLeft: 4,
    fontWeight: '600',
  },
  centerSpinner: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingLogsText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 10,
  },
  errorLogsBox: {
    paddingVertical: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  errorLogsText: {
    color: '#ff6b6b',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyLogsBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyLogsText: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  logsList: {
    width: '100%',
  },
  logCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 15,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logActionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logAction: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  logDate: {
    color: '#6b7280',
    fontSize: 11,
  },
  logDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.03)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 100,
  },
  detailIcon: {
    marginTop: 1,
  },
  detailText: {
    color: '#9ca3af',
    fontSize: 12,
    marginLeft: 6,
  },
  boldText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  kpiSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    marginBottom: 25,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  kpiGridContainer: {
    width: '100%',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    padding: 15,
  },
  kpiCardBlue: {
    borderColor: 'rgba(59, 130, 246, 0.15)',
    backgroundColor: 'rgba(59, 130, 246, 0.02)',
  },
  kpiCardGreen: {
    borderColor: 'rgba(34, 197, 94, 0.15)',
    backgroundColor: 'rgba(34, 197, 94, 0.02)',
  },
  kpiCardPurple: {
    borderColor: 'rgba(168, 85, 247, 0.15)',
    backgroundColor: 'rgba(168, 85, 247, 0.02)',
  },
  kpiCardOrange: {
    borderColor: 'rgba(249, 115, 22, 0.15)',
    backgroundColor: 'rgba(249, 115, 22, 0.02)',
  },
  kpiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  kpiSubtext: {
    fontSize: 10,
    color: '#6b7280',
  },
  distributionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 20,
  },
  distCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
  },
  distTitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  distContent: {
    gap: 12,
  },
  distRow: {
    width: '100%',
  },
  distRowLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  distName: {
    fontSize: 12,
    color: '#9ca3af',
  },
  distValue: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  entityStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: 10,
  },
  entityStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entityStatText: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 6,
  },
});
