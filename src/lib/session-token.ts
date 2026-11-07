/**
 * Device session for the signed-in Subject (Subject ID + PIN → token, see api/sync.ts auth
 * actions). The token is a credential: it lives in its own localStorage key, is never part of
 * the synced save (sync-manager only uploads known game keys), and is sent only to this app's
 * own /api/ routes.
 */

export const SESSION_TOKEN_KEY = 'wrp_session_token';
/** Fired when the server says this device's session is missing, expired or revoked. */
export const AUTH_REQUIRED_EVENT = 'wrp:auth-required';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignore
  }
}

function isOwnApiUrl(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

let installed = false;

/**
 * Attaches `Authorization: Bearer <token>` to every request to this app's /api/ routes, so
 * no caller can forget it, and raises AUTH_REQUIRED_EVENT when the server rejects the session.
 * Call once at startup, before anything fetches.
 */
export function installAuthFetch(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isOwnApiUrl(input)) return nativeFetch(input, init);

    const token = getSessionToken();
    let nextInit = init;
    if (token) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      nextInit = { ...init, headers };
    }

    const response = await nativeFetch(input, nextInit);
    if (response.status === 401 || response.status === 403) {
      response
        .clone()
        .json()
        .then((body) => {
          // SUBJECT_MISMATCH: the token belongs to a different Subject than the one this device
          // is signed in as — same remedy, sign in again.
          if (body?.code === 'AUTH_REQUIRED' || body?.code === 'SUBJECT_MISMATCH') {
            window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
          }
        })
        .catch(() => {});
    }
    return response;
  };
}
