import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ExternalLink, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ENTITY_LABELS, ROLE_LABELS, sectionsFor } from '../lib/catalog'

const TOURISM_APP_URL = (import.meta.env.VITE_TOURISM_APP_URL as string | undefined) || '/'

export default function BusinessLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const sections = sectionsFor(user)

  const handleLogout = () => {
    logout()
    navigate('/ingresar', { replace: true })
  }

  const companyName = user?.company?.businessName || user?.name || 'Mi empresa'
  const entity = user?.company?.entityType ?? 'business'

  return (
    <div className="shell">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label="Menú">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="topbar-title">{companyName}</span>
      </header>

      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">TM</div>
          <div>
            <div className="brand-name">TurismoMap</div>
            <div className="brand-sub">Portal Empresarial</div>
          </div>
        </div>

        <div className="company-card">
          <div className="company-label">{ENTITY_LABELS[entity] ?? 'Panel Corporativo'}</div>
          <div className="company-name">{companyName}</div>
          <span className="badge">{ROLE_LABELS[user?.userType ?? ''] ?? user?.userType}</span>
        </div>

        <nav className="nav">
          {sections.map(({ path, label, icon: Icon, soon }) =>
            soon ? (
              <span key={path} className="nav-item is-disabled" title="Próximamente">
                <Icon size={18} />
                <span>{label}</span>
                <span className="soon">Pronto</span>
              </span>
            ) : (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ),
          )}
        </nav>

        <div className="sidebar-footer">
          <a className="nav-item" href={TOURISM_APP_URL} target="_blank" rel="noreferrer">
            <ExternalLink size={18} />
            <span>Ver mapa turístico</span>
          </a>
          <button className="nav-item" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
