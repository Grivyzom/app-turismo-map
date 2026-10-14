import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info }

export default function Notice({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const Icon = ICONS[kind]
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={18} />
      <div>{children}</div>
    </div>
  )
}
