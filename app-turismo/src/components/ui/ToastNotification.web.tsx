import React, { useState, useEffect } from 'react';
import { toastEmitter } from './toastEmitter';

interface Toast {
  id: string;
  type: string;
  title: string;
  description?: string;
}

let toastCounter = 0;
let currentToasts: Toast[] = [];
let localListeners = new Set<() => void>();

const emitLocal = () => {
  localListeners.forEach(l => l());
};

// Web wrapper that subscribes to the shared emitter
if (typeof window !== 'undefined') {
  toastEmitter.subscribe((msg, type) => {
    const id = `toast_${toastCounter++}`;
    currentToasts = [...currentToasts, { id, type, title: msg }];
    emitLocal();
    setTimeout(() => {
      currentToasts = currentToasts.filter(t => t.id !== id);
      emitLocal();
    }, 4000);
  });
}

export const ToastToaster: React.FC = () => {
  return null;
};

export const SileoToaster: React.FC<{offset?: any}> = ({ offset }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const l = () => setToasts([...currentToasts]);
    localListeners.add(l);
    return () => { localListeners.delete(l); };
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
          background: 'rgba(20, 26, 24, 0.95)',
          backdropFilter: 'blur(12px)',
          border: `1px solid rgba(255,255,255,0.1)`,
          borderLeft: `4px solid ${t.type === 'error' ? '#ef4444' : t.type === 'warning' ? '#e39454' : t.type === 'info' ? '#256487' : '#10b981'}`,
          padding: '16px',
          borderRadius: '12px',
          color: 'white',
          width: '320px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          fontFamily: 'sans-serif'
        }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'white' }}>
            {t.title}
          </h4>
        </div>
      ))}
    </div>
  );
};

export const toast = {
  success: (opts: { title: string; description?: string }) => {
    toastEmitter.emit(opts.title, 'success');
  },
  error: (opts: { title: string; description?: string }) => {
    toastEmitter.emit(opts.title, 'error');
  },
  warning: (opts: { title: string; description?: string }) => {
    toastEmitter.emit(opts.title, 'warning');
  },
  info: (opts: { title: string; description?: string }) => {
    toastEmitter.emit(opts.title, 'info');
  },
  promise: <T,>(
    promise: Promise<T> | (() => Promise<T>),
    opts: {
      loading: { title: string; description?: string };
      success: { title: string; description?: string };
      error: { title: string; description?: string };
    }
  ) => {
    const p = typeof promise === 'function' ? promise() : promise;
    toastEmitter.emit(opts.loading.title, 'info');
    p.then(() => toastEmitter.emit(opts.success.title, 'success'))
     .catch(() => toastEmitter.emit(opts.error.title, 'error'));
    return p;
  }
};
