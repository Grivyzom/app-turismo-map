import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  AlertCircle,
  Shield,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { api } from '../lib/api'

interface AuditEntry {
  id: number
  adminId: number
  action: string
  ipAddress: string
  userAgent: string
  details: string
  createdAt: string
}

interface AuditLogResponse {
  success: boolean
  entries: AuditEntry[]
  total: number
}

type ActionColor = 'green' | 'red' | 'orange' | 'blue' | 'gray'

function getActionColor(action: string): ActionColor {
  const lower = action.toLowerCase()
  if (lower === 'login_success') return 'green'
  if (lower === 'login_failed' || lower === '2fa_failed' || lower === 'login_blocked') return 'red'
  if (lower === 'account_locked' || lower === 'login_suspended') return 'orange'
  if (lower.startsWith('totp_setup') || lower === '2fa_challenge_issued') return 'blue'
  return 'gray'
}

function formatActionLabel(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function TableSkeleton() {
  return (
    <div className="audit-skeleton">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="audit-skeleton-row">
          <div className="skeleton-pulse skeleton-text-sm" style={{ width: '140px' }} />
          <div className="skeleton-pulse skeleton-text-sm" style={{ width: '60px' }} />
          <div className="skeleton-pulse skeleton-text-sm" style={{ width: '110px' }} />
          <div className="skeleton-pulse skeleton-text-sm" style={{ width: '110px' }} />
          <div className="skeleton-pulse skeleton-text-sm" style={{ width: '200px' }} />
        </div>
      ))}
    </div>
  )
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [sortField, setSortField] = useState<'createdAt' | 'action' | 'adminId'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get<AuditLogResponse>('/admin/api/v1/audit-log')
      setEntries(res.entries || [])
      setTotal(res.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el registro de auditoría')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const filteredEntries = useMemo(() => {
    const term = filter.toLowerCase().trim()
    let result = entries

    if (term) {
      result = entries.filter(
        (entry) =>
          entry.action.toLowerCase().includes(term) ||
          entry.details.toLowerCase().includes(term) ||
          entry.ipAddress.toLowerCase().includes(term) ||
          String(entry.adminId).includes(term)
      )
    }

    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortField === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      } else if (sortField === 'action') {
        cmp = a.action.localeCompare(b.action)
      } else if (sortField === 'adminId') {
        cmp = a.adminId - b.adminId
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [entries, filter, sortField, sortDir])

  const handleSort = (field: 'createdAt' | 'action' | 'adminId') => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  return (
    <div className="audit-page">
      <div className="audit-header">
        <div className="audit-header-left">
          <div className="audit-header-icon">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="audit-title">Registro de Auditoría</h1>
            <p className="audit-subtitle">
              {loading
                ? 'Cargando…'
                : `${filteredEntries.length} de ${total} entradas`}
            </p>
          </div>
        </div>
        <button
          className="audit-refresh-btn"
          onClick={fetchEntries}
          disabled={loading}
          title="Actualizar"
        >
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Filter */}
      <div className="audit-filter">
        <Search size={18} className="audit-filter-icon" />
        <input
          type="text"
          className="audit-filter-input"
          placeholder="Filtrar por acción, IP, detalles o Admin ID…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button className="audit-filter-clear" onClick={() => setFilter('')}>
            ✕
          </button>
        )}
      </div>

      {error && (
        <div className="audit-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchEntries} className="audit-error-retry">
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : filteredEntries.length === 0 ? (
        <div className="audit-empty">
          <FileText size={48} />
          <p>{filter ? 'No se encontraron entradas con ese filtro' : 'No hay entradas de auditoría'}</p>
        </div>
      ) : (
        <div className="audit-table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th className="audit-th audit-th--sortable" onClick={() => handleSort('createdAt')}>
                  Fecha <SortIcon field="createdAt" />
                </th>
                <th className="audit-th audit-th--sortable" onClick={() => handleSort('adminId')}>
                  Admin ID <SortIcon field="adminId" />
                </th>
                <th className="audit-th audit-th--sortable" onClick={() => handleSort('action')}>
                  Acción <SortIcon field="action" />
                </th>
                <th className="audit-th">IP</th>
                <th className="audit-th">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const color = getActionColor(entry.action)
                const isExpanded = expandedRow === entry.id
                return (
                  <tr
                    key={entry.id}
                    className={`audit-row ${isExpanded ? 'audit-row--expanded' : ''}`}
                    onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                  >
                    <td className="audit-td audit-td--date">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="audit-td audit-td--admin">
                      <span className="audit-admin-id">{entry.adminId}</span>
                    </td>
                    <td className="audit-td">
                      <span className={`audit-action-badge audit-action-badge--${color}`}>
                        {formatActionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="audit-td audit-td--ip">
                      <code className="audit-ip">{entry.ipAddress}</code>
                    </td>
                    <td className="audit-td audit-td--details">
                      <span className="audit-details-text">
                        {entry.details || '—'}
                      </span>
                      {isExpanded && entry.userAgent && (
                        <div className="audit-useragent">
                          <span className="audit-useragent-label">User Agent:</span>
                          {entry.userAgent}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
