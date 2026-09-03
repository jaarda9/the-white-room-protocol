/**
 * SyncManager - Handles MongoDB synchronization with localStorage fallback
 * Based on the syslvlup-main UserManager pattern
 */
import {
  mergeGenerationKeysIntoSyncBlob,
  restoreGenerationKeysFromSyncBlob,
} from '@/lib/synced-localstorage-keys';

/** Must match `STORAGE_KEYS.PHYSICAL_QUEST_LOGS` in storage.ts (avoid circular import). */
const PHYSICAL_QUEST_LOGS_KEY = 'whiteroom_physical_quest_logs';
/** Must match `STORAGE_KEYS.TODOS` in storage.ts (avoid circular import). */
const TODOS_KEY = 'whiteroom_todos';

class SyncManager {
  private userId: string | null = null;
  private data: any = null;
  private isLoading: boolean = false;
  private lastLoadTime: number = 0;
  private readonly SAVE_COOLDOWN_MS = 5000; // 5 seconds cooldown after load

  /**
   * Get or generate a user ID
   * Uses profile ID from localStorage or generates a new one
   */
  /**
   * Clear sync state (e.g. sign-out or switching subjects)
   */
  clearUser(): void {
    this.userId = null;
    this.data = null;
    this.lastLoadTime = 0;
    this.isLoading = false;
  }

  getUserId(): string | null {
    if (this.userId) {
      return this.userId;
    }

    // Try to get from existing profile
    try {
      const profileStr = localStorage.getItem('whiteroom_user_profile');
      if (profileStr) {
        const profile = JSON.parse(profileStr);
        if (profile?.id) {
          this.userId = profile.id;
          return this.userId;
        }
      }
    } catch (error) {
      console.error('Error reading profile for userId:', error);
    }

    return null;
  }

  /**
   * Set the user ID and load data
   * Returns both the user ID and whether data was found
   */
  async setUserId(userId: string): Promise<{ userId: string; dataFound: boolean }> {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID cannot be empty');
    }
    
    this.userId = userId.trim();
    console.log('User ID set to:', this.userId);
    
    // Try to load existing data for this user
    const loadResult = await this.loadUserData();
    
    // Return both the user ID and whether data was found
    const dataFound = !!(loadResult.success && this.data);
    console.log('Data found check:', {
      loadResultSuccess: loadResult.success,
      hasData: !!this.data,
      dataFound: dataFound
    });
    
