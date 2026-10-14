// Sesión del portal empresarial. Token JWT emitido por /auth/login (scope "business", 4h).

export type EntityType = 'business' | 'corporate' | 'sme' | 'independent' | 'authority' | string

export interface Company {
  id: number
  businessName: string
  entityType: EntityType
  verificationStatus?: string
  phone?: string
  role?: string
}

export interface BusinessUser {
  id: number
  email: string
  name: string
  picture?: string
  userType: string
  company?: Company | null
}

const TOKEN_KEY = '_biz_token'
const USER_KEY = '_biz_user'

export const BUSINESS_USER_TYPES = ['partner_owner', 'partner_manager', 'partner_worker', 'partner_staff', 'admin']

export function hasBusinessAccess(user: Pick<BusinessUser, 'userType'> | null | undefined) {
  return !!user && BUSINESS_USER_TYPES.includes(user.userType)
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

// Devuelve el `exp` (ms) del JWT, o null si no se puede leer.
export function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

export function loadSession(): { token: string; user: BusinessUser } | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const user = readJson<BusinessUser>(USER_KEY)
  if (!token || !user) return null
  const exp = tokenExpiry(token)
  if (exp !== null && exp <= Date.now()) {
    clearSession()
    return null
  }
  return { token, user }
}

export function saveSession(token: string, user: BusinessUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
