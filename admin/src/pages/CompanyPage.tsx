import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Search,
  RefreshCw,
  Phone,
  Calendar,
} from 'lucide-react'
import { api } from '../lib/api'
import { sileo } from 'sileo'

interface Company {
  id: number
  businessName: string
  entityType: string
  category: string
  isVerifiedBadge: boolean
  taxId: string
  verificationStatus: string
  phone: string
  createdAt: string
}

interface CompanyResponse {
  success: boolean
  companies: Company[]
}

export default function CompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get<CompanyResponse>('/admin/api/v1/companies')
      if (res.success) {
        setCompanies(res.companies)
      } else {
        throw new Error('Respuesta inesperada del servidor')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las empresas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  const handleUpdateStatus = async (companyId: number, currentStatus: string, currentBadge: boolean, action: 'approve' | 'suspend' | 'toggle_badge') => {
    let nextStatus = currentStatus
    let nextBadge = currentBadge

    let loadingTitle = 'Actualizando empresa...'
    let successTitle = 'Empresa actualizada'
    let errorTitle = 'Error al actualizar'

    if (action === 'approve') {
      nextStatus = 'approved'
      loadingTitle = 'Aprobando empresa...'
      successTitle = 'Empresa aprobada'
    } else if (action === 'suspend') {
      nextStatus = 'suspended'
      loadingTitle = 'Suspendiendo empresa...'
      successTitle = 'Empresa suspendida'
    } else if (action === 'toggle_badge') {
      nextBadge = !currentBadge
      loadingTitle = currentBadge ? 'Removiendo insignia...' : 'Asignando insignia...'
      successTitle = currentBadge ? 'Insignia removida' : 'Insignia asignada'
    }

    const updatePromise = api.post<{ success: boolean; message: string }>('/admin/api/v1/companies/verify', {
      companyId,
      verificationStatus: nextStatus,
      isVerifiedBadge: nextBadge,
    }).then(res => {
      if (!res.success) throw new Error(res.message || 'Error al actualizar la empresa')
      return res
    })

    sileo.promise(updatePromise, {
      loading: {
        title: loadingTitle,
        description: 'Guardando los cambios de verificación...'
      },
      success: {
        title: successTitle,
        description: 'Los cambios se han guardado correctamente.'
      },
      error: {
        title: errorTitle,
        description: 'No se pudieron guardar los cambios de verificación.'
      }
    })

    try {
      setUpdatingId(companyId)
      await updatePromise
      setCompanies(prev =>
        prev.map(c =>
          c.id === companyId
            ? { ...c, verificationStatus: nextStatus, isVerifiedBadge: nextBadge }
            : c
        )
      )
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredCompanies = companies.filter(c => {
    const q = searchQuery.toLowerCase()
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.taxId.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    )
  })

  return (
    <div className="companies-page">
      <div className="dashboard-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="dashboard-title">Bases de Datos — Empresas Suscritas</h1>
          <p className="dashboard-last-updated">
            Administración y verificación de organizaciones en el mapa
          </p>
        </div>
        <button
          className="dashboard-refresh-btn"
          onClick={fetchCompanies}
          disabled={loading}
          title="Actualizar tabla"
        >
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
          <span>{loading ? 'Cargando…' : 'Actualizar'}</span>
        </button>
      </div>

      {/* Control bar */}
      <div className="companies-controls" style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        flexWrap: 'wrap',
      }}>
        <div className="search-bar-container" style={{
          position: 'relative',
          flex: '1',
          minWidth: '260px',
        }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input
            type="text"
            placeholder="Buscar empresa por nombre, RUT, categoría..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 40px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-medium)'}
          />
        </div>
      </div>

      {error && (
        <div className="dashboard-error" style={{ marginBottom: '24px' }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={fetchCompanies} className="dashboard-error-retry">
            Reintentar
          </button>
        </div>
      )}

      {/* Database Table view */}
      <div className="audit-log-container" style={{ overflowX: 'auto' }}>
        <table className="audit-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Empresa</th>
              <th>Información</th>
              <th>Categoría / Tipo</th>
              <th>Insignia</th>
              <th>Estado Verificación</th>
              <th style={{ textAlign: 'right' }}>Acciones Administrativas</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ display: 'inline-block', marginRight: '8px' }} />
                    Cargando base de datos de empresas...
                  </td>
                </tr>
              ))
            ) : filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No se encontraron empresas registradas.
                </td>
              </tr>
            ) : (
              filteredCompanies.map(company => (
                <tr key={company.id} style={{ opacity: updatingId === company.id ? 0.6 : 1 }}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>#{company.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar" style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-gradient)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 600,
                      }}>
                        {company.businessName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{company.businessName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>RUT: {company.taxId || 'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8125rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                        <Phone size={12} /> {company.phone || 'Sin teléfono'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                        <Calendar size={12} /> {new Date(company.createdAt).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        alignSelf: 'start',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)'
                      }}>
                        {company.category || 'General'}
                      </span>
                      <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                        {company.entityType === 'business' ? '🏢 Empresa' : '🏛️ Pública'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => handleUpdateStatus(company.id, company.verificationStatus, company.isVerifiedBadge, 'toggle_badge')}
                      disabled={updatingId === company.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: company.isVerifiedBadge ? 'rgba(52, 211, 153, 0.15)' : 'var(--bg-tertiary)',
                        color: company.isVerifiedBadge ? 'var(--success)' : 'var(--text-muted)',
                        border: '1px solid ' + (company.isVerifiedBadge ? 'var(--border-accent)' : 'var(--border-subtle)'),
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                      title="Alternar insignia verificada"
                    >
                      <Award size={14} />
                      <span>{company.isVerifiedBadge ? 'Verificado' : 'Ninguna'}</span>
                    </button>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background:
                        company.verificationStatus === 'approved' ? 'rgba(52, 211, 153, 0.1)' :
                        company.verificationStatus === 'suspended' ? 'rgba(239, 68, 68, 0.1)' :
                        'rgba(227, 148, 84, 0.1)',
                      color:
                        company.verificationStatus === 'approved' ? 'var(--success)' :
                        company.verificationStatus === 'suspended' ? 'var(--danger)' :
                        'var(--warning)',
                      border: '1px solid ' + (
                        company.verificationStatus === 'approved' ? 'var(--border-accent)' :
                        company.verificationStatus === 'suspended' ? 'rgba(239, 68, 68, 0.2)' :
                        'rgba(227, 148, 84, 0.2)'
                      )
                    }}>
                      {company.verificationStatus === 'approved' ? '✔️ Aprobada' :
                       company.verificationStatus === 'suspended' ? '🚫 Suspendida' :
                       '⏳ Pendiente'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      {company.verificationStatus !== 'approved' && (
                        <button
                          onClick={() => handleUpdateStatus(company.id, company.verificationStatus, company.isVerifiedBadge, 'approve')}
                          disabled={updatingId === company.id}
                          className="action-btn"
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(52, 211, 153, 0.15)',
                            color: 'var(--success)',
                            border: '1px solid var(--border-accent)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <CheckCircle2 size={14} />
                          Aprobar
                        </button>
                      )}
                      {company.verificationStatus !== 'suspended' && (
                        <button
                          onClick={() => handleUpdateStatus(company.id, company.verificationStatus, company.isVerifiedBadge, 'suspend')}
                          disabled={updatingId === company.id}
                          className="action-btn"
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: 'var(--danger)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <XCircle size={14} />
                          Suspender
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
