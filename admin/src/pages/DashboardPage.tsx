import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserCheck,
  UserPlus,
  Building2,
  Calendar,
  Flag,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Compass,
  Clock,
  Heart,
  Flame,
  WifiOff,
  MapPin,
  Activity,
} from 'lucide-react'
import { api } from '../lib/api'

interface Hotspot {
  zone: string
  count: number
}

interface KPIs {
  totalUsers: number
  activeUsers: number
  registeredLast7Days: number
  registeredLast30Days: number
  userTypes: Record<string, number>
  userStatuses: Record<string, number>
  totalCompanies: number
  totalEvents: number
  totalReports: number
  hotspots: Hotspot[]
  avgActivityTime: number
  offlineUsageRate: number
}

interface TrendCategory {
  category: string
  count: number
}

interface Trends {
  topCategories: TrendCategory[]
  travelStyles: Record<string, number>
  stayDurations: Record<string, number>
  profileTypes: Record<string, number>
  totalWithPreferences: number
}

interface KPIResponse {
  success: boolean
  totalUsers: number
  activeUsers: number
  registeredLast7Days: number
  registeredLast30Days: number
  userTypes: Record<string, number>
  userStatuses: Record<string, number>
  totalCompanies: number
  totalEvents: number
  totalReports: number
  hotspots: Hotspot[]
  avgActivityTime: number
  offlineUsageRate: number
}

interface TrendsResponse {
  success: boolean
  topCategories: TrendCategory[]
  travelStyles: Record<string, number>
  stayDurations: Record<string, number>
  profileTypes: Record<string, number>
  totalWithPreferences: number
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('es-ES')
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function KPICardSkeleton() {
  return (
    <div className="dashboard-card dashboard-card-skeleton">
      <div className="dashboard-card-icon skeleton-pulse" />
      <div className="dashboard-card-value skeleton-pulse skeleton-text-lg" />
      <div className="dashboard-card-label skeleton-pulse skeleton-text-sm" />
    </div>
  )
}

function TrendsSkeleton() {
  return (
    <div className="dashboard-trends">
      <div className="dashboard-trends-section">
        <div className="skeleton-pulse skeleton-text-md" style={{ width: '200px', marginBottom: '16px' }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="dashboard-bar" style={{ marginBottom: '12px' }}>
            <div className="skeleton-pulse skeleton-text-sm" style={{ width: '120px' }} />
            <div className="skeleton-pulse" style={{ height: '8px', borderRadius: '4px', marginTop: '6px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [trends, setTrends] = useState<Trends | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const [kpiRes, trendsRes] = await Promise.all([
        api.get<KPIResponse>('/admin/api/v1/kpis'),
        api.get<TrendsResponse>('/admin/api/v1/trends'),
      ])

      setKpis({
        totalUsers: kpiRes.totalUsers,
        activeUsers: kpiRes.activeUsers,
        registeredLast7Days: kpiRes.registeredLast7Days,
        registeredLast30Days: kpiRes.registeredLast30Days,
        userTypes: kpiRes.userTypes,
        userStatuses: kpiRes.userStatuses,
        totalCompanies: kpiRes.totalCompanies,
        totalEvents: kpiRes.totalEvents,
        totalReports: kpiRes.totalReports,
        hotspots: kpiRes.hotspots || [],
        avgActivityTime: kpiRes.avgActivityTime || 0,
        offlineUsageRate: kpiRes.offlineUsageRate || 0,
      })

      setTrends({
        topCategories: trendsRes.topCategories,
        travelStyles: trendsRes.travelStyles,
        stayDurations: trendsRes.stayDurations,
        profileTypes: trendsRes.profileTypes,
        totalWithPreferences: trendsRes.totalWithPreferences,
      })

      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos del dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const kpiCards = kpis
    ? [
        { icon: Users, label: 'Total Usuarios', value: kpis.totalUsers, accent: 'cyan' },
        { icon: UserCheck, label: 'Usuarios Activos', value: kpis.activeUsers, accent: 'green' },
        { icon: UserPlus, label: 'Registros (7d)', value: kpis.registeredLast7Days, accent: 'teal' },
        { icon: UserPlus, label: 'Registros (30d)', value: kpis.registeredLast30Days, accent: 'blue' },
        { icon: Building2, label: 'Total Empresas', value: kpis.totalCompanies, accent: 'purple' },
        { icon: Calendar, label: 'Total Eventos', value: kpis.totalEvents, accent: 'amber' },
        { icon: Flag, label: 'Total Reportes', value: kpis.totalReports, accent: 'rose' },
      ]
    : []

  const maxCategoryCount =
    trends && trends.topCategories.length > 0
      ? Math.max(...trends.topCategories.map((c) => c.count))
      : 1

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Análisis de Datos</h1>
          {lastUpdated && (
            <p className="dashboard-last-updated">
              Última actualización: {formatTimestamp(lastUpdated)}
            </p>
          )}
        </div>
        <button
          className="dashboard-refresh-btn"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          title="Actualizar datos"
        >
          <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          <span>{refreshing ? 'Actualizando…' : 'Actualizar'}</span>
        </button>
      </div>

      {error && (
        <div className="dashboard-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => fetchData()} className="dashboard-error-retry">
            Reintentar
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="dashboard-grid">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => <KPICardSkeleton key={i} />)
          : kpiCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className={`dashboard-card dashboard-card--${card.accent}`}>
                  <div className={`dashboard-card-icon dashboard-card-icon--${card.accent}`}>
                    <Icon size={22} />
                  </div>
                  <div className="dashboard-card-value">{formatNumber(card.value)}</div>
                  <div className="dashboard-card-label">{card.label}</div>
                </div>
              )
            })}
      </div>

