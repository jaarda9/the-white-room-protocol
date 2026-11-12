/**
 * Asks the sync manager to push the save soon (debounced there). An event instead of an
 * import, so small storage modules can call it without import cycles — several of them sit
 * inside sync-manager's own import graph (synced-localstorage-keys.ts → rank-load.ts).
 *
 * Without it, a synced key changed on its own (not followed by a profile or quest save) only
 * reaches the server with some later save — and a reload before that restores the older server
 * copy over it.
 */
export const REQUEST_SYNC_EVENT = 'wrp:request-sync';

export function requestSync(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(REQUEST_SYNC_EVENT));
  }
}
