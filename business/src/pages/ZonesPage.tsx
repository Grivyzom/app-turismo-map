import { Layers, PenTool } from 'lucide-react'

const STEPS = [
  'Identifica el área que deseas resaltar en el mapa.',
  'Define los puntos del polígono que delimitan la zona.',
  'Asigna un nombre y color distintivo para que los usuarios la identifiquen.',
]

export default function ZonesPage() {
  return (
    <div className="page narrow">
      <header className="page-header">
        <div>
          <p className="eyebrow">Mapa</p>
          <h1>Delimitar zonas</h1>
        </div>
      </header>

      <section className="card hero">
        <Layers size={32} />
        <h3>Zonas de interés</h3>
        <p className="muted">
          Delimita áreas específicas en el mapa: sectores comerciales, centros urbanos o zonas de eventos.
        </p>
      </section>

      <section className="card">
        <h3>¿Cómo funciona?</h3>
        <ol className="steps">
          {STEPS.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </section>

      <button className="btn btn-primary" disabled title="Disponible en la próxima actualización">
        <PenTool size={16} /> Comenzar a dibujar · Próximamente
      </button>
    </div>
  )
}
