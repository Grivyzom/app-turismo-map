import React from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'error';
type Listener = (msg: string, type: ToastType) => void;
const listeners = new Set<Listener>();

export const toastEmitter = {
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emit: (msg: string, type: ToastType) => {
    listeners.forEach((l) => l(msg, type));
  }
};

export const ToastToaster: React.FC = () => {
  return null;
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
  promise: <T>(
    promise: Promise<T> | (() => Promise<T>),
    opts: {
      loading: { title: string; description?: string };
      success: { title: string; description?: string };
      error: { title: string; description?: string };
    }
  ) => {
    const p = typeof promise === 'function' ? promise() : promise;
    toastEmitter.emit(opts.loading.title, 'info');
    p.then(() => {
      toastEmitter.emit(opts.success.title, 'success');
    }).catch(() => {
      toastEmitter.emit(opts.error.title, 'error');
    });
    return p;
  }
};
