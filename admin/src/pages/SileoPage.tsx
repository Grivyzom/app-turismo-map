import { useState } from 'react'
import { sileo } from 'sileo'
import {
  Play,
  Copy,
  Check,
  CheckCircle,
  AlertTriangle,
  Info,
  Terminal,
  MousePointer,
  Sparkles,
  RefreshCw,
  Compass,
} from 'lucide-react'

export default function SileoPage() {
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [promiseLoading, setPromiseLoading] = useState(false)
  const [fireToastTab, setFireToastTab] = useState<'preview' | 'code'>('preview')
  const [codeSubTab, setCodeSubTab] = useState<'success' | 'error' | 'warning' | 'info'>('success')

  const codeSnippets = {
    success: `sileo.success({
  title: 'Guardado con éxito',
  description: 'Todos los cambios fueron guardados en el servidor.',
})`,
    error: `sileo.error({
  title: 'Error de conexión',
  description: 'No se pudo sincronizar la base de datos.',
})`,
    warning: `sileo.warning({
  title: 'Espacio casi lleno',
  description: 'El almacenamiento del sistema está al 92%.',
})`,
    info: `sileo.info({
  title: 'Novedades de la versión',
  description: 'Se han optimizado los tiempos de carga del mapa.',
})`
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(id)
    setTimeout(() => setCopiedText(null), 2000)
  }

  const triggerSuccess = () => {
    sileo.success({
      title: 'Guardado con éxito',
      description: 'Todos los cambios fueron guardados en el servidor.',
    })
  }

  const triggerError = () => {
    sileo.error({
      title: 'Error de conexión',
      description: 'No se pudo sincronizar la base de datos.',
    })
  }

  const triggerWarning = () => {
    sileo.warning({
      title: 'Espacio casi lleno',
      description: 'El almacenamiento del sistema está al 92%.',
    })
  }

  const triggerInfo = () => {
    sileo.info({
      title: 'Novedades de la versión',
      description: 'Se han optimizado los tiempos de carga del mapa.',
    })
  }

  const triggerAction = () => {
    sileo.action({
      title: 'Acción Pendiente',
      description: 'Hay 4 registros de auditoría sin sincronizar.',
      button: {
        title: 'Sincronizar',
        onClick: () => {
          sileo.success({
            title: 'Sincronización completa',
            description: 'Los registros se enviaron exitosamente.',
          })
        },
      },
    })
  }

  const triggerPromise = () => {
    setPromiseLoading(true)
    const myPromise = new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.3) {
          resolve('OK')
        } else {
          reject(new Error('Timeout'))
        }
      }, 2500)
    })

    sileo.promise(myPromise, {
      loading: {
        title: 'Guardando registro...',
        description: 'Subiendo datos cifrados al servidor...',
      },
      success: {
        title: 'Guardado correctamente',
        description: 'La transacción se completó con éxito.',
      },
      error: {
        title: 'Error al guardar',
        description: 'La solicitud falló, reintente más tarde.',
      },
    }).finally(() => {
      setPromiseLoading(false)
    })
  }

  const triggerPosition = (pos: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => {
    sileo.success({
      title: 'Posición override',
      description: `Este toast se disparó en la posición: ${pos}`,
      position: pos,
    })
  }

  const installCode = 'npm install sileo'

  const setupCode = `import { sileo, Toaster } from "sileo";

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <YourApp />
    </>
  );
}`



  const actionCode = `sileo.action({
  title: "Acción Pendiente",
  description: "Hay 4 registros de auditoría sin sincronizar.",
  button: {
    title: "Sincronizar",
    onClick: () => {
      sileo.success({
        title: "Sincronización completa",
        description: "Los registros se enviaron exitosamente."
      });
    }
  }
});`

  const promiseCode = `const myPromise = new Promise((resolve, reject) => {
  setTimeout(() => Math.random() > 0.3 ? resolve() : reject(), 2500);
});

sileo.promise(myPromise, {
  loading: { title: "Guardando...", description: "Subiendo datos..." },
  success: { title: "Guardado correctamente", description: "Completado." },
  error: { title: "Error al guardar", description: "Reintente más tarde." }
});`

  const positionCode = `sileo.success({
  title: "Saved",
  position: "bottom-center",
});`

  return (
    <div className="dashboard-page">
      <div className="sileo-doc-container">
        {/* Hero Header */}
        <header className="sileo-hero">
          <h1 className="sileo-hero-title">
            <Sparkles size={32} style={{ color: 'var(--text-accent)' }} />
            Sileo Notifications
          </h1>
          <p className="sileo-hero-subtitle">
            Sileo is a tiny, opinionated toast component for React. It uses gooey SVG morphing and spring physics to create buttery smooth notifications — beautiful by default, no configuration required.
          </p>
          <div className="sileo-install-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="sileo-install-badge">
              <Terminal size={16} />
              <span>{installCode}</span>
            </span>
            <button
              className="sileo-btn-copy"
              onClick={() => handleCopy(installCode, 'install')}
              style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
            >
              {copiedText === 'install' ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              <span>{copiedText === 'install' ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </header>

        {/* Quick Setup */}
        <section>
          <h2 className="sileo-section-title">
            <Compass size={22} style={{ color: 'var(--text-accent)' }} />
            Quick Setup
          </h2>
          <p className="sileo-section-desc">
            Add the Toaster component to your app's root layout, then call sileo from anywhere.
          </p>
          <div className="sileo-code-card">
            <div className="sileo-code-header">
              <span>React Root / Layout Component</span>
              <button className="sileo-btn-copy" onClick={() => handleCopy(setupCode, 'setup')}>
                {copiedText === 'setup' ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                <span>{copiedText === 'setup' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="sileo-code-body">
              <code>{setupCode}</code>
            </pre>
          </div>
        </section>

        {/* Fire a Toast */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 className="sileo-section-title" style={{ margin: 0 }}>
                <Play size={22} style={{ color: 'var(--text-accent)' }} />
                Fire a Toast
              </h2>
              <p className="sileo-section-desc" style={{ margin: '4px 0 0 0' }}>
                Sileo supports multiple semantic status styles that are stylized by default with animations and color themes.
              </p>
            </div>

            {/* Switcher Preview / Code */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setFireToastTab('preview')}
                style={{
                  padding: '6px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  background: fireToastTab === 'preview' ? 'var(--accent-primary)' : 'transparent',
                  color: fireToastTab === 'preview' ? 'white' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
              >
                Preview
              </button>
              <button
                onClick={() => setFireToastTab('code')}
                style={{
                  padding: '6px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  background: fireToastTab === 'code' ? 'var(--accent-primary)' : 'transparent',
                  color: fireToastTab === 'code' ? 'white' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
              >
                Code
              </button>
            </div>
          </div>

          {fireToastTab === 'preview' ? (
            <div className="sileo-toast-grid" style={{ marginTop: '24px' }}>
              <div className="sileo-toast-card">
                <div>
                  <h3 className="sileo-card-title success">
                    <CheckCircle size={18} />
                    Success
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>
                    Used for positive confirmations and successful processes.
                  </p>
                </div>
                <button className="sileo-btn-action" onClick={triggerSuccess}>
                  <Play size={16} />
                  <span>Probar Success</span>
                </button>
              </div>

              <div className="sileo-toast-card">
                <div>
                  <h3 className="sileo-card-title error">
                    <AlertTriangle size={18} />
                    Error
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>
                    Used for exceptions, failed operations, or network disconnects.
                  </p>
                </div>
                <button className="sileo-btn-action" onClick={triggerError} style={{ backgroundColor: 'var(--danger)' }}>
                  <Play size={16} />
                  <span>Probar Error</span>
                </button>
              </div>

              <div className="sileo-toast-card">
                <div>
                  <h3 className="sileo-card-title warning">
                    <AlertTriangle size={18} />
                    Warning
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>
                    Used for alerts, warning limits, or non-blocking issues.
                  </p>
                </div>
                <button className="sileo-btn-action" onClick={triggerWarning} style={{ backgroundColor: 'var(--warning)', color: '#111' }}>
                  <Play size={16} />
                  <span>Probar Warning</span>
                </button>
              </div>

              <div className="sileo-toast-card">
                <div>
                  <h3 className="sileo-card-title info">
                    <Info size={18} />
                    Info
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>
                    Used for neutral tips, versions, or system updates.
                  </p>
                </div>
                <button className="sileo-btn-action" onClick={triggerInfo} style={{ backgroundColor: '#2563eb' }}>
                  <Play size={16} />
                  <span>Probar Info</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['success', 'error', 'warning', 'info'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setCodeSubTab(type)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid ' + (codeSubTab === type ? 'var(--accent-primary)' : 'var(--border-subtle)'),
                      background: codeSubTab === type ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-tertiary)',
                      color: codeSubTab === type ? 'var(--text-accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                      textTransform: 'capitalize'
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="sileo-code-card">
                <div className="sileo-code-header">
                  <span style={{ textTransform: 'capitalize' }}>{codeSubTab} Example</span>
                  <button className="sileo-btn-copy" onClick={() => handleCopy(codeSnippets[codeSubTab], 'code-sub')}>
                    {copiedText === 'code-sub' ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                    <span>{copiedText === 'code-sub' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <pre className="sileo-code-body">
                  <code>{codeSnippets[codeSubTab]}</code>
                </pre>
              </div>
            </div>
          )}
        </section>

        {/* Action Toast */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
          <div>
            <h2 className="sileo-section-title">
              <MousePointer size={22} style={{ color: 'var(--text-accent)' }} />
              Action Toast
            </h2>
            <p className="sileo-section-desc">
              Toasts can include an interactive button for fast user feedback or triggering dependent operations in the background.
            </p>
            <div style={{ marginTop: '20px' }}>
              <button className="sileo-btn-action" onClick={triggerAction}>
                <Play size={16} />
                <span>Probar Action Toast</span>
              </button>
            </div>
          </div>

          <div className="sileo-code-card">
            <div className="sileo-code-header">
              <span>Action Config</span>
              <button className="sileo-btn-copy" onClick={() => handleCopy(actionCode, 'action')}>
                {copiedText === 'action' ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                <span>{copiedText === 'action' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="sileo-code-body">
              <code>{actionCode}</code>
            </pre>
          </div>
        </section>

        {/* Promise Toast */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
          <div>
            <h2 className="sileo-section-title">
              <RefreshCw size={22} style={{ color: 'var(--text-accent)' }} />
              Promise Toast
            </h2>
            <p className="sileo-section-desc">
              Chain loading, success, and error states directly from a single promise. The toast dynamically morphs between states using spring-based SVG transitions.
            </p>
            <p className="sileo-section-desc" style={{ fontSize: '0.85rem', fontStyle: 'italic', marginTop: '-10px' }}>
              The <code>sileo.promise</code> method returns the original promise, so you can chain further callbacks (e.g. <code>.then()</code>, <code>.catch()</code>).
            </p>
            <div style={{ marginTop: '20px' }}>
              <button className="sileo-btn-action" onClick={triggerPromise} disabled={promiseLoading}>
                <RefreshCw size={16} className={promiseLoading ? 'spin-icon' : ''} style={{ animation: promiseLoading ? 'spin 1.5s linear infinite' : 'none' }} />
                <span>{promiseLoading ? 'Procesando...' : 'Probar Promise Toast'}</span>
              </button>
              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          </div>

          <div className="sileo-code-card">
            <div className="sileo-code-header">
              <span>Promise Chaining</span>
              <button className="sileo-btn-copy" onClick={() => handleCopy(promiseCode, 'promise')}>
                {copiedText === 'promise' ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                <span>{copiedText === 'promise' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="sileo-code-body">
              <code>{promiseCode}</code>
            </pre>
          </div>
        </section>

        {/* Positions */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
          <div>
            <h2 className="sileo-section-title">
              <Compass size={22} style={{ color: 'var(--text-accent)' }} />
              Positions
            </h2>
            <p className="sileo-section-desc">
              Sileo supports six window layouts. You can declare a default on the root <code>&lt;Toaster /&gt;</code>, or override on a per-toast call basis.
            </p>
            <div className="sileo-pos-grid">
              <button className="sileo-pos-btn" onClick={() => triggerPosition('top-left')}>top-left</button>
              <button className="sileo-pos-btn" onClick={() => triggerPosition('top-center')}>top-center</button>
              <button className="sileo-pos-btn" onClick={() => triggerPosition('top-right')}>top-right</button>
              <button className="sileo-pos-btn" onClick={() => triggerPosition('bottom-left')}>bottom-left</button>
              <button className="sileo-pos-btn" onClick={() => triggerPosition('bottom-center')}>bottom-center</button>
              <button className="sileo-pos-btn" onClick={() => triggerPosition('bottom-right')}>bottom-right</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="sileo-code-card">
              <div className="sileo-code-header">
                <span>Position Code Override</span>
                <button className="sileo-btn-copy" onClick={() => handleCopy(positionCode, 'position')}>
                  {copiedText === 'position' ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                  <span>{copiedText === 'position' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
              <pre className="sileo-code-body">
                <code>{positionCode}</code>
              </pre>
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Available Positions:</span>
              top-left, top-center, top-right, bottom-left, bottom-center, bottom-right.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
