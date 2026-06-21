import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  ScrollText,
  LogOut,
  Shield,
  ChevronDown,
  Menu,
  X,
  Map,
  Building2,
  Pin,
  Settings,
  Sparkles,
  Star,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Tooltip } from 'react-tooltip'
import { sileo } from 'sileo'

export default function AdminLayout() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isPinned, setIsPinned] = useState(() => {
    const saved = localStorage.getItem('admin_sidebar_pinned')
    return saved !== null ? saved === 'true' : true
  })
  const [isHovered, setIsHovered] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isExpanded = isPinned || isHovered

  const handleLogout = () => {
    logout()
    sileo.success({
      title: 'Sesión Finalizada',
      description: 'Has cerrado sesión con seguridad.',
    })
    navigate('/login', { replace: true })
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Análisis de Datos' },
    { to: '/mapa', icon: Map, label: 'Mapa Inteligente' },
    { to: '/empresas', icon: Building2, label: 'Empresas Suscritas' },
    { to: '/audit-log', icon: ScrollText, label: 'Log de Auditoría' },
    { to: '/sileo', icon: Sparkles, label: 'Sileo Toasts' },
    { to: '/ratings', icon: Star, label: 'Valoraciones' },
  ]

  return (
    <div className="admin-layout">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`admin-sidebar ${sidebarOpen ? 'open' : ''} ${!isExpanded ? 'collapsed' : ''} ${isHovered ? 'hovered' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <Shield size={24} />
            <span>TurismoMap</span>
          </div>
          <button
            className={`sidebar-pin-btn ${isPinned ? 'pinned' : ''}`}
            onClick={() => {
              const newVal = !isPinned
              setIsPinned(newVal)
              localStorage.setItem('admin_sidebar_pinned', String(newVal))
            }}
            aria-label={isPinned ? 'Desanclar barra lateral' : 'Anclar barra lateral'}
            data-tooltip-id="sidebar-tooltip"
            data-tooltip-content={isPinned ? 'Desanclar barra lateral' : 'Anclar barra lateral'}
          >
            <Pin size={16} className={`pin-icon ${isPinned ? 'pinned' : 'unpinned'}`} />
          </button>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
              data-tooltip-id={!isExpanded ? 'sidebar-tooltip' : undefined}
              data-tooltip-content={item.label}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/configuracion"
            className={({ isActive }) =>
              `sidebar-link footer-link ${isActive ? 'active' : ''}`
            }
            onClick={() => setSidebarOpen(false)}
            data-tooltip-id={!isExpanded ? 'sidebar-tooltip' : undefined}
            data-tooltip-content="Configuración"
          >
            <Settings size={20} />
            <span>Configuración</span>
          </NavLink>
          <button
            onClick={handleLogout}
            className="sidebar-link footer-link logout-btn"
            data-tooltip-id={!isExpanded ? 'sidebar-tooltip' : undefined}
            data-tooltip-content="Cerrar Sesión"
          >
            <LogOut size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className={`admin-main ${!isExpanded ? 'collapsed' : ''}`}>
        {/* Top bar */}
        <header className="admin-topbar">
          <button
            className="topbar-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>

          <div className="topbar-spacer" />

          {/* User dropdown */}
          <div className="topbar-user" ref={dropdownRef}>
            <button
              className="topbar-user-btn"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <div className="topbar-avatar">
                {admin?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <span className="topbar-username">{admin?.name}</span>
              <ChevronDown size={16} className={`topbar-chevron ${dropdownOpen ? 'open' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="topbar-dropdown">
                <div className="dropdown-header">
                  <p className="dropdown-name">{admin?.name}</p>
                  <p className="dropdown-email">{admin?.email}</p>
                  <span className="dropdown-role">{admin?.role}</span>
                </div>
                <div className="dropdown-divider" />
                <button className="dropdown-item danger" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
      <Tooltip id="sidebar-tooltip" place="right" style={{ zIndex: 999 }} />
    </div>
  )
}
