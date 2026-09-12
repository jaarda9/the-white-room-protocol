/**
 * Storage Sync Utilities
 * Provides async functions for syncing with MongoDB
 * 
 * Sync Flow:
 * 1. initializeDataSync() - Called on app startup, loads from DB or saves new profile
 * 2. forceSyncToDatabase() - Explicit save on page unload/close
 * 3. loadFromDatabase() - Manual refresh from cloud
 */
import { syncManager } from './sync-manager';
import type { UserProfile } from './types';
import { SESSION_SUBJECT_KEY } from './subject-auth';

function getProfileIfSession(): UserProfile | null {
  const sessionId = localStorage.getItem(SESSION_SUBJECT_KEY);
  if (!sessionId) return null;
  const stored = localStorage.getItem('whiteroom_user_profile');
  if (!stored) return null;
  try {
    const profile = JSON.parse(stored) as UserProfile;
    // Normalize IDs for comparison or adopt sessionId
    const normSession = sessionId.replace(/^SUBJECT-/, '').trim().toUpperCase();
    const normProfileId = (profile?.id || '').replace(/^SUBJECT-/, '').trim().toUpperCase();
    if (normProfileId && normSession && normProfileId !== normSession) {
      return null;
    }
    return profile;
  } catch {
    return null;
  }
}

/**
 * Initialize sync and load data from MongoDB
 * Call this on app startup after user authentication
 * 
 * Strategy:
 * - Load existing user data from MongoDB if available
 * - If no data in DB, save local profile if it has been established (>1 min old)
 * - Brand new profiles (<1 min) are NOT auto-saved to avoid duplicate DB entries
 */
export async function initializeDataSync(): Promise<void> {
  try {
    const sessionId = localStorage.getItem(SESSION_SUBJECT_KEY);
    if (!sessionId) {
      console.log('[Sync] No active subject session, skipping Mongo init');
      return;
    }

    console.log('[Sync] Initializing sync for profile ID:', sessionId);

    // Set user ID and try to load from MongoDB (shared with any other caller
    // racing to read localStorage-derived state, e.g. the daily quest reset check)
    const result = await syncManager.ensureInitialLoad();

    if (result.dataFound) {
      console.log('[Sync] Data loaded from MongoDB, profile restored');
      return;
    }
    
    // No data found in MongoDB - check if we should save local data
    const profile = getProfileIfSession();
    if (!profile) {
      console.log('[Sync] No local profile to sync for:', sessionId);
      return;
    }
    
    // Only save to MongoDB if profile is established (not brand new)
    // This prevents creating duplicate DB entries on initial page loads
    const profileAgeMs = Date.now() - new Date(profile.createdAt).getTime();
    const isEstablished = profileAgeMs >= 60000; // At least 1 minute old
    const hasProgress = profile.level > 1 || profile.xp > 0 || 
                       Object.values(profile.visibleStats || {}).some((v: any) => Number(v) > 10);
    
    const shouldSync = isEstablished || hasProgress;
    
    if (shouldSync) {
      console.log('[Sync] Profile is established or has progress, syncing to MongoDB');
      await syncManager.forceSaveUserData();
    } else {
      console.log('[Sync] Profile is brand new (age:', profileAgeMs, 'ms, no progress)');
      console.log('[Sync] Skipping auto-save to prevent duplicate profiles in database');
      console.log('[Sync] Profile will be saved when user makes progress or on explicit save');
    }
  } catch (error) {
    console.error('[Sync] Error initializing data sync:', error);
    // Continue with local storage only
  }
}

/**
 * Force sync current localStorage data to MongoDB
 * 
 * Use cases:
 * - Page unload (beforeunload event)
 * - Component unmount (cleanup)
 * - User-triggered save actions
 * 
 * Behavior:
 * - Explicitly saves all current localStorage to MongoDB
 * - Bypasses brand-new profile checks (user initiated)
 * - Uses forceSaveUserData for immediate persistence
 */
export async function forceSyncToDatabase(): Promise<void> {
  try {
    if (!localStorage.getItem(SESSION_SUBJECT_KEY)) {
      return;
    }
    const profile = getProfileIfSession();
    if (!profile) {
      return;
    }
    
    // For explicit saves, always sync regardless of profile age or progress
    // User-triggered saves should not be blocked by heuristics
    await syncManager.forceSaveUserData();
    console.log('[Sync] Data force synced to database');
  } catch (error) {
    console.error('[Sync] Error syncing to database:', error);
    // Fail silently - localStorage is the source of truth
  }
}

/**
 * Load data from MongoDB and restore to localStorage
 * 
 * Use cases:
 * - Manual refresh from cloud (pull latest data)
 * - Recovery from sync conflicts
 * - Explicit sync actions
 */
export async function loadFromDatabase(): Promise<void> {
  try {
    const profile = getProfileIfSession();
    if (!profile) return;
    await syncManager.setUserId(profile.id);
    const result = await syncManager.loadUserData();
    
    if (result.success && result.data) {
      console.log('[Sync] Data loaded from database successfully');
    }
  } catch (error) {
    console.error('[Sync] Error loading from database:', error);
  }
}
