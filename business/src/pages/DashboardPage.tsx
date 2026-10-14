import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, Info, MapPin, ThumbsUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { sectionsFor } from '../lib/catalog'
import { getCompanyLocation, type CompanyLocation } from '../lib/company'
import Notice from '../components/Notice'

const VERIFICATION: Record<string, { label: string; text: string; tone: string }> = {
  verified: { label: 'Verificada', text: 'Tu empresa está verificada y visible en el mapa.', tone: 'success' },
  rejected: { label: 'Rechazada', text: 'La verificación fue rechazada. Contacta al equipo de TurismoMap.', tone: 'error' },
  pending: { label: 'En revisión', text: 'Tu cuenta está en proceso de revisión por el equipo de Valdivia.', tone: 'info' },
}

// Métricas pendientes de endpoint en el backend.
const STATS = [
  { label: 'Check-ins', icon: MapPin },
  { label: 'Eventos', icon: CalendarDays },
  { label: 'Votos', icon: ThumbsUp },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const flash = (useLocation().state as { flash?: string } | null)?.flash
  const [location, setLocation] = useState<CompanyLocation | null>(null)
  const actions = sectionsFor(user).filter((s) => s.path !== '/')
  const status = VERIFICATION[user?.company?.verificationStatus ?? 'pending'] ?? VERIFICATION.pending

  useEffect(() => {
    getCompanyLocation().then(setLocation).catch(() => setLocation(null))
  }, [])

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Panel</p>
          <h1>Hola, {user?.name?.split(' ')[0] || 'equipo'}</h1>
        </div>
      </header>

      {flash && <Notice kind="success">{flash}</Notice>}

      <section className="stats">
        {STATS.map(({ label, icon: Icon }) => (
          <div key={label} className="stat">
            <Icon size={18} />
            <span className="stat-value" aria-label="Sin datos">—</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </section>

      <div className="grid-2">
        <section className={`card status status-${status.tone}`}>
          <Info size={20} />
          <div>
            <h3>Estado de verificación · {status.label}</h3>
            <p>{status.text}</p>
          </div>
        </section>
        <section className="card status">
          <MapPin size={20} />
          <div>
            <h3>Ubicación en el mapa</h3>
            {location?.hasLocation ? (
              <p>{location.branchName || 'Sucursal principal'} — {location.address || 'Sin dirección'}</p>
            ) : (
              <p>
                Aún no geolocalizas tu negocio. <Link to="/ubicacion">Configúralo ahora</Link>.
              </p>
            )}
          </div>
        </section>
      </div>

      <h2 className="section-title">Acciones rápidas</h2>
      <div className="actions">
        {actions.map(({ path, label, icon: Icon, soon }) =>
          soon ? (
            <div key={path} className="action is-disabled">
              <Icon size={24} />
              <span>{label}</span>
              <span className="soon">Próximamente</span>
            </div>
          ) : (
            <Link key={path} to={path} className="action">
              <Icon size={24} />
              <span>{label}</span>
            </Link>
          ),
        )}
      </div>
    </div>
  )
}
