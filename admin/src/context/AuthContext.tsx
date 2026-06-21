import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../lib/api'

interface AdminUser {
  id: number
  email: string
  name: string
  role: string
  status: string
  totpReady: boolean
}

interface AuthState {
  token: string | null
  admin: AdminUser | null
  isLoading: boolean
  // Challenge state for 2FA flow
  challengeId: string | null
  totpSetupUri: string | null
  totpSetupKey: string | null
  pendingAdmin: AdminUser | null
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ requires2fa: boolean; error?: string }>
  verify2FA: (code: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  resetChallenge: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// Inactivity timeout: 15 minutes
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const savedToken = sessionStorage.getItem('_admin_session_token')
    const savedUser = sessionStorage.getItem('_admin_session_user')
    
    let token: string | null = null
    let admin: AdminUser | null = null
    
    if (savedToken && savedUser) {
      try {
        token = savedToken
        admin = JSON.parse(savedUser)
        api.setToken(token)
      } catch (e) {
        sessionStorage.removeItem('_admin_session_token')
        sessionStorage.removeItem('_admin_session_user')
      }
    }
    
    return {
      token,
      admin,
      isLoading: false,
      challengeId: null,
      totpSetupUri: null,
      totpSetupKey: null,
      pendingAdmin: null,
    }
  })

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset inactivity timer on user interaction
  const resetInactivityTimer = useCallback(() => {
    if (!state.token) return
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    inactivityTimerRef.current = setTimeout(() => {
      sessionStorage.removeItem('_admin_session_token')
      sessionStorage.removeItem('_admin_session_user')
      setState(prev => ({ ...prev, token: null, admin: null }))
      api.setToken(null)
    }, INACTIVITY_TIMEOUT_MS)
  }, [state.token])

  // Listen for user activity
  useEffect(() => {
    if (!state.token) return

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetInactivityTimer))
    resetInactivityTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer))
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    }
  }, [state.token, resetInactivityTimer])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.post<{
        success: boolean
        message: string
        requires2fa: boolean
        challengeId?: string
        totpSetupUri?: string
        totpSetupKey?: string
        admin?: AdminUser
      }>('/admin/auth/login', { email, password })

      if (!res.success) {
        return { requires2fa: false, error: res.message }
      }

      if (res.requires2fa) {
        setState(prev => ({
          ...prev,
          challengeId: res.challengeId || null,
          totpSetupUri: res.totpSetupUri || null,
          totpSetupKey: res.totpSetupKey || null,
          pendingAdmin: res.admin || null,
        }))
        return { requires2fa: true }
      }

      return { requires2fa: false }
    } catch {
      return { requires2fa: false, error: 'Error de conexión con el servidor' }
    }
  }, [])

  const verify2FA = useCallback(async (code: string) => {
    if (!state.challengeId) {
      return { success: false, error: 'No hay un challenge activo. Inicie sesión de nuevo.' }
    }

    try {
      const res = await api.post<{
        success: boolean
        message: string
        token?: string
        admin?: AdminUser
      }>('/admin/auth/verify-2fa', {
        challengeId: state.challengeId,
        totpCode: code,
      })

      if (!res.success) {
        return { success: false, error: res.message }
      }

      if (res.token && res.admin) {
        api.setToken(res.token)
        sessionStorage.setItem('_admin_session_token', res.token)
        sessionStorage.setItem('_admin_session_user', JSON.stringify(res.admin))
        setState(prev => ({
          ...prev,
          token: res.token!,
          admin: res.admin!,
          challengeId: null,
          totpSetupUri: null,
          totpSetupKey: null,
          pendingAdmin: null,
        }))
        return { success: true }
      }

      return { success: false, error: 'Respuesta inesperada del servidor' }
    } catch {
      return { success: false, error: 'Error de conexión con el servidor' }
    }
  }, [state.challengeId])

  const logout = useCallback(() => {
    api.setToken(null)
    sessionStorage.removeItem('_admin_session_token')
    sessionStorage.removeItem('_admin_session_user')
    setState({
      token: null,
      admin: null,
      isLoading: false,
      challengeId: null,
      totpSetupUri: null,
      totpSetupKey: null,
      pendingAdmin: null,
    })
  }, [])

  const resetChallenge = useCallback(() => {
    setState(prev => ({
      ...prev,
      challengeId: null,
      totpSetupUri: null,
      totpSetupKey: null,
      pendingAdmin: null,
    }))
  }, [])

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      verify2FA,
      logout,
      resetChallenge,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
