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
  },
};
