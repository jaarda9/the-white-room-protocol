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

function calculateXPForLevel(level: number): number {
  return Math.floor(100 + (Math.max(1, level) - 1) * 120);
}

function getHunterRank(level: number): 'E' | 'D' | 'C' | 'B' | 'A' | 'S' {
  if (level >= 50) return 'S';
  if (level >= 40) return 'A';
  if (level >= 30) return 'B';
  if (level >= 20) return 'C';
  if (level >= 10) return 'D';
  return 'E';
}

function extractAttr(key: string, ...sources: any[]): number | undefined {
  const upper = key.toUpperCase();
  const lower = key.toLowerCase();
  const alternates = [upper, lower];
  if (upper === 'STR') alternates.push('stg', 'STG', 'str_stat', 'strength', 'Strength');
  if (upper === 'AGI') alternates.push('dex', 'DEX', 'agi_stat', 'agility', 'Agility');
  if (upper === 'VIT') alternates.push('con', 'CON', 'vit_stat', 'vitality', 'Vitality');
  if (upper === 'INT') alternates.push('int_stat', 'intelligence', 'Intelligence');
  if (upper === 'PER') alternates.push('sen', 'SEN', 'per_stat', 'perception', 'Perception');
  if (upper === 'WIS') alternates.push('wis_stat', 'wisdom', 'Wisdom');

  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const alt of alternates) {
      if (src[alt] !== undefined && src[alt] !== null && src[alt] !== '') {
        const n = Number(src[alt]);
        if (Number.isFinite(n) && n >= 0) return Math.floor(n);
      }
    }
  }
  return undefined;
}

function safeJsonParse<T>(val: any, fallback: T): T {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val !== 'string') return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function isSameCalendarDay(d1?: string | null, d2: Date = new Date()): boolean {
  if (!d1) return false;
  if (d1 === d2.toDateString()) return true;
  const year = d2.getFullYear();
  const month = String(d2.getMonth() + 1).padStart(2, '0');
  const day = String(d2.getDate()).padStart(2, '0');
  const ymd = `${year}-${month}-${day}`;
  if (d1 === ymd) return true;
  const parsed = new Date(d1);
  if (isNaN(parsed.getTime())) return false;
  return (
    parsed.getFullYear() === d2.getFullYear() &&
    parsed.getMonth() === d2.getMonth() &&
    parsed.getDate() === d2.getDate()
  );
}

class SyncManager {
  private userId: string | null = null;
  private data: any = null;
  private isLoading: boolean = false;
  private lastLoadTime: number = 0;
  private readonly SAVE_COOLDOWN_MS = 5000; // 5 seconds cooldown after load
  private pendingSaveTimeout: any = null;

  /**
   * Get or generate a user ID
   * Uses profile ID from localStorage or generates a new one
   */
  /**
   * Clear sync state (e.g. sign-out or switching subjects)
   */
  clearUser(): void {
    if (this.pendingSaveTimeout) {
      clearTimeout(this.pendingSaveTimeout);
      this.pendingSaveTimeout = null;
    }
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
          result.gameData ||
          result.Attributes ||
          result.stats ||
          result.level !== undefined
        );

