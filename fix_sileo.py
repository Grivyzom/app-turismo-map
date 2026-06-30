import os
import re

admin_dir = "/grivyzom/webs/app-turismo-map/admin/src"

# 1. Create Toast component for admin
toast_code = """import React, { useState, useEffect } from 'react';

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
"""

os.makedirs(os.path.join(admin_dir, "components", "ui"), exist_ok=True)
with open(os.path.join(admin_dir, "components", "ui", "Toast.tsx"), "w") as f:
    f.write(toast_code)

# 2. Modify imports in admin
import glob

def get_relative_path(file_path, target_path):
    rel = os.path.relpath(target_path, os.path.dirname(file_path))
    if not rel.startswith('.'):
        rel = './' + rel
    return rel

for root, _, files in os.walk(admin_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            
            if 'from \'sileo\'' in content or 'from "sileo"' in content:
                toast_path = os.path.join(admin_dir, "components", "ui", "Toast")
                rel_path = get_relative_path(path, toast_path)
                
                content = re.sub(r"from ['\"]sileo['\"]", f"from '{rel_path}'", content)
                content = re.sub(r"import ['\"]sileo/styles\.css['\"][;\n]*", "", content)
                
                with open(path, 'w') as f:
                    f.write(content)

# 3. Create web Toaster for app-turismo
web_toast_code = """import React, { useState, useEffect } from 'react';
import { toastEmitter } from './ToastNotification';

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
"""

with open("/grivyzom/webs/app-turismo-map/app-turismo/src/components/ui/ToastNotification.web.tsx", "w") as f:
    f.write(web_toast_code)

print("Done")
