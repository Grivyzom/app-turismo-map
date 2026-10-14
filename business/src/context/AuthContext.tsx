import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import {
  clearSession,
  hasBusinessAccess,
  loadSession,
  saveSession,
  tokenExpiry,
  type BusinessUser,
} from '../lib/session'

interface AuthResponse {
  success: boolean
  message?: string
  token: string
  user: BusinessUser
}

export interface RegisterInput {
  email: string
  password: string
  name: string
  businessName?: string
  phone?: string
  entityType: 'corporate' | 'sme' | 'independent'
}

interface AuthContextValue {
  token: string | null
  user: BusinessUser | null
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const initial = loadSession()
api.setToken(initial?.token ?? null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(initial?.token ?? null)
  const [user, setUser] = useState<BusinessUser | null>(initial?.user ?? null)

  const logout = useCallback(() => {
    clearSession()
    api.setToken(null)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    api.setUnauthorizedHandler(logout)
    return () => api.setUnauthorizedHandler(null)
  }, [logout])

  // Cierre automático al expirar el JWT (4h para cuentas business).
  useEffect(() => {
    if (!token) return
    const exp = tokenExpiry(token)
    if (exp === null) return
    const t = window.setTimeout(logout, Math.max(0, exp - Date.now()))
    return () => window.clearTimeout(t)
  }, [token, logout])

  const startSession = useCallback((data: AuthResponse) => {
    if (!hasBusinessAccess(data.user)) {
      throw new Error('Esta cuenta no tiene permisos de empresa.')
    }
    saveSession(data.token, data.user)
    api.setToken(data.token)
    setToken(data.token)
    setUser(data.user)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<AuthResponse>('/auth/login', { email: email.trim(), password })
      startSession(data)
    },
    [startSession],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const isCompany = input.entityType !== 'independent'
      const data = await api.post<AuthResponse>('/auth/register', {
        email: input.email.trim(),
        password: input.password,
        name: input.name.trim(),
        businessName: isCompany ? input.businessName?.trim() : undefined,
        phone: input.phone?.trim(),
        entityType: input.entityType,
        userType: 'partner_owner',
      })
      startSession(data)
    },
    [startSession],
  )

  const value = useMemo(() => ({ token, user, login, register, logout }), [token, user, login, register, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