        if (hasContent) {
          this.data = {
            ...(result.localStorageData || result.localStorage || {}),
            ...(result.userProfile ? { userProfile: result.userProfile } : {}),
            ...(result.gameData ? { gameData: result.gameData } : {}),
            ...(result.Attributes ? { Attributes: result.Attributes } : {}),
            ...(result.stats ? { stats: result.stats } : {}),
            ...(result.level !== undefined ? { level: result.level } : {}),
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
      // Read current local state before any overwrites!
      const currentLocalProfileStr = localStorage.getItem('whiteroom_user_profile');
      const currentLocalProfile = safeJsonParse<any>(currentLocalProfileStr, null);
      const currentLocalQuestsStr = localStorage.getItem('whiteroom_quests');
      const currentLocalQuests = safeJsonParse<any[]>(currentLocalQuestsStr, []);
      const currentLocalDailyReset = localStorage.getItem('whiteroom_daily_reset');
      const currentLocalTodosStr = localStorage.getItem(TODOS_KEY);
      const currentLocalTodos = safeJsonParse<any[]>(currentLocalTodosStr, []);
      const currentLocalInventoryStr = localStorage.getItem('whiteroom_hunter_inventory');
      const currentLocalInventory = safeJsonParse<any>(currentLocalInventoryStr, null);
      const currentLocalAttemptsStr = localStorage.getItem('whiteroom_quest_attempts');
      const currentLocalAttempts = safeJsonParse<any>(currentLocalAttemptsStr, null);

      // 1. Extract remote profile from multiple possible structures
      let remoteProfile = data.userProfile;
      if (!remoteProfile && data.whiteroom_user_profile) {
        remoteProfile = safeJsonParse<any>(data.whiteroom_user_profile, null);
      }

      const gameData = data.gameData || {};
      const expFromData = data.exp ?? data.xp ?? gameData.exp ?? gameData.xp;
      const levelFromData = data.level ?? gameData.level;

      const hasOldHardcodedStats =
        remoteProfile?.visibleStats &&
        remoteProfile.visibleStats.STR === 48 &&
        remoteProfile.visibleStats.INT === 27 &&
        remoteProfile.visibleStats.AGI === 27;

      const remoteLevel = Number(
        data.level ??
        gameData.level ??
        levelFromData ??
        (remoteProfile?.level !== 18 || data.level ? remoteProfile?.level : undefined) ??
        remoteProfile?.level ??
        1
      );
      const localLevel = Number(currentLocalProfile?.level) || 1;
      const resolvedLevel = Math.max(localLevel, remoteLevel);

      const remoteXp = Number(
        data.exp ??
        data.xp ??
        expFromData ??
        gameData.exp ??
        gameData.xp ??
        remoteProfile?.xp ??
        remoteProfile?.exp ??
        0
      );
      const localXp = Number(currentLocalProfile?.xp ?? currentLocalProfile?.exp ?? 0);
      let resolvedXp = 0;
      if (resolvedLevel === localLevel && resolvedLevel === remoteLevel) {
        resolvedXp = Math.max(localXp, remoteXp);
      } else if (resolvedLevel === localLevel) {
        resolvedXp = localXp;
      } else {
        resolvedXp = remoteXp;
      }

      // Merge stats taking the max of local and remote so stat points are never lost/reset to 10
      const localStats = currentLocalProfile?.visibleStats || {};
      const resolvedStats = {
        STR: Math.max(Number(localStats.STR) || 10, extractAttr('STR', data.Attributes, gameData.Attributes, data.stats, data.attributes, (!hasOldHardcodedStats ? remoteProfile?.visibleStats : undefined), remoteProfile?.visibleStats) ?? 10),
        AGI: Math.max(Number(localStats.AGI) || 10, extractAttr('AGI', data.Attributes, gameData.Attributes, data.stats, data.attributes, (!hasOldHardcodedStats ? remoteProfile?.visibleStats : undefined), remoteProfile?.visibleStats) ?? 10),
        VIT: Math.max(Number(localStats.VIT) || 10, extractAttr('VIT', data.Attributes, gameData.Attributes, data.stats, data.attributes, (!hasOldHardcodedStats ? remoteProfile?.visibleStats : undefined), remoteProfile?.visibleStats) ?? 10),
        INT: Math.max(Number(localStats.INT) || 10, extractAttr('INT', data.Attributes, gameData.Attributes, data.stats, data.attributes, (!hasOldHardcodedStats ? remoteProfile?.visibleStats : undefined), remoteProfile?.visibleStats) ?? 10),
        PER: Math.max(Number(localStats.PER) || 10, extractAttr('PER', data.Attributes, gameData.Attributes, data.stats, data.attributes, (!hasOldHardcodedStats ? remoteProfile?.visibleStats : undefined), remoteProfile?.visibleStats) ?? 10),
        WIS: Math.max(Number(localStats.WIS) || 10, extractAttr('WIS', data.Attributes, gameData.Attributes, data.stats, data.attributes, (!hasOldHardcodedStats ? remoteProfile?.visibleStats : undefined), remoteProfile?.visibleStats) ?? 10),
      };

      const resolvedName = data.name || gameData.name || currentLocalProfile?.displayName || (remoteProfile?.displayName !== 'Sung Jin-woo' ? remoteProfile?.displayName : undefined) || remoteProfile?.fullName || 'Subject';
      const resolvedTitle = data.title || gameData.title || currentLocalProfile?.title || (remoteProfile?.title && remoteProfile.title !== 'Wolf Assassin' ? remoteProfile.title : undefined) || (resolvedLevel >= 10 ? 'Wolf Assassin' : 'Novice Hunter');

      const localAP = currentLocalProfile?.availableAP;
      const remoteAP = Number(data.availableAP ?? data.availablePoints ?? gameData.availablePoints ?? remoteProfile?.availableAP ?? 0);
      const resolvedAP = (resolvedLevel > localLevel)
        ? remoteAP
        : (localAP !== undefined ? Number(localAP) : remoteAP);

      const resolvedFatigue = currentLocalProfile?.fatigue !== undefined
        ? Number(currentLocalProfile.fatigue)
        : Number(data.fatigue ?? gameData.fatigue ?? remoteProfile?.fatigue ?? 0);

      // Preserve Vitals (HP, MP, STM, and timestamps) from local or remote
      const resolvedHp = currentLocalProfile?.hp || remoteProfile?.hp;
      const resolvedMp = currentLocalProfile?.mp || remoteProfile?.mp;
      const resolvedStm = currentLocalProfile?.stm || remoteProfile?.stm;
      const resolvedVitalsLastUpdatedAt = Math.max(
        currentLocalProfile?.vitalsLastUpdatedAt || 0,
        remoteProfile?.vitalsLastUpdatedAt || 0
      );

      const mergedAccumulatedPoints = {
        STR: Math.max(currentLocalProfile?.accumulatedPoints?.STR || 0, remoteProfile?.accumulatedPoints?.STR || 0),
        AGI: Math.max(currentLocalProfile?.accumulatedPoints?.AGI || 0, remoteProfile?.accumulatedPoints?.AGI || 0),
        VIT: Math.max(currentLocalProfile?.accumulatedPoints?.VIT || 0, remoteProfile?.accumulatedPoints?.VIT || 0),
        INT: Math.max(currentLocalProfile?.accumulatedPoints?.INT || 0, remoteProfile?.accumulatedPoints?.INT || 0),
        PER: Math.max(currentLocalProfile?.accumulatedPoints?.PER || 0, remoteProfile?.accumulatedPoints?.PER || 0),
        WIS: Math.max(currentLocalProfile?.accumulatedPoints?.WIS || 0, remoteProfile?.accumulatedPoints?.WIS || 0),
      };

      const restoredProfile = {
        ...(remoteProfile || {}),
        ...(currentLocalProfile || {}),
        id: this.userId || currentLocalProfile?.id || remoteProfile?.id || 'SUBJECT',
        displayName: resolvedName,
        pseudo: typeof currentLocalProfile?.pseudo === 'string' && currentLocalProfile.pseudo.length > 0
          ? currentLocalProfile.pseudo
          : (typeof remoteProfile?.pseudo === 'string' && remoteProfile.pseudo.length > 0 ? remoteProfile.pseudo : `SUBJECT-${this.userId}`),
        level: resolvedLevel,
        xp: resolvedXp,
        exp: resolvedXp,
        visibleStats: resolvedStats,
        xpToNextLevel: currentLocalProfile?.xpToNextLevel || remoteProfile?.xpToNextLevel || calculateXPForLevel(resolvedLevel),
        hunterRank: currentLocalProfile?.hunterRank || remoteProfile?.hunterRank || getHunterRank(resolvedLevel),
        job: currentLocalProfile?.job || remoteProfile?.job || gameData.job || 'None',
        title: resolvedTitle,
        fullName: currentLocalProfile?.fullName || remoteProfile?.fullName || resolvedName,
        availableAP: resolvedAP,
        fatigue: Math.max(0, Math.min(100, resolvedFatigue)),
        accumulatedPoints: mergedAccumulatedPoints,
        ...(resolvedHp ? { hp: resolvedHp } : {}),
        ...(resolvedMp ? { mp: resolvedMp } : {}),
        ...(resolvedStm ? { stm: resolvedStm } : {}),
        ...(resolvedVitalsLastUpdatedAt > 0 ? { vitalsLastUpdatedAt: resolvedVitalsLastUpdatedAt } : {}),
      };

      localStorage.setItem('whiteroom_user_profile', JSON.stringify(restoredProfile));

      const restoredGameData = {
        ...gameData,
        level: resolvedLevel,
        exp: resolvedXp,
        xp: resolvedXp,
        name: resolvedName,
        Attributes: resolvedStats,
        fatigue: restoredProfile.fatigue,
        title: resolvedTitle,
      };
      localStorage.setItem('gameData', JSON.stringify(restoredGameData));

      // 2. DAILY RESET & QUESTS MERGING
      const today = new Date().toDateString();
      const remoteDailyReset = data.dailyReset || data.whiteroom_daily_reset;
      const isLocalToday = isSameCalendarDay(currentLocalDailyReset, new Date());
      const isRemoteToday = isSameCalendarDay(remoteDailyReset, new Date());

      if (isLocalToday || isRemoteToday) {
        localStorage.setItem('whiteroom_daily_reset', today);
      } else if (remoteDailyReset) {
        localStorage.setItem('whiteroom_daily_reset', remoteDailyReset);
      }

      // Quests merge
      const remoteQuests = safeJsonParse<any[]>(data.quests || data.whiteroom_quests, []);
      let finalQuests: any[] = [];

      if (currentLocalQuests.length > 0 && remoteQuests.length > 0) {
        const questMap = new Map<string, any>();
        // Base on remote quests
        remoteQuests.forEach((rq) => {
          if (rq && rq.id) questMap.set(rq.id, { ...rq });
        });
        // Merge in local quests (preserve completed status and completedAt)
        currentLocalQuests.forEach((lq) => {
          if (!lq || !lq.id) return;
          const existing = questMap.get(lq.id);
          if (existing) {
            if (lq.completed) {
              existing.completed = true;
              existing.completedAt = lq.completedAt || existing.completedAt || new Date().toISOString();
            }
          } else {
            questMap.set(lq.id, lq);
          }
        });
        finalQuests = Array.from(questMap.values());
      } else if (currentLocalQuests.length > 0) {
        finalQuests = currentLocalQuests;
      } else if (remoteQuests.length > 0) {
        finalQuests = remoteQuests;
      }

      if (finalQuests.length > 0) {
        localStorage.setItem('whiteroom_quests', JSON.stringify(finalQuests));
      }

      // Quest attempts merge
      const remoteAttempts = safeJsonParse<any>(data.questAttempts || data.whiteroom_quest_attempts, null);
      if (currentLocalAttempts && remoteAttempts) {
        const mergedAttempts = { ...remoteAttempts, ...currentLocalAttempts };
        localStorage.setItem('whiteroom_quest_attempts', JSON.stringify(mergedAttempts));
      } else if (currentLocalAttempts) {
        localStorage.setItem('whiteroom_quest_attempts', JSON.stringify(currentLocalAttempts));
      } else if (remoteAttempts) {
        localStorage.setItem('whiteroom_quest_attempts', JSON.stringify(remoteAttempts));
      }

      // 3. HUNTER INVENTORY MERGE
      const remoteInventory = safeJsonParse<any>(
        data.whiteroom_hunter_inventory || data.hunterInventory || data.inventory,
        null
      );
      if (currentLocalInventory && remoteInventory) {
        const mergedInventory = { ...remoteInventory, ...currentLocalInventory };
        if (currentLocalInventory.items && remoteInventory.items) {
          mergedInventory.items = { ...remoteInventory.items, ...currentLocalInventory.items };
          ['hydrate', 'focusBrew', 'coldExposure', 'activeRest'].forEach((k) => {
            const loc = currentLocalInventory.items[k];
            const rem = remoteInventory.items[k];
            if (loc || rem) {
              mergedInventory.items[k] = {
                usedToday: Math.max(loc?.usedToday || 0, rem?.usedToday || 0),
                lastUsedAt: Math.max(loc?.lastUsedAt || 0, rem?.lastUsedAt || 0) || null,
              };
            }
          });
        }
        localStorage.setItem('whiteroom_hunter_inventory', JSON.stringify(mergedInventory));
      } else if (currentLocalInventory) {
        localStorage.setItem('whiteroom_hunter_inventory', JSON.stringify(currentLocalInventory));
      } else if (remoteInventory) {
        localStorage.setItem('whiteroom_hunter_inventory', JSON.stringify(remoteInventory));
      }

      // 4. TO-DOS MERGE
      const remoteTodos = safeJsonParse<any[]>(data.todos || data.whiteroom_todos, []);
      if (currentLocalTodos.length > 0 && remoteTodos.length > 0) {
        const todoMap = new Map<string, any>();
        remoteTodos.forEach((t) => { if (t?.id) todoMap.set(t.id, { ...t }); });
        currentLocalTodos.forEach((lt) => {
          if (!lt || !lt.id) return;
          const ex = todoMap.get(lt.id);
          if (ex) {
            if (lt.status === 'completed') {
              ex.status = 'completed';
              ex.completedAt = lt.completedAt || ex.completedAt;
            }
          } else {
            todoMap.set(lt.id, lt);
          }
        });
        localStorage.setItem(TODOS_KEY, JSON.stringify(Array.from(todoMap.values())));
      } else if (currentLocalTodos.length > 0) {
        localStorage.setItem(TODOS_KEY, JSON.stringify(currentLocalTodos));
      } else if (remoteTodos.length > 0) {
        localStorage.setItem(TODOS_KEY, JSON.stringify(remoteTodos));
      }

      // 5. Restore other keys without clobbering the merged keys
      const handledKeys = new Set([
        'whiteroom_user_profile',
        'gameData',
        'whiteroom_quests',
        'whiteroom_daily_reset',
        'whiteroom_hunter_inventory',
        'whiteroom_quest_attempts',
        TODOS_KEY,
      ]);

      const physicalLogs = (data as Record<string, unknown>).physicalQuestLogs || (data as Record<string, unknown>).whiteroom_physical_quest_logs;
      if (typeof physicalLogs === 'string' && physicalLogs.length > 0) {
        localStorage.setItem(PHYSICAL_QUEST_LOGS_KEY, physicalLogs);
      }
      if (this.userId) {
        const calendarKey = `whiteroom_calendar_events:${this.userId}`;
        const calendarPayload = (data as Record<string, unknown>)[calendarKey];
        if (typeof calendarPayload === 'string' && calendarPayload.length > 0) {
          localStorage.setItem(calendarKey, calendarPayload);
        }
      }

      if (data && typeof data === 'object') {
        Object.entries(data).forEach(([k, v]) => {
          if (k.startsWith('whiteroom_') && !handledKeys.has(k) && v !== undefined && v !== null) {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          }
        });
      }

      restoreGenerationKeysFromSyncBlob(data as Record<string, unknown>);

      // 6. Dispatch events
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wrp:profile-updated', { detail: restoredProfile }));
        window.dispatchEvent(new CustomEvent('wrp:quests-updated'));
        window.dispatchEvent(new CustomEvent('wrp:inventory-updated'));
        window.dispatchEvent(new CustomEvent('wrp:todos-updated'));
      }

      // 7. Check if local had progress not in remote; if so, push merged truth to database
      const localHadMoreProgress =
        localLevel > remoteLevel ||
        localXp > remoteXp ||
        Object.keys(resolvedStats).some((k) => (Number(localStats[k]) || 10) > (extractAttr(k, data.Attributes, remoteProfile?.visibleStats) ?? 10)) ||
        (currentLocalQuests.some((q) => q.completed) && !remoteQuests.some((q) => q.completed));

      if (localHadMoreProgress) {
        console.log('[SyncManager] Local had higher progress than remote; syncing merged state to database');
        this.forceSaveUserData().catch((e) => console.warn('[SyncManager] Merged state sync failed:', e));
      }

      console.log('Data restored and merged cleanly in localStorage');
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

        const vit = Number(parsedProfile.visibleStats?.VIT) || 10;
        const str = Number(parsedProfile.visibleStats?.STR) || 10;
        const int = Number(parsedProfile.visibleStats?.INT) || 10;
        const per = Number(parsedProfile.visibleStats?.PER) || 10;
        const lvl = Number(parsedProfile.level) || 1;

        const calculatedHp = Math.max(100, Math.floor(vit * 40 + str * 16 + lvl * 20));
        const calculatedMp = Math.max(50, Math.floor(int * 8 + per * 4 + lvl * 2));

        data.userProfile = parsedProfile;
        data.whiteroom_user_profile = JSON.stringify(parsedProfile);
        data.exp = xpVal;
        data.xp = xpVal;
        data.level = lvl;
        data.fatigue = Math.max(0, Math.min(100, Number(parsedProfile.fatigue ?? 0)));
        data.Attributes = parsedProfile.visibleStats || {};
        data.stats = parsedProfile.visibleStats || {};

        data.gameData = {
          level: lvl,
          exp: xpVal,
          xp: xpVal,
          hp: parsedProfile.hp?.current ?? calculatedHp,
          mp: parsedProfile.mp?.current ?? calculatedMp,
          stm: parsedProfile.stm?.current ?? 100,
          fatigue: data.fatigue,
          name: parsedProfile.displayName || parsedProfile.pseudo || this.userId,
          Attributes: parsedProfile.visibleStats || {},
        };
      }

