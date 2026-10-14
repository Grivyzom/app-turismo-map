import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crosshair, Send } from 'lucide-react'
import { api } from '../lib/api'
import { CATEGORIES } from '../lib/catalog'
import { getCompanyLocation } from '../lib/company'
import { usePin } from '../lib/usePin'
import LocationPicker from '../components/LocationPicker'
import CategoryPicker from '../components/CategoryPicker'
import Notice from '../components/Notice'

// Valor para <input type="datetime-local"> en hora local.
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function range(type: 'later' | 'tomorrow' | 'weekend'): [Date, Date] {
  const start = new Date()
  const end = new Date()
  if (type === 'later') {
    start.setHours(start.getHours() + 1, 0, 0, 0)
    end.setTime(start.getTime() + 3 * 3600_000)
  } else if (type === 'tomorrow') {
    start.setDate(start.getDate() + 1)
    start.setHours(12, 0, 0, 0)
    end.setTime(start.getTime())
    end.setHours(18)
  } else {
    start.setDate(start.getDate() + ((6 - start.getDay() + 7) % 7 || 7))
    start.setHours(10, 0, 0, 0)
    end.setTime(start.getTime())
    end.setDate(end.getDate() + 1)
    end.setHours(22)
  }
  return [start, end]
}

export default function CreateEventPage() {
  const navigate = useNavigate()
  const { pin, setPin, address, setAddress, resolving, movePin, locateWithGps } = usePin()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('gastronomia')
  const [[start, end], setRange] = useState(() => range('later').map(toLocalInput) as [string, string])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Por defecto el evento se ubica en la dirección de la empresa.
  useEffect(() => {
    getCompanyLocation()
      .then((loc) => {
        if (loc.hasLocation) {
          setPin({ latitude: loc.latitude, longitude: loc.longitude })
          setAddress(loc.address || '')
        }
      })
      .catch(() => {})
  }, [setPin, setAddress])

  const applyShortcut = (t: 'later' | 'tomorrow' | 'weekend') => setRange(range(t).map(toLocalInput) as [string, string])

  const onGps = () => locateWithGps().catch(() => setError('No se pudo obtener tu ubicación GPS.'))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) return setError('Ingresa un título para el evento.')
    if (!pin) return setError('Selecciona la ubicación del evento en el mapa.')
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return setError('Fechas inválidas.')
    if (endDate <= startDate) return setError('La fecha de término debe ser posterior al inicio.')

    setSaving(true)
    try {
      await api.post('/api/v1/events', {
        title: title.trim(),
        description: description.trim(),
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        category,
        latitude: pin.latitude,
        longitude: pin.longitude,
      })
      navigate('/', { replace: true, state: { flash: 'Evento publicado en el mapa turístico.' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el evento.')
    } finally {
      setSaving(false)
    }
  }

  const color = CATEGORIES.find((c) => c.id === category)?.color

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Eventos</p>
          <h1>Crear evento</h1>
        </div>
      </header>

      <form className="split" onSubmit={onSubmit} noValidate>
        <div className="card form">
          <label className="label">
            Título *
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ej. Feria gastronómica costera" />
          </label>
          <label className="label">
            Descripción
            <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿Qué encontrarán los visitantes?" />
          </label>
          <div className="label">
            Categoría
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
          <div className="row">
            <label className="label">
              Inicio
              <input className="input" type="datetime-local" value={start} onChange={(e) => setRange([e.target.value, end])} />
            </label>
            <label className="label">
              Término
              <input className="input" type="datetime-local" value={end} onChange={(e) => setRange([start, e.target.value])} />
            </label>
          </div>
          <div className="chips">
            <button type="button" className="chip" onClick={() => applyShortcut('later')}>En 1 hora</button>
            <button type="button" className="chip" onClick={() => applyShortcut('tomorrow')}>Mañana</button>
            <button type="button" className="chip" onClick={() => applyShortcut('weekend')}>Fin de semana</button>
          </div>
          {error && <Notice kind="error">{error}</Notice>}
          <button className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner sm" /> : <><Send size={16} /> Publicar evento</>}
          </button>
        </div>

        <div className="card map-card">
          <div className="map-head">
            <div>
              <h3>Ubicación del evento</h3>
              <p className="muted">{resolving ? 'Buscando dirección…' : address || 'Haz click en el mapa para ubicar el evento'}</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onGps}>
              <Crosshair size={16} /> Mi ubicación
            </button>
          </div>
          <LocationPicker value={pin} onChange={movePin} color={color} height={420} />
        </div>
      </form>
    </div>
  )
}
