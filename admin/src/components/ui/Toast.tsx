import React, { useState, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

let toastCounter = 0;
type Listener = () => void;
const listeners = new Set<Listener>();

let currentToasts: Toast[] = [];

const emit = () => {
  listeners.forEach(l => l());
};

const addToast = (type: ToastType, opts: { title: string; description?: string }) => {
  const id = `toast_${toastCounter++}`;
  currentToasts = [...currentToasts, { id, type, ...opts }];
  emit();
  setTimeout(() => {
    currentToasts = currentToasts.filter(t => t.id !== id);
    emit();
  }, 4000);
  return id;
};

export const sileo = {
  success: (opts: any) => addToast('success', opts),
  error: (opts: any) => addToast('error', opts),
  warning: (opts: any) => addToast('warning', opts),
  info: (opts: any) => addToast('info', opts),
  action: (opts: any) => addToast('info', opts),
  promise: <T,>(p: Promise<T> | (() => Promise<T>), opts: any) => {
    const promise = typeof p === 'function' ? p() : p;
    addToast('info', { title: opts.loading.title, description: opts.loading.description });
    promise.then(() => addToast('success', { title: opts.success.title, description: opts.success.description }))
     .catch(() => addToast('error', { title: opts.error.title, description: opts.error.description }));
    return promise;
  }
};

export const Toaster: React.FC<{position?: string, offset?: any}> = ({ offset }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const l = () => setToasts([...currentToasts]);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: offset?.top || 24,
      right: offset?.right || 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'var(--glass-bg, rgba(20, 26, 24, 0.95))',
          backdropFilter: 'blur(12px)',
          border: `1px solid var(--border-subtle)`,
          borderLeft: `4px solid ${t.type === 'error' ? 'var(--danger)' : t.type === 'warning' ? 'var(--warning)' : t.type === 'info' ? 'var(--info)' : 'var(--success)'}`,
          padding: '16px',
          borderRadius: '12px',
          color: 'white',
          width: '320px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          animation: 'slideIn 0.3s ease'
        }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'white' }}>
            {t.title}
          </h4>
          {t.description && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.description}</p>}
        </div>
      ))}
    </div>
  );
};
