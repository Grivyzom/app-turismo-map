import { useState } from 'react'
import {
  Rating,
  Star,
  ThinStar,
  RoundedStar,
  Heart,
  StickerStar,
  ThinRoundedStar
} from '@smastrom/react-rating'
import {
  Star as StarIcon,
  Sliders,
  Sparkles,
  Code,
  Send,
  MessageSquare,
  Copy,
  Check,
  Building,
  Info
} from 'lucide-react'
import { sileo } from 'sileo'

interface Review {
  id: string
  name: string
  destination: string
  rating: number
  comment: string
  date: string
}

export default function RatingShowcasePage() {
  // Sandbox State
  const [sandboxRating, setSandboxRating] = useState<number>(3)
  const [sandboxItems, setSandboxItems] = useState<number>(5)
  const [sandboxShape, setSandboxShape] = useState<string>('Star')
  const [sandboxActiveColor, setSandboxActiveColor] = useState<string>('#10b981')
  const [sandboxInactiveColor, setSandboxInactiveColor] = useState<string>('#2a3532')
  const [sandboxReadOnly, setSandboxReadOnly] = useState<boolean>(false)
  const [sandboxDisabled, setSandboxDisabled] = useState<boolean>(false)
  const [sandboxRequired, setSandboxRequired] = useState<boolean>(false)
  const [sandboxHighlightOnlySelected, setSandboxHighlightOnlySelected] = useState<boolean>(false)

  // Copy State
  const [copiedCode, setCopiedCode] = useState<boolean>(false)

  // Reviews Feed State
  const [reviews, setReviews] = useState<Review[]>([
    {
      id: '1',
      name: 'Sofía Valenzuela',
      destination: 'Parque Oncol',
      rating: 4.8,
      comment: 'Una experiencia increíble. Senderos limpios y una vista impresionante de la selva valdiviana.',
      date: '2026-06-20'
    },
    {
      id: '2',
      name: 'Carlos Mendoza',
      destination: 'Costanera de Valdivia',
      rating: 3.5,
      comment: 'Muy lindo para caminar en la tarde, aunque había muchos lobos marinos haciendo ruido.',
      date: '2026-06-19'
    },
    {
      id: '3',
      name: 'Elena Rostova',
      destination: 'Fuerte de Corral',
      rating: 5.0,
      comment: 'Excelente recreación histórica de la defensa española. ¡La travesía en barcaza vale la pena!',
      date: '2026-06-18'
    }
  ])

  // New Review Form State
  const [newReviewName, setNewReviewName] = useState('')
  const [newReviewDest, setNewReviewDest] = useState('Parque Oncol')
  const [newReviewRating, setNewReviewRating] = useState(0)
  const [newReviewComment, setNewReviewComment] = useState('')

  // Map string shape to actual react-rating shape element
  const getShapeElement = (shapeName: string) => {
    switch (shapeName) {
      case 'ThinStar': return ThinStar
      case 'RoundedStar': return RoundedStar
      case 'Heart': return Heart
      case 'StickerStar': return StickerStar
      case 'ThinRoundedStar': return ThinRoundedStar
      case 'Star':
      default:
        return Star
    }
  }

  // Calculate dynamic average rating
  const averageRating = reviews.length > 0
    ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(2))
    : 0

  // Generate dynamic React code snippet
  const generateSnippet = () => {
    const shapeImport = sandboxShape !== 'Star' ? `, ${sandboxShape}` : ''
    const props = []
    
    props.push(`style={{ maxWidth: ${sandboxItems * 36} }}`)
    props.push(`value={rating}`)
    if (!sandboxReadOnly) props.push(`onChange={setRating}`)
    
    if (sandboxItems !== 5) props.push(`items={${sandboxItems}}`)
    if (sandboxReadOnly) props.push(`readOnly`)
    if (sandboxDisabled) props.push(`isDisabled`)
    if (sandboxRequired) props.push(`isRequired`)
    if (sandboxHighlightOnlySelected) props.push(`highlightOnlySelected`)

    const itemStyles = []
    if (sandboxShape !== 'Star') itemStyles.push(`itemShapes: ${sandboxShape}`)
    if (sandboxActiveColor !== '#10b981') itemStyles.push(`activeFillColor: '${sandboxActiveColor}'`)
    if (sandboxInactiveColor !== '#2a3532') itemStyles.push(`inactiveFillColor: '${sandboxInactiveColor}'`)

    if (itemStyles.length > 0) {
      props.push(`itemStyles={{\n    ${itemStyles.join(',\n    ')}\n  }}`)
    }

    return `import { useState } from 'react'
import { Rating${shapeImport} } from '@smastrom/react-rating'
import '@smastrom/react-rating/style.css'

export function DemoComponent() {
  const [rating, setRating] = useState(${sandboxRating})

  return (
    <Rating
      ${props.join('\n      ')}
    />
  )
}`
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generateSnippet())
    setCopiedCode(true)
    sileo.success({
      title: 'Código Copiado',
      description: 'El snippet de React se ha guardado en tu portapapeles.'
    })
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault()

    if (!newReviewName.trim()) {
      sileo.error({
        title: 'Error de validación',
        description: 'Por favor, introduce tu nombre.'
      })
      return
    }

    if (newReviewRating === 0) {
      sileo.warning({
        title: 'Calificación requerida',
        description: 'Por favor, selecciona una puntuación usando las estrellas.'
      })
      return
    }

    if (!newReviewComment.trim()) {
      sileo.error({
        title: 'Error de validación',
        description: 'Por favor, escribe un comentario sobre tu experiencia.'
      })
      return
    }

    const review: Review = {
      id: Date.now().toString(),
      name: newReviewName,
      destination: newReviewDest,
      rating: newReviewRating,
      comment: newReviewComment,
      date: new Date().toISOString().slice(0, 10)
    }

    setReviews([review, ...reviews])
    sileo.success({
      title: 'Reseña agregada',
      description: `¡Gracias por calificar ${newReviewDest}!`
    })

    // Reset Form
    setNewReviewName('')
    setNewReviewRating(0)
    setNewReviewComment('')
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="dashboard-title">
            <StarIcon size={24} style={{ color: 'var(--text-accent)', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Componente de Calificaciones (Rating)
          </h1>
          <p className="dashboard-last-updated">
            Demostración interactiva y personalización del paquete <code>@smastrom/react-rating</code>
          </p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* PANEL DE CONTROL / SANDBOX */}
        <div className="dashboard-trend-card" style={{ flex: '1.2' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Sliders size={18} style={{ color: 'var(--text-accent)' }} />
            <span>Sandbox Interactivo</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* PREVISUALIZACIÓN */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '30px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-medium)',
              minHeight: '140px'
            }}>
              <Rating
                style={{ maxWidth: sandboxItems * 36 }}
                value={sandboxRating}
                onChange={sandboxReadOnly ? undefined : setSandboxRating}
                items={sandboxItems as any}
                readOnly={sandboxReadOnly}
                isDisabled={sandboxDisabled}
                isRequired={sandboxRequired}
                highlightOnlySelected={sandboxHighlightOnlySelected}
                itemStyles={{
                  itemShapes: getShapeElement(sandboxShape),
                  activeFillColor: sandboxActiveColor,
                  inactiveFillColor: sandboxInactiveColor
                }}
              />
              <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {sandboxReadOnly ? 'Modo Solo Lectura' : 'Modo Interactivo'} — Puntuación actual:{' '}
                <strong style={{ color: 'var(--text-accent)', fontSize: '1rem' }}>{sandboxRating}</strong>
              </div>
            </div>

            {/* CONTROLES */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Cantidad de Ítems (1 - 10)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={sandboxItems}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setSandboxItems(val)
                    if (sandboxRating > val) setSandboxRating(val)
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{sandboxItems} estrellas</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Figura del Ítem
                </label>
                <select
                  value={sandboxShape}
                  onChange={(e) => setSandboxShape(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                >
                  <option value="Star">Star (Estrella Estándar)</option>
                  <option value="RoundedStar">RoundedStar (Estrella Redondeada)</option>
                  <option value="ThinStar">ThinStar (Estrella Fina)</option>
                  <option value="ThinRoundedStar">ThinRoundedStar (Fina Redondeada)</option>
                  <option value="StickerStar">StickerStar (Estilo Pegatina)</option>
                  <option value="Heart">Heart (Corazón)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Color Activo (Relleno)
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={sandboxActiveColor}
                    onChange={(e) => setSandboxActiveColor(e.target.value)}
                    style={{
                      width: '32px',
                      height: '32px',
                      padding: '0',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: 'none'
                    }}
                  />
                  <input
                    type="text"
                    value={sandboxActiveColor}
                    onChange={(e) => setSandboxActiveColor(e.target.value)}
                    style={{
                      flex: '1',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Color Inactivo
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={sandboxInactiveColor}
                    onChange={(e) => setSandboxInactiveColor(e.target.value)}
                    style={{
                      width: '32px',
                      height: '32px',
                      padding: '0',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: 'none'
                    }}
                  />
                  <input
                    type="text"
                    value={sandboxInactiveColor}
                    onChange={(e) => setSandboxInactiveColor(e.target.value)}
                    style={{
                      flex: '1',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* BOOLEAN TOGGLES */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem' }}>
                <input
                  type="checkbox"
                  checked={sandboxReadOnly}
                  onChange={(e) => setSandboxReadOnly(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span>readOnly (Solo Lectura)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem' }}>
                <input
                  type="checkbox"
                  checked={sandboxDisabled}
                  onChange={(e) => setSandboxDisabled(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span>isDisabled (Desactivado)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem' }}>
                <input
                  type="checkbox"
                  checked={sandboxRequired}
                  onChange={(e) => setSandboxRequired(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span>isRequired (Obligatorio)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem' }}>
                <input
                  type="checkbox"
                  checked={sandboxHighlightOnlySelected}
                  onChange={(e) => setSandboxHighlightOnlySelected(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span>highlightOnlySelected</span>
              </label>
            </div>

          </div>
        </div>

        {/* CÓDIGO GENERADO */}
        <div className="dashboard-trend-card" style={{ display: 'flex', flexDirection: 'column', flex: '0.8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code size={18} style={{ color: 'var(--text-accent)' }} />
              <span>Código Resultante</span>
            </h3>
            <button
              onClick={handleCopyCode}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {copiedCode ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
              <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          <pre style={{
            flex: '1',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: '#090c0c',
            border: '1px solid var(--border-subtle)',
            color: '#a5d0bd',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5'
          }}>
            {generateSnippet()}
          </pre>
        </div>

      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '24px' }}>
        
        {/* FORMULARIO Y RESEÑAS REALES SIMULADAS */}
        <div className="dashboard-trend-card" style={{ flex: '1.1' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <MessageSquare size={18} style={{ color: 'var(--text-accent)' }} />
            <span>Crear Reseña de Destino</span>
          </h3>

          <form onSubmit={handleAddReview} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Tu Nombre
              </label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez"
                value={newReviewName}
                onChange={(e) => setNewReviewName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Destino Turístico
                </label>
                <select
                  value={newReviewDest}
                  onChange={(e) => setNewReviewDest(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                >
                  <option value="Parque Oncol">Parque Oncol</option>
                  <option value="Costanera de Valdivia">Costanera de Valdivia</option>
                  <option value="Fuerte de Corral">Fuerte de Corral</option>
                  <option value="Playa Curiñanco">Playa Curiñanco</option>
                  <option value="Santuario de la Naturaleza">Santuario de la Naturaleza</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Tu Calificación
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '42px',
                  padding: '0 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)'
                }}>
                  <Rating
                    style={{ maxWidth: 140 }}
                    value={newReviewRating}
                    onChange={setNewReviewRating}
                    isRequired
                    itemStyles={{
                      itemShapes: RoundedStar,
                      activeFillColor: '#f59e0b',
                      inactiveFillColor: 'rgba(245, 158, 11, 0.1)'
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Tu Comentario
              </label>
              <textarea
                placeholder="Describe tu experiencia en este atractivo turístico..."
                value={newReviewComment}
                onChange={(e) => setNewReviewComment(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                background: 'var(--accent-primary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-primary)'}
            >
              <Send size={16} />
              <span>Publicar Reseña</span>
            </button>
          </form>
        </div>

        {/* FEED DE RESEÑAS Y PROMEDIOS */}
        <div className="dashboard-trend-card" style={{ flex: '0.9', display: 'flex', flexDirection: 'column' }}>
          
          {/* Métrica Promedio */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            marginBottom: '20px'
          }}>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1
            }}>
              {averageRating}
            </div>
            <div style={{ flex: '1' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Rating
                  style={{ maxWidth: 120 }}
                  value={averageRating}
                  readOnly
                  itemStyles={{
                    itemShapes: Star,
                    activeFillColor: '#f59e0b',
                    inactiveFillColor: 'rgba(255, 255, 255, 0.05)'
                  }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Promedio de {reviews.length} opiniones turísticas
              </div>
            </div>
          </div>

          {/* Listado de Opiniones */}
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Últimas Opiniones
          </h4>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
            maxHeight: '320px',
            flex: '1',
            paddingRight: '4px'
          }}>
            {reviews.map((rev) => (
              <div
                key={rev.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {rev.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      {rev.date}
                    </span>
                  </div>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <Building size={12} />
                    {rev.destination}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Rating
                    style={{ maxWidth: 90 }}
                    value={rev.rating}
                    readOnly
                    itemStyles={{
                      itemShapes: Star,
                      activeFillColor: '#f59e0b',
                      inactiveFillColor: 'rgba(255, 255, 255, 0.05)'
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '6px', color: '#f59e0b' }}>
                    {rev.rating.toFixed(1)}
                  </span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {rev.comment}
                </p>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* ESTILOS PRESTABLECIDOS / PRESETS SHOWCASE */}
      <div className="dashboard-trend-card" style={{ marginTop: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Sparkles size={18} style={{ color: 'var(--text-accent)' }} />
          <span>Presets de Estilo Recomendados</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          
          {/* Estilo Clásico */}
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>1. Clásico Dorado</h4>
            <Rating
              style={{ maxWidth: 140 }}
              value={4}
              readOnly
              itemStyles={{
                itemShapes: Star,
                activeFillColor: '#ffb700',
                inactiveFillColor: '#fbf1a9'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Estrella clásica (<code>Star</code>) con tonos amarillo-dorado tradicionales. Excelente para hoteles y comercios.
            </p>
          </div>

          {/* Estilo Corazones */}
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>2. Favoritos con Corazón</h4>
            <Rating
              style={{ maxWidth: 140 }}
              value={5}
              readOnly
              itemStyles={{
                itemShapes: Heart,
                activeFillColor: '#ef4444',
                inactiveFillColor: 'rgba(239, 68, 68, 0.1)'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Ideal para marcar favoritos o indicar nivel de agrado mediante iconos de corazón (<code>Heart</code>).
            </p>
          </div>

          {/* Estilo Fina Elegante */}
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>3. Fina & Minimalista</h4>
            <Rating
              style={{ maxWidth: 280 }}
              value={7.5}
              items={10}
              readOnly
              itemStyles={{
                itemShapes: ThinStar,
                activeFillColor: '#10b981',
                inactiveFillColor: '#162823'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Usa 10 estrellas finas (<code>ThinStar</code>) para una escala de calificación más detallada del 1 al 10.
            </p>
          </div>

          {/* Estilo Sticker Star */}
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>4. Sticker Moderno</h4>
            <Rating
              style={{ maxWidth: 140 }}
              value={3.5}
              readOnly
              itemStyles={{
                itemShapes: StickerStar,
                activeFillColor: '#8b5cf6',
                inactiveFillColor: '#1e1b4b'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Estrella de estilo sticker moderno (<code>StickerStar</code>) para diseños de interfaz informales o juveniles.
            </p>
          </div>

        </div>
      </div>

      {/* CONSEJOS DE INSTALACIÓN Y TROUBLESHOOTING */}
      <div className="dashboard-trend-card" style={{ marginTop: '24px', borderLeft: '4px solid var(--accent-primary)' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Info size={18} style={{ color: 'var(--accent-primary)' }} />
          <span>Información de Soporte y Troubleshooting</span>
        </h3>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.5' }}>
          <p>
            <strong>¿No se ven los estilos?</strong> Asegúrate de haber importado correctamente el archivo <code>@smastrom/react-rating/style.css</code> en tu archivo de arranque (ej. <code>main.tsx</code>).
          </p>
          <p>
            <strong>Error "itemShapes is not a valid JSX element":</strong> Pasa el SVG directamente como un elemento (ej. <code>itemShapes: ThinStar</code> o un elemento SVG manual), no como una función (ej. <code>itemShapes: () =&gt; ...</code>).
          </p>
          <p>
            <strong>Comportamiento de reinicio:</strong> Por defecto, hacer clic en la opción que ya está seleccionada reinicia el valor a 0. Para obligar a dejar una calificación mínima y evitar el reinicio, añade la propiedad <code>isRequired</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
