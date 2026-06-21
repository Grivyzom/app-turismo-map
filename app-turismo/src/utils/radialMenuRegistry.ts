/**
 * radialMenuRegistry
 *
 * A zero-dependency singleton event bus that ensures only one radial menu
 * is open at a time across all instances (React components and imperative
 * MapLibre DOM nodes alike).
 *
 * Usage:
 *   // Open a menu (all other menus will receive a close signal)
 *   radialMenuRegistry.open('my-unique-id');
 *
 *   // Subscribe to changes (returns an unsubscribe function)
 *   const unsub = radialMenuRegistry.subscribe((openId) => {
 *     if (openId !== 'my-unique-id') closeMyMenu();
 *   });
 *   unsub(); // call when component unmounts
 */

type Listener = (openMenuId: string | null) => void;

const listeners = new Set<Listener>();

/** Currently open menu ID (null = all closed). */
let currentOpenId: string | null = null;

export const radialMenuRegistry = {
  /** Returns the currently open menu id, or null. */
  getCurrent(): string | null {
    return currentOpenId;
  },

  /**
   * Signal that the menu with `id` is now open.
   * All other menus that are listening will receive a close signal.
   */
  open(id: string): void {
    currentOpenId = id;
    listeners.forEach((fn) => fn(id));
  },

  /**
   * Signal that the menu with `id` is now closed.
   * Only resets current state if this menu was the one open.
   */
  close(id: string): void {
    if (currentOpenId === id) {
      currentOpenId = null;
      listeners.forEach((fn) => fn(null));
    }
  },

  /**
   * Subscribe to menu open/close events.
   * The listener receives the id of the newly-opened menu, or null when all close.
   * Returns an unsubscribe function — call it in cleanup / componentWillUnmount.
   */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
