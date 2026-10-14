import { CATEGORIES } from '../lib/catalog'

export default function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips" role="radiogroup">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          className={`chip ${value === c.id ? 'is-active' : ''}`}
          style={value === c.id ? { background: c.color, borderColor: c.color } : undefined}
          onClick={() => onChange(c.id)}
        >
          <span className="chip-dot" style={{ background: value === c.id ? '#fff' : c.color }} />
          {c.label}
        </button>
      ))}
    </div>
  )
}
