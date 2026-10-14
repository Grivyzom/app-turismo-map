import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Building2, Eye, EyeOff, Lock, Mail, Phone, ShieldHalf, Store, User } from 'lucide-react'
import { useAuth, type RegisterInput } from '../context/AuthContext'
import Notice from '../components/Notice'

type Mode = 'login' | 'register' | 'recovery'
type Entity = RegisterInput['entityType']

const ENTITY_OPTIONS: { id: Entity; label: string; icon: typeof Building2 }[] = [
  { id: 'corporate', label: 'Empresa', icon: Building2 },
  { id: 'sme', label: 'PYME', icon: Store },
  { id: 'independent', label: 'Independiente', icon: User },
]

const TOURISM_APP_URL = (import.meta.env.VITE_TOURISM_APP_URL as string | undefined) || '/'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('modo') === 'registro' ? 'register' : 'login')
  const [entity, setEntity] = useState<Entity>('corporate')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [managerName, setManagerName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const isCompany = entity !== 'independent'

  const switchMode = (m: Mode) => {
    setMode(m)
    setPassword('')
    setError('')
    setInfo('')
  }

  const missingFields = () => {
    const missing: string[] = []
    if (mode === 'register' && isCompany && !businessName.trim()) missing.push('nombre de la empresa')
    if (mode === 'register' && !managerName.trim()) missing.push('nombre del encargado')
    if (!email.trim()) missing.push('correo corporativo')
    if (mode !== 'recovery' && !password) missing.push('contraseña')
    return missing
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const missing = missingFields()
    if (missing.length) {
      setError(`Completa los campos obligatorios: ${missing.join(', ')}.`)
      return
    }
    if (mode === 'recovery') {
      // El backend aún no expone recuperación de contraseña.
      setInfo('Si el correo existe, recibirás un enlace de recuperación.')
      setMode('login')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register({ email, password, name: managerName, businessName, phone, entityType: entity })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la solicitud.')
    } finally {
      setLoading(false)
    }
  }

  const title = mode === 'register' ? 'Registrar empresa' : mode === 'recovery' ? 'Recuperar acceso' : 'Portal Empresarial'
  const subtitle =
    mode === 'register'
      ? 'Crea la cuenta corporativa de tu negocio'
      : mode === 'recovery'
        ? 'Ingresa tu correo corporativo para recibir el enlace de restauración'
        : 'Gestiona tu presencia en el mapa turístico'

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <div className="auth-badge">
          <ShieldHalf size={22} />
        </div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>

        {info && <Notice kind="success">{info}</Notice>}

        {mode === 'register' && (
          <>
            <div className="segmented" role="radiogroup" aria-label="Tipo de cuenta">
              {ENTITY_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={entity === id}
                  className={entity === id ? 'is-active' : ''}
                  onClick={() => setEntity(id)}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
            {isCompany && (
              <Field icon={<Store size={16} />}>
                <input
                  placeholder={entity === 'sme' ? 'Nombre de la PYME *' : 'Nombre de la empresa *'}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </Field>
            )}
            <Field icon={<User size={16} />}>
              <input
                placeholder={isCompany ? 'Nombre del representante *' : 'Nombre o marca personal *'}
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                autoComplete="name"
              />
            </Field>
          </>
        )}

        <Field icon={<Mail size={16} />}>
          <input
            type="email"
            placeholder="correo@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>

        {mode === 'register' && (
          <Field icon={<Phone size={16} />}>
            <input type="tel" placeholder="Teléfono de contacto" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        )}

        {mode !== 'recovery' && (
          <Field icon={<Lock size={16} />}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className="field-action"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </Field>
        )}

        {mode === 'login' && (
          <button type="button" className="link" onClick={() => switchMode('recovery')}>
            ¿Olvidaste tu contraseña?
          </button>
        )}

        {error && <Notice kind="error">{error}</Notice>}

        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <span className="spinner sm" /> : (
            <>
              {mode === 'register' ? 'Registrar empresa' : mode === 'recovery' ? 'Enviar enlace' : 'Acceder'}
              {mode !== 'recovery' && <ArrowRight size={17} />}
            </>
          )}
        </button>

        <div className="auth-footer">
          {mode === 'recovery' ? (
            <button type="button" className="link" onClick={() => switchMode('login')}>
              ← Volver al inicio de sesión
            </button>
          ) : (
            <span>
              {mode === 'login' ? '¿No tienes cuenta de empresa? ' : '¿Ya tienes cuenta? '}
              <button type="button" className="link" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? 'Regístrate aquí' : 'Inicia sesión'}
              </button>
            </span>
          )}
          <a className="muted-link" href={TOURISM_APP_URL}>Volver al mapa turístico</a>
        </div>
      </form>
    </div>
  )
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-icon">{icon}</span>
      {children}
    </label>
  )
}
