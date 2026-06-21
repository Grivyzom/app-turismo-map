import React from 'react';

// Dynamic require for web to match _layout.tsx pattern
let sileo: any = null;

if (typeof window !== 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sileoModule = require('sileo');
    sileo = sileoModule;
    require('sileo/styles.css');
  } catch (e) {
    console.warn('[ToastNotification] sileo not available', e);
  }
}

export const ToastToaster: React.FC = () => {
  // Toaster is rendered in _layout.tsx, this is just a placeholder
  return null;
};

export const toast = {
  success: (opts: { title: string; description?: string }) => {
    if (sileo?.success) {
      sileo.success({ title: opts.title, description: opts.description });
    }
  },
  error: (opts: { title: string; description?: string }) => {
    if (sileo?.error) {
      sileo.error({ title: opts.title, description: opts.description });
    }
  },
  warning: (opts: { title: string; description?: string }) => {
    if (sileo?.warning) {
      sileo.warning({ title: opts.title, description: opts.description });
    }
  },
  info: (opts: { title: string; description?: string }) => {
    if (sileo?.info) {
      sileo.info({ title: opts.title, description: opts.description });
    }
  },
  promise: <T>(
    promise: Promise<T> | (() => Promise<T>),
    opts: {
      loading: { title: string; description?: string };
      success: { title: string; description?: string };
      error: { title: string; description?: string };
    }
  ) => {
    if (sileo?.promise) {
      return sileo.promise(promise, opts);
    }
    const p = typeof promise === 'function' ? promise() : promise;
    return p;
  }
};

// Dummy emitter for web
export const toastEmitter = {
  subscribe: () => () => {},
  emit: () => {}
};
