const API_BASE = import.meta.env.VITE_API_URL || ''

class ApiClient {
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
  }

  getToken() {
    return this.token
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    })

    // Handle rate limiting
    if (res.status === 429) {
      const data = await res.json()
      throw new Error(data.message || 'Demasiados intentos. Intente más tarde.')
    }

    // Handle unauthorized (token expired)
    if (res.status === 401 && this.token) {
      this.token = null
      sessionStorage.removeItem('_admin_session_token')
      sessionStorage.removeItem('_admin_session_user')
      window.location.href = '/dev/login'
      throw new Error('Sesión expirada')
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ message: 'Error del servidor' }))
      throw new Error(data.message || `Error ${res.status}`)
    }

    return res.json()
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' })
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
}

export const api = new ApiClient()
