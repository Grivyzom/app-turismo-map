import React, { ComponentType, LazyExoticComponent } from 'react';

/**
 * Wraps React.lazy with retry logic to handle network failures or chunk loading errors.
 * This is particularly useful for Expo Web where dynamic imports might fail due to
 * unstable connections or stale deployment hashes.
 *
 * @param componentImport A function that returns a promise of a component (e.g., () => import('./MyComponent'))
 * @param retries Number of times to retry before giving up
 * @param interval Milliseconds between retries
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retries: number = 2,
  interval: number = 1000,
): LazyExoticComponent<T> {
  return React.lazy(async () => {
    for (let i = 0; i <= retries; i++) {
      try {
        return await componentImport();
      } catch (error) {
        if (i === retries) {
          console.error(`Failed to load chunk after ${retries} retries:`, error);

          // If we are on web and it's a chunk loading error, we might want to suggest a reload
          if (
            (typeof window !== 'undefined' && (error as any)?.name === 'ChunkLoadError') ||
            (error as any)?.message?.includes('Loading chunk')
          ) {
            // Optional: automatically reload if it's a chunk error (can be disruptive)
            // window.location.reload();
          }

          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    // Should never reach here but for type safety:
    throw new Error('Unexpected end of lazyWithRetry');
  });
}
