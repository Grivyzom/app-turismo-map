import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Shield, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react'
import { sileo } from '../components/ui/Toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    const result = await login(email, password)
    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
      sileo.error({
        title: 'Error al iniciar sesión',
        description: result.error,
      })
      return
    }

    if (result.requires2fa) {
      navigate('/verify-2fa')
    } else {
      sileo.success({
        title: '¡Sesión Iniciada!',
        description: 'Bienvenido de vuelta al panel de TurismoMap.',
      })
    }
  }

  return (
    <div className="login-container">
      <div className="login-bg-pattern" />
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <Shield size={32} />
          </div>
          <h1 className="login-title">Panel de Administración</h1>
          <p className="login-subtitle">TurismoMap — Acceso restringido</p>
        </div>

        {error && (
          <div className="login-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Correo electrónico
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-input"
              placeholder="admin@turismomap.com"
              required
              autoComplete="email"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Contraseña
            </label>
            <div className="form-input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••••"
                required
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="form-input-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isSubmitting || !email || !password}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin" />
                Verificando...
              </>
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>

        <div className="login-footer">
          <div className="login-security-badges">
            <span className="security-badge">🔒 2FA Obligatorio</span>
            <span className="security-badge">🛡️ Sesión cifrada</span>
          </div>
          <p className="login-disclaimer">
            Todas las acciones son registradas en el log de auditoría.
          </p>
        </div>
      </div>
    </div>
  )
}
