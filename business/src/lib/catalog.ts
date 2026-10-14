import {
  BarChart3,
  CalendarPlus,
  LayoutDashboard,
  Map,
  MapPin,
  Megaphone,
  Settings,
  Store,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { BusinessUser } from './session'

export const ROLE_LABELS: Record<string, string> = {
  partner_owner: 'Propietario',
  partner_manager: 'Gerente',
  partner_worker: 'Personal',
  partner_staff: 'Personal',
  admin: 'Administrador',
}

export const ENTITY_LABELS: Record<string, string> = {
  independent: 'Perfil Independiente',
  independiente: 'Perfil Independiente',
  sme: 'Perfil PYME',
  pymes: 'Perfil PYME',
  authority: 'Autoridad',
}

export const CATEGORIES = [
  { id: 'gastronomia', label: 'Gastronomía', color: '#dc2626' },
  { id: 'cultura', label: 'Cultura', color: '#d97706' },
  { id: 'naturaleza', label: 'Naturaleza', color: '#059669' },
  { id: 'musica', label: 'Música', color: '#7c3aed' },
  { id: 'deportes', label: 'Deporte', color: '#2563eb' },
] as const

const ALL = ['partner_owner', 'partner_manager', 'partner_worker', 'partner_staff', 'admin']
const MANAGERS = ['partner_owner', 'partner_manager', 'admin']

export interface Section {
  path: string
  label: string
  icon: LucideIcon
  roles: string[]
  /** Aún no implementado: se muestra deshabilitado con etiqueta "Próximamente". */
  soon?: boolean
  hideFor?: string[]
}

export const SECTIONS: Section[] = [
  { path: '/', label: 'Panel', icon: LayoutDashboard, roles: ALL },
  { path: '/eventos/nuevo', label: 'Crear evento', icon: CalendarPlus, roles: ALL },
  { path: '/novedades', label: 'Novedades', icon: Megaphone, roles: ['partner_owner', 'partner_manager', 'partner_worker', 'admin'] },
  { path: '/ubicacion', label: 'Ubicación', icon: MapPin, roles: MANAGERS },
  { path: '/zonas', label: 'Delimitar zonas', icon: Map, roles: MANAGERS },
  { path: '/sucursales', label: 'Sucursales', icon: Store, roles: MANAGERS, soon: true, hideFor: ['independent', 'independiente'] },
  { path: '/personal', label: 'Personal', icon: Users, roles: MANAGERS, soon: true, hideFor: ['independent', 'independiente', 'sme', 'pymes'] },
  { path: '/estadisticas', label: 'Estadísticas', icon: BarChart3, roles: MANAGERS, soon: true },
  { path: '/checkins', label: 'Check-ins', icon: UserCheck, roles: ALL, soon: true },
  { path: '/configuracion', label: 'Configuración', icon: Settings, roles: ['partner_owner', 'admin'], soon: true },
]

export function sectionsFor(user: BusinessUser | null) {
  if (!user) return []
  const entity = user.company?.entityType ?? 'business'
  return SECTIONS.filter((s) => s.roles.includes(user.userType) && !s.hideFor?.includes(entity))
}

export function canAccess(user: BusinessUser | null, path: string) {
  return sectionsFor(user).some((s) => s.path === path && !s.soon)
}
