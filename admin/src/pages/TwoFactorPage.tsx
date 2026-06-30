import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent, type ClipboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { QRCodeSVG } from 'qrcode.react'
import { ShieldCheck, ArrowLeft, AlertTriangle, Loader2, Copy, Check } from 'lucide-react'
import { sileo } from '../components/ui/Toast'

export default function TwoFactorPage() {
  const { challengeId, totpSetupUri, totpSetupKey, pendingAdmin, verify2FA, resetChallenge } = useAuth()
  const navigate = useNavigate()

  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const isSetup = !!totpSetupUri

  // Redirect if no challenge
  useEffect(() => {
    if (!challengeId) {
      navigate('/login', { replace: true })
    }
  }, [challengeId, navigate])

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const newDigits = [...digits]
    newDigits[index] = value
    setDigits(newDigits)
    setError('')

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setDigits(text.split(''))
      inputRefs.current[5]?.focus()
    }
  }

  const handleCopyKey = () => {
    if (totpSetupKey) {
      navigator.clipboard.writeText(totpSetupKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    const code = digits.join('')
    if (code.length !== 6) {
      setError('Ingrese los 6 dígitos del código')
      return
    }

    setIsSubmitting(true)
    const result = await verify2FA(code)
    setIsSubmitting(false)

    if (result.success) {
      sileo.success({
        title: 'Verificación exitosa',
        description: 'Bienvenido, sesión administrativa autorizada.',
      })
      navigate('/', { replace: true })
    } else {
      const errMsg = result.error || 'Código inválido'
      setError(errMsg)
      sileo.error({
        title: 'Código incorrecto',
        description: errMsg,
      })
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  // Auto-submit when all digits are filled
  useEffect(() => {
    if (digits.every(d => d !== '') && !isSubmitting) {
      handleSubmit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])

  const handleBack = () => {
    resetChallenge()
    navigate('/login', { replace: true })
  }

  if (!challengeId) return null

  return (
    <div className="login-container">
      <div className="login-bg-pattern" />
      <div className="login-card twofa-card">
        <button className="back-button" onClick={handleBack} type="button">
          <ArrowLeft size={18} />
          <span>Volver al login</span>
        </button>

        <div className="login-header">
          <div className="login-icon twofa-icon">
            <ShieldCheck size={32} />
          </div>
          <h1 className="login-title">
            {isSetup ? 'Configurar 2FA' : 'Verificación 2FA'}
          </h1>
          {pendingAdmin && (
            <p className="login-subtitle">
              {pendingAdmin.name} — {pendingAdmin.email}
            </p>
          )}
        </div>

        {isSetup && (
          <div className="twofa-setup">
            <p className="twofa-instruction">
              Escanee este código QR con <strong>Google Authenticator</strong>, <strong>Authy</strong> u otra app TOTP:
            </p>
            <div className="twofa-qr-container">
              <QRCodeSVG
                value={totpSetupUri}
                size={200}
                bgColor="#0f1425"
                fgColor="#e2e8f0"
                level="M"
                includeMargin
              />
            </div>
            {totpSetupKey && (
              <div className="twofa-manual-key">
                <span className="twofa-key-label">O ingrese esta clave manualmente:</span>
                <div className="twofa-key-row">
                  <code className="twofa-key-code">{totpSetupKey}</code>
                  <button
                    type="button"
                    className="twofa-copy-btn"
                    onClick={handleCopyKey}
                    aria-label="Copiar clave"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!isSetup && (
          <p className="twofa-instruction">
            Ingrese el código de 6 dígitos de su aplicación de autenticación.
          </p>
        )}

        {error && (
          <div className="login-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="twofa-form">
          <div className="twofa-digits" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="twofa-digit-input"
                autoFocus={i === 0}
                disabled={isSubmitting}
                autoComplete="one-time-code"
                aria-label={`Dígito ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isSubmitting || digits.some(d => !d)}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin" />
                Verificando...
              </>
            ) : (
              isSetup ? 'Confirmar y activar 2FA' : 'Verificar código'
            )}
          </button>
        </form>

        <p className="twofa-note">
          El código cambia cada 30 segundos. Asegúrese de ingresarlo antes de que expire.
        </p>
      </div>
    </div>
  )
}
