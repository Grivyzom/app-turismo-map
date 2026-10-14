const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type UnauthorizedHandler = () => void

class ApiClient {
  private token: string | null = null
  private onUnauthorized: UnauthorizedHandler | null = null

  setToken(token: string | null) {
    this.token = token
  }

  setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
    this.onUnauthorized = fn
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    } catch {
      throw new ApiError('No se pudo conectar con el servidor.', 0)
    }

    // El backend responde JSON en la mayoría de casos, pero algunos handlers usan http.Error.
    const text = await res.text()
    let data: Record<string, unknown>
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { message: text.trim() }
    }

    if (res.status === 401 && this.token) {
      this.onUnauthorized?.()
      throw new ApiError('Tu sesión expiró. Vuelve a ingresar.', 401)
    }

    if (!res.ok || data.success === false) {
      const msg = (data.message || data.error || `Error ${res.status}`) as string
      throw new ApiError(msg, res.status)
    }

    return data as T
  }

  get<T>(path: string) {
    return this.request<T>(path, { method: 'GET' })
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  }
}

export const api = new ApiClient()