      {/* Inteligencia Geoespacial y Uso del Mapa */}
      {loading ? (
        <div className="dashboard-trends" style={{ marginTop: '24px' }}>
          <TrendsSkeleton />
        </div>
      ) : (
        kpis && kpis.hotspots && (
          <div className="dashboard-trends" style={{ marginTop: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            {/* Hotspots / Zonas Calientes — Floating Island Glass */}
            <div className="dashboard-trends-section" style={{
              gridColumn: 'span 2',
              background: 'rgba(20, 26, 24, 0.65)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(127, 109, 242, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(127, 109, 242, 0.06)',
              borderRadius: '16px',
              padding: '24px'
            }}>
              <div className="dashboard-trends-header" style={{ marginBottom: '8px' }}>
                <Flame size={22} style={{ color: '#7F6DF2' }} />
                <h2 style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Zonas Calientes (Heatmap de Interacción)</h2>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '16px' }}>
                Cuadrantes y geohashes con mayor densidad de aperturas de la app y búsquedas geoespaciales en Valdivia.
              </p>
              {kpis.hotspots.length === 0 ? (
                <p className="dashboard-trends-empty">Sin datos geográficos registrados</p>
              ) : (
                <div className="dashboard-bars">
                  {kpis.hotspots.map((spot, index) => {
                    const maxCount = Math.max(...kpis.hotspots.map(h => h.count))
                    const pct = maxCount > 0 ? (spot.count / maxCount) * 100 : 0
                    return (
                      <div key={spot.zone} className="dashboard-bar" style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <MapPin size={14} style={{ color: index === 0 ? '#7F6DF2' : 'var(--text-muted)' }} />
                            {spot.zone}
                          </span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {spot.count} aperturas
                          </span>
                        </div>
                        <div className="dashboard-bar-track" style={{ background: 'rgba(255, 255, 255, 0.05)', height: '6px' }}>
                          <div
                            className="dashboard-bar-fill"
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              borderRadius: '4px',
                              background: index === 0 ? 'linear-gradient(90deg, #7F6DF2, #a78bfa)' : '#7F6DF2',
                              boxShadow: index === 0 ? '0 0 8px rgba(127, 109, 242, 0.4)' : 'none'
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Métricas Físicas de Exploración — Floating Island Glass */}
            <div className="dashboard-trends-section" style={{
              background: 'rgba(20, 26, 24, 0.65)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(127, 109, 242, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(127, 109, 242, 0.06)',
              borderRadius: '16px',
              padding: '24px'
            }}>
              <div className="dashboard-trends-header" style={{ marginBottom: '8px' }}>
                <Activity size={22} style={{ color: '#7F6DF2' }} />
                <h2 style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Uso Físico del Mapa</h2>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '24px' }}>
                Estadísticas de exploración física extraídas de Redis y la cola de sincronización.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Tiempo de Actividad */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(38, 38, 38, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '8px',
                    background: 'rgba(127, 109, 242, 0.15)',
                    color: '#7F6DF2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 0 8px rgba(127, 109, 242, 0.15)'
                  }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Actividad Promedio
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {kpis.avgActivityTime.toFixed(1)} min
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Tiempo explorando el mapa antes de cerrarlo
                    </span>
                  </div>
                </div>

                {/* Tasa de Uso Offline */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(38, 38, 38, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.15)'
                  }}>
                    <WifiOff size={20} />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Tasa de Sincronización Offline
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {kpis.offlineUsageRate.toFixed(1)}%
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Activaciones de la cola por pérdida de señal
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Trends Section */}
      {loading ? (
        <TrendsSkeleton />
      ) : (
        trends && (
          <div className="dashboard-trends">
            {/* Top Categories */}
            <div className="dashboard-trends-section">
              <div className="dashboard-trends-header">
                <TrendingUp size={20} />
                <h2>Categorías Populares</h2>
              </div>
              {trends.topCategories.length === 0 ? (
                <p className="dashboard-trends-empty">Sin datos de categorías disponibles</p>
              ) : (
                <div className="dashboard-bars">
                  {trends.topCategories.map((cat) => {
                    const pct = maxCategoryCount > 0 ? (cat.count / maxCategoryCount) * 100 : 0
                    return (
                      <div key={cat.category} className="dashboard-bar">
                        <div className="dashboard-bar-label">
                          <span className="dashboard-bar-name">{cat.category}</span>
                          <span className="dashboard-bar-count">{cat.count}</span>
                        </div>
                        <div className="dashboard-bar-track">
                          <div
                            className="dashboard-bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Travel Styles */}
            <div className="dashboard-trends-section">
              <div className="dashboard-trends-header">
                <Compass size={20} />
                <h2>Estilos de Viaje</h2>
              </div>
              {Object.keys(trends.travelStyles).length === 0 ? (
                <p className="dashboard-trends-empty">Sin datos disponibles</p>
              ) : (
                <div className="dashboard-pills">
                  {Object.entries(trends.travelStyles)
                    .sort(([, a], [, b]) => b - a)
                    .map(([style, count]) => (
                      <span key={style} className="dashboard-pill dashboard-pill--teal">
                        {style}
                        <span className="dashboard-pill-count">{count}</span>
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Stay Durations */}
            <div className="dashboard-trends-section">
              <div className="dashboard-trends-header">
                <Clock size={20} />
                <h2>Duración de Estadía</h2>
              </div>
              {Object.keys(trends.stayDurations).length === 0 ? (
                <p className="dashboard-trends-empty">Sin datos disponibles</p>
              ) : (
                <div className="dashboard-pills">
                  {Object.entries(trends.stayDurations)
                    .sort(([, a], [, b]) => b - a)
                    .map(([duration, count]) => (
                      <span key={duration} className="dashboard-pill dashboard-pill--blue">
                        {duration}
                        <span className="dashboard-pill-count">{count}</span>
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Profile Types */}
            <div className="dashboard-trends-section">
              <div className="dashboard-trends-header">
                <Heart size={20} />
                <h2>Tipos de Perfil</h2>
              </div>
              {Object.keys(trends.profileTypes).length === 0 ? (
                <p className="dashboard-trends-empty">Sin datos disponibles</p>
              ) : (
                <div className="dashboard-pills">
                  {Object.entries(trends.profileTypes)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <span key={type} className="dashboard-pill dashboard-pill--purple">
                        {type}
                        <span className="dashboard-pill-count">{count}</span>
                      </span>
                    ))}
                </div>
              )}
              <p className="dashboard-trends-footnote">
                Total con preferencias: {formatNumber(trends.totalWithPreferences)}
              </p>
            </div>
          </div>
        )
      )}
    </div>
  )
}
