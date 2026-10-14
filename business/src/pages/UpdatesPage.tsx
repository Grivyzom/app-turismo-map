import { useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { api } from '../lib/api'
import Notice from '../components/Notice'

const DURATIONS = [
  { hours: 3, label: '3 horas' },
  { hours: 12, label: '12 horas' },
  { hours: 24, label: '1 día' },
  { hours: 72, label: '3 días' },
]

export default function UpdatesPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [expiresIn, setExpiresIn] = useState(24)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!title.trim() || !description.trim()) return setError('El título y la descripción son obligatorios.')
    setSaving(true)
    try {
      // El backend publica en la primera sucursal de la empresa.
      await api.post('/api/v1/business/updates', {
        title: title.trim(),
        description: description.trim(),
        type: 'general',
        expiresIn,
      })
      setSuccess('Novedad publicada. Tus seguidores fueron notificados.')
      setTitle('')
      setDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar la novedad.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page narrow">
      <header className="page-header">
        <div>
          <p className="eyebrow">Comunicación</p>
          <h1>Publicar novedad</h1>
        </div>
      </header>

      <Notice kind="info">
        Las novedades aparecen en el mapa como alertas en tu sucursal y se envían como notificación a quienes siguen tu negocio.
      </Notice>

      <form className="card form" onSubmit={onSubmit} noValidate>
        <label className="label">
          Título <span className="counter">{title.length}/50</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} placeholder='Ej. "¡Llegó pan caliente!"' />
        </label>
        <label className="label">
          Descripción <span className="counter">{description.length}/200</span>
          <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
        </label>
        <div className="label">
          Visible durante
          <div className="chips">
            {DURATIONS.map((d) => (
              <button key={d.hours} type="button" className={`chip ${expiresIn === d.hours ? 'is-active' : ''}`} onClick={() => setExpiresIn(d.hours)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        {success && <Notice kind="success">{success}</Notice>}
        <button className="btn btn-primary" disabled={saving}>
          {saving ? <span className="spinner sm" /> : <><Send size={16} /> Publicar</>}
        </button>
      </form>
    </div>
  )
}