    return {
      userId: this.userId,
      dataFound: dataFound
    };
  }

  /**
   * Load user data from MongoDB using user ID
   */
  async loadUserData(): Promise<{ success: boolean; data?: any; message?: string }> {
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    if (this.isLoading) {
      console.log('Already loading data, skipping...');
      return { success: false, message: 'Already loading' };
    }

    this.isLoading = true;
    console.log('Loading user data for:', this.userId);

    try {
      // Try to load from /api/sync first
      const timestamp = Date.now();
      const syncUrl = `/api/sync?userId=${encodeURIComponent(this.userId)}&_t=${timestamp}`;
      console.log('Trying sync API URL:', syncUrl);
      
      let response = await fetch(syncUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('Sync API response status:', response.status);

      // If sync API fails, try /api/users as fallback (just like SysLVLUP user-manager)
      if (!response.ok && response.status !== 404) {
        console.log(`Sync API returned ${response.status}, trying fallback /api/users...`);
        try {
          const fallbackResp = await fetch(`/api/users?userId=${encodeURIComponent(this.userId)}&_t=${timestamp}`, {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          if (fallbackResp.ok) {
            response = fallbackResp;
            console.log('Fallback users API succeeded with status:', response.status);
          }
        } catch (fbErr) {
          console.warn('Fallback users API request failed:', fbErr);
        }
      }
      
      if (response.ok) {
        const result = await response.json();
        console.log('API response data:', result);
        
        const loadedData = result.localStorageData || result.localStorage || result;
        const hasContent = loadedData && (
          loadedData.userProfile || 
          loadedData.whiteroom_user_profile || 
          loadedData.gameData || 
          result.exp !== undefined || 
          result.xp !== undefined ||
          result.userProfile ||
          result.gameData
        );

        if (hasContent) {
          this.data = {
            ...(result.localStorageData || result.localStorage || {}),
            ...(result.userProfile ? { userProfile: result.userProfile } : {}),
            ...(result.gameData ? { gameData: result.gameData } : {}),
            ...(result.exp !== undefined ? { exp: result.exp } : {}),
            ...(result.xp !== undefined ? { xp: result.xp } : {}),
          };
          this.lastLoadTime = Date.now();
          console.log('Data loaded successfully from API:', this.data);
          
          // Restore to localStorage
          this.restoreToLocalStorage(this.data);
          
          return { success: true, data: this.data };
        } else {
          console.log('No existing data found for user:', this.userId);
          this.data = null;
          return { success: true, message: 'No existing data' };
        }
      } else if (response.status === 404) {
        // Check if it's a 404 from the API (user not found) or a 404 from Vercel (API not found)
        try {
          const errorData = await response.json();
          if (errorData.error === 'User not found') {
            console.log('User not found in database:', this.userId);
            this.data = null;
            return { success: true, message: 'No existing data' };
          }
        } catch (parseError) {
          // If we can't parse the response, it might be a Vercel 404
          console.log('API endpoint not found (404), treating as no existing data');
          this.data = null;
          return { success: true, message: 'No existing data' };
        }
        
        console.log('No existing data found for user:', this.userId);
        this.data = null;
        return { success: true, message: 'No existing data' };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // If there's a network error or API is not available, treat as no existing data
      console.log('API error, treating as no existing data');
      this.data = null;
      return { success: true, message: 'No existing data' };
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Restore data from MongoDB to localStorage
   */
  private restoreToLocalStorage(data: any): void {
    if (!data) return;

    try {
      // 1. Extract profile from multiple possible structures
      let profile = data.userProfile;
      if (!profile && data.whiteroom_user_profile) {
        try {
          profile =
            typeof data.whiteroom_user_profile === 'string'
              ? JSON.parse(data.whiteroom_user_profile)
              : data.whiteroom_user_profile;
        } catch {
          // ignore
        }
      }

      const gameData = data.gameData || {};
      const expFromData = data.exp ?? data.xp ?? gameData.exp ?? gameData.xp;
      const levelFromData = data.level ?? gameData.level;

      if (!profile && (expFromData !== undefined || levelFromData !== undefined)) {
        profile = {
          id: this.userId || 'SUBJECT',
          level: Number(levelFromData || 1),
          xp: Number(expFromData || 0),
          exp: Number(expFromData || 0),
          displayName: gameData.name || 'Hunter',
          pseudo: `SUBJECT-${this.userId}`,
          visibleStats: gameData.Attributes || {
            STR: 48,
            AGI: 27,
            VIT: 27,
            INT: 27,
            PER: 27,
            WIS: 27,
          },
        };
      }

      if (profile && typeof profile === 'object') {
        const resolvedXp = Number(profile.xp ?? profile.exp ?? expFromData ?? 0);
        const resolvedLevel = Number(profile.level ?? levelFromData ?? 1);

        const restoredProfile = {
          ...profile,
          id: this.userId || profile.id,
          level: resolvedLevel,
          xp: resolvedXp,
          exp: resolvedXp,
          pseudo:
            typeof profile.pseudo === 'string' && profile.pseudo.length > 0
              ? profile.pseudo
              : `SUBJECT-${this.userId}`,
        };

        localStorage.setItem('whiteroom_user_profile', JSON.stringify(restoredProfile));

        // Dispatch update event immediately so status page and header reflect the loaded DB state!
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wrp:profile-updated', { detail: restoredProfile }));
          window.dispatchEvent(new CustomEvent('wrp:quests-updated'));
        }
      }

      if (data.quests) {
        localStorage.setItem('whiteroom_quests', JSON.stringify(data.quests));
      }
      if (data.questAttempts) {
        localStorage.setItem('whiteroom_quest_attempts', JSON.stringify(data.questAttempts));
      }
      if (data.dailyReset) {
        localStorage.setItem('whiteroom_daily_reset', data.dailyReset);
      }
      const physicalLogs = (data as Record<string, unknown>).physicalQuestLogs;
      if (typeof physicalLogs === 'string' && physicalLogs.length > 0) {
        localStorage.setItem(PHYSICAL_QUEST_LOGS_KEY, physicalLogs);
      }
      const todosPayload = (data as Record<string, unknown>).todos;
      if (typeof todosPayload === 'string' && todosPayload.length > 0) {
        localStorage.setItem(TODOS_KEY, todosPayload);
      }
      // Calendar events are stored under a per-subject key.
      if (this.userId) {
        const calendarKey = `whiteroom_calendar_events:${this.userId}`;
        const calendarPayload = (data as Record<string, unknown>)[calendarKey];
        if (typeof calendarPayload === 'string' && calendarPayload.length > 0) {
          localStorage.setItem(calendarKey, calendarPayload);
        }
      }
      if (data && typeof data === 'object') {
        restoreGenerationKeysFromSyncBlob(data as Record<string, unknown>);
      }
      console.log('Data restored to localStorage');
    } catch (error) {
      console.error('Error restoring to localStorage:', error);
    }
  }

  /**
   * Collect all localStorage data into a blob
   */
  private collectLocalStorageData(): any {
    const data: any = {};

    try {
      const profileStr = localStorage.getItem('whiteroom_user_profile');
      if (profileStr) {
        const parsedProfile = JSON.parse(profileStr);
        const xpVal = Number(parsedProfile.xp ?? parsedProfile.exp ?? 0);
        parsedProfile.xp = xpVal;
        parsedProfile.exp = xpVal;

        data.userProfile = parsedProfile;
        data.whiteroom_user_profile = JSON.stringify(parsedProfile);
        data.exp = xpVal;
        data.xp = xpVal;
        data.level = parsedProfile.level || 1;

        data.gameData = {
          level: parsedProfile.level || 1,
          exp: xpVal,
          xp: xpVal,
          hp: 2220,
          mp: 350,
          stm: 100,
          fatigue: parsedProfile.fatigue ?? 0,
          name: parsedProfile.displayName || parsedProfile.pseudo || this.userId,
          Attributes: parsedProfile.visibleStats || {},
        };
      }

      const questsStr = localStorage.getItem('whiteroom_quests');
      if (questsStr) {
        data.quests = JSON.parse(questsStr);
      }

      const attemptsStr = localStorage.getItem('whiteroom_quest_attempts');
      if (attemptsStr) {
        data.questAttempts = JSON.parse(attemptsStr);
      }

      const dailyReset = localStorage.getItem('whiteroom_daily_reset');
      if (dailyReset) {
        data.dailyReset = dailyReset;
      }

      const physicalQuestLogs = localStorage.getItem(PHYSICAL_QUEST_LOGS_KEY);
      if (physicalQuestLogs) {
        data.physicalQuestLogs = physicalQuestLogs;
      }

      const todos = localStorage.getItem(TODOS_KEY);
      if (todos) {
        data.todos = todos;
      }

      if (this.userId) {
        const calendarKey = `whiteroom_calendar_events:${this.userId}`;
        const calendarPayload = localStorage.getItem(calendarKey);
        if (calendarPayload) {
          data[calendarKey] = calendarPayload;
        }
      }

      mergeGenerationKeysIntoSyncBlob(data as Record<string, unknown>);
    } catch (error) {
      console.error('Error collecting localStorage data:', error);
    }

    return data;
  }

  /**
   * Save user data to database (with cooldown check)
   */
  async saveUserData(): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    // Collect current localStorage data
    const localStorageData = this.collectLocalStorageData();

    if (!localStorageData || Object.keys(localStorageData).length === 0) {
      console.log('No data to save');
      return { success: true };
    }

    // Prevent saving immediately after loading (within cooldown period)
    const timeSinceLoad = Date.now() - this.lastLoadTime;
    if (timeSinceLoad < this.SAVE_COOLDOWN_MS) {
      console.log(`Skipping save - data was loaded recently (${timeSinceLoad}ms ago)`);
      return { success: true };
    }

    console.log('Saving user data for:', this.userId);
    console.log('Data to save:', localStorageData);

    try {
      const requestBody = {
        userId: this.userId,
        localStorageData: localStorageData
      };
      
      console.log('Request body:', requestBody);
      
      let response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.log(`POST /api/sync returned ${response.status}, trying fallback /api/users...`);
        try {
          const fallbackResp = await fetch('/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
          if (fallbackResp.ok) {
            response = fallbackResp;
          }
        } catch {
          // ignore
        }
      }

      console.log('Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Data saved successfully via API:', result);
        return { success: true, data: result };
      } else {
        const errorText = await response.text();
        console.error('API response error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error saving user data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Force save user data to database (bypasses cooldown check)
   */
  async forceSaveUserData(): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    const localStorageData = this.collectLocalStorageData();

    if (!localStorageData || Object.keys(localStorageData).length === 0) {
      console.log('No data to save');
      return { success: true };
    }

    console.log('Force saving user data for:', this.userId);

    try {
      const requestBody = {
        userId: this.userId,
        localStorageData: localStorageData
      };
      
      let response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.log(`POST /api/sync returned ${response.status}, trying fallback /api/users...`);
        try {
          const fallbackResp = await fetch('/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
          if (fallbackResp.ok) {
            response = fallbackResp;
          }
        } catch {
          // ignore
        }
      }

      if (response.ok) {
        const result = await response.json();
        console.log('Data force saved successfully via API:', result);
        return { success: true, data: result };
      } else {
        const errorText = await response.text();
        console.error('API response error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error force saving user data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Initialize sync manager with user ID from profile
   */
  async initialize(): Promise<void> {
    const userId = this.getUserId();
    if (userId) {
      await this.setUserId(userId);
    }
  }
}

// Export singleton instance
export const syncManager = new SyncManager();

let generationSyncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced push to MongoDB after lab AI / knowledge / social caches are written to localStorage.
 * Uses force save so it is not blocked by the post-load cooldown.
 */
export function scheduleSyncAfterGeneratedContentSave(): void {
  if (typeof window === 'undefined') return;
  if (!syncManager.getUserId()) return;
  if (generationSyncTimer) clearTimeout(generationSyncTimer);
  generationSyncTimer = setTimeout(() => {
    generationSyncTimer = null;
    syncManager.forceSaveUserData().catch((e) => console.warn('[Sync] Generated content sync failed:', e));
  }, 1200);
}

