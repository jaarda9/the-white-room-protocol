/**
 * Runs before every other module. It must stay the FIRST import in main.tsx: ES modules
 * evaluate their imports in order, and some modules (storage.ts) start a sync request at
 * import time. Installed any later, that first request would go out without the session token,
 * get a 401, and be treated as "no saved data".
 */
import { installAuthFetch } from './session-token';
import { captureInstallPrompt } from './install-mode';

installAuthFetch();
// Chromium fires its install prompt early, sometimes before React mounts.
captureInstallPrompt();