      const questsStr = localStorage.getItem('whiteroom_quests');
      if (questsStr) {
        data.quests = JSON.parse(questsStr);
        data.whiteroom_quests = questsStr;
      }

      const attemptsStr = localStorage.getItem('whiteroom_quest_attempts');
      if (attemptsStr) {
        data.questAttempts = JSON.parse(attemptsStr);
        data.whiteroom_quest_attempts = attemptsStr;
      }

      const dailyReset = localStorage.getItem('whiteroom_daily_reset');
      if (dailyReset) {
        data.dailyReset = dailyReset;
        data.whiteroom_daily_reset = dailyReset;
      }

      const inventoryStr = localStorage.getItem('whiteroom_hunter_inventory');
      if (inventoryStr) {
        data.whiteroom_hunter_inventory = inventoryStr;
        data.hunterInventory = inventoryStr;
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

      // Collect all other whiteroom_* keys (e.g. inventory, calibration, achievements)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('whiteroom_') && !(key in data)) {
          const val = localStorage.getItem(key);
          if (val != null) {
            data[key] = val;
          }
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

    // Prevent saving immediately after loading (within cooldown period), but schedule it so user actions are not dropped
    const timeSinceLoad = Date.now() - this.lastLoadTime;
    if (timeSinceLoad < this.SAVE_COOLDOWN_MS) {
      const remainingMs = this.SAVE_COOLDOWN_MS - timeSinceLoad + 50;
      console.log(`Coalescing save - scheduling in ${remainingMs}ms (loaded ${timeSinceLoad}ms ago)`);
      if (this.pendingSaveTimeout) {
        clearTimeout(this.pendingSaveTimeout);
      }
      this.pendingSaveTimeout = setTimeout(() => {
        this.pendingSaveTimeout = null;
        this.saveUserData().catch((err) => {
          console.error('Delayed background sync failed:', err);
        });
      }, remainingMs);
      return { success: true };
    }

    if (this.pendingSaveTimeout) {
      clearTimeout(this.pendingSaveTimeout);
      this.pendingSaveTimeout = null;
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
    if (this.pendingSaveTimeout) {
      clearTimeout(this.pendingSaveTimeout);
      this.pendingSaveTimeout = null;
    }

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
   * Immediately flush data on window unload/hide using sendBeacon or keepalive fetch
   */
  flushOnUnload(): void {
    if (!this.userId) return;
    try {
      if (this.pendingSaveTimeout) {
        clearTimeout(this.pendingSaveTimeout);
        this.pendingSaveTimeout = null;
      }
      const localStorageData = this.collectLocalStorageData();
      if (!localStorageData || Object.keys(localStorageData).length === 0) return;
      const payload = JSON.stringify({
        userId: this.userId,
        localStorageData,
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/sync', blob);
      } else {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Flush on unload failed:', e);
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

/**
 * Immediately flush any pending sync to MongoDB
 */
export async function flushPendingSyncImmediately(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (generationSyncTimer) {
    clearTimeout(generationSyncTimer);
    generationSyncTimer = null;
  }
  await syncManager.forceSaveUserData().catch((e) => console.warn('[Sync] Flush sync failed:', e));
}


