import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Shield, User, Mail, Clock, Lock, CheckCircle2, AlertCircle, Settings, MapPin, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

interface ExternalPlacesStat {
  category: string
  count: number
  lastSync: string
}

interface ExternalPlacesStats {
  total: number
  byCategory: ExternalPlacesStat[]
}

export default function SettingsPage() {
  const { admin } = useAuth()
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)
  const [externalStats, setExternalStats] = useState<ExternalPlacesStats | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const data = await api.get<ExternalPlacesStats>('/admin/api/v1/places/external-stats')
      setExternalStats(data)
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleGoogleSync = async () => {
    setSyncLoading(true)
    setSyncResult(null)
    try {
      const res = await api.post<{ success: boolean; synced: number; message?: string; errors?: string[] }>(
        '/admin/api/v1/places/sync-google',
        {}
      )
      setSyncResult({
        success: res.success,
        message: res.message || `${res.synced} lugares importados/actualizados`,
      })
      await loadStats()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setSyncResult({ success: false, message: msg })
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Configuración</h1>
          <p className="dashboard-last-updated">Ajustes generales y seguridad de la cuenta</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: '24px' }}>
        {/* Perfil Card */}
        <div className="dashboard-trend-card">
          <h3>
            <User size={18} className="text-accent" />
            <span>Perfil del Administrador</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="topbar-avatar" style={{ width: '48px', height: '48px', fontSize: '1.25rem' }}>
                {admin?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div>
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}>{admin?.name}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '2px' }}>
                  ID de Administrador: #{admin?.id}
                </p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Correo Electrónico</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{admin?.email}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rol de Acceso</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--accent-primary-hover)', fontWeight: 500 }}>
                    {admin?.role === 'superadmin' ? '👑 Super Administrador' :
                     admin?.role === 'admin' ? '🛡️ Administrador' : '📋 Moderador'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seguridad Card */}
        <div className="dashboard-trend-card">
          <h3>
            <Lock size={18} className="text-accent" />
            <span>Seguridad de Acceso</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              background: admin?.totpReady ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: `1px solid ${admin?.totpReady ? 'var(--success)' : 'var(--danger)'}33`
            }}>
              {admin?.totpReady ? (
                <CheckCircle2 size={20} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <AlertCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
              )}
              <div>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Autenticación de Doble Factor (2FA)
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                  {admin?.totpReady 
                    ? 'El segundo factor de autenticación mediante aplicación TOTP está activo en su cuenta.' 
                    : '2FA no está configurado por completo. Se requiere 2FA para el acceso a funciones administrativas.'}
                </p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Políticas de Seguridad
              </h4>
              <ul style={{ paddingLeft: '18px', fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Se requiere autenticación 2FA para iniciar sesión.</li>
                <li>Los logs de auditoría registran todos los accesos y modificaciones.</li>
                <li>Las contraseñas deben actualizarse periódicamente.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Preferencias de Panel Card */}
        <div className="dashboard-trend-card">
          <h3>
            <Settings size={18} className="text-accent" />
            <span>Preferencias del Sistema</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>Modo Oscuro</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tema por defecto del sistema</span>
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: 'var(--accent-glow)',
                  color: 'var(--accent-primary-hover)',
                  border: '1px solid var(--border-accent)'
                }}>Activo</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>Expiración de Sesión</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cierre automático por inactividad</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <Clock size={14} />
                  <span>15 min</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>Registro de Auditoría</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auditoría automática de operaciones</span>
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: 'var(--success-bg)',
                  color: 'var(--success)',
                  border: '1px solid rgba(52, 211, 153, 0.2)'
                }}>Habilitado</span>
              </div>
            </div>
          </div>
        </div>
        {/* Google Places Sync Card */}
        <div className="dashboard-trend-card" style={{ gridColumn: '1 / -1' }}>
          <h3>
            <MapPin size={18} className="text-accent" />
            <span>Sincronización de Google Places</span>
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Importa restaurantes, cafés, panaderías, supermercados y locales comerciales del centro de Valdivia desde Google Places API.
            Los resultados se almacenan en la base de datos y aparecen en el mapa de la aplicación.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Estado actual
              </h4>
              {externalStats ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {externalStats.total}
                    <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>lugares externos</span>
                  </div>
                  {externalStats.byCategory.map(s => (
                    <div key={s.category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      <span style={{ textTransform: 'capitalize' }}>{s.category}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.count}</span>
                    </div>
                  ))}
                  {externalStats.total === 0 && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Sin datos aún. Ejecuta la sincronización.
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Cargando estadísticas...</p>
              )}
            </div>

            <div style={{ flex: '1', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Categorías incluidas
              </h4>
              <ul style={{ paddingLeft: '18px', fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>Restaurantes y comida rápida</li>
                <li>Cafés y cafeterías</li>
                <li>Panaderías</li>
                <li>Bares y pubs</li>
                <li>Supermercados</li>
                <li>Minimarkets y tiendas de conveniencia</li>
              </ul>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Radio: 3 km desde el centro de Valdivia · Requiere <code>GOOGLE_PLACES_API_KEY</code> en el entorno del backend.
              </p>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={handleGoogleSync}
              disabled={syncLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-sm)',
                background: syncLoading ? 'var(--bg-hover)' : 'var(--accent-primary)',
                color: syncLoading ? 'var(--text-muted)' : 'white',
                border: 'none',
                cursor: syncLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                transition: 'background 0.2s',
              }}
            >
              <RefreshCw size={16} style={{ animation: syncLoading ? 'spin 1s linear infinite' : 'none' }} />
              {syncLoading ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>

            {syncResult && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                background: syncResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                border: `1px solid ${syncResult.success ? 'var(--success)' : 'var(--danger)'}33`,
                fontSize: '0.8125rem',
                color: syncResult.success ? 'var(--success)' : 'var(--danger)',
              }}>
                {syncResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {syncResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
