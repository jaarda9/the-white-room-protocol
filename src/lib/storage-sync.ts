/**
 * Storage Sync Utilities
 * Provides async functions for syncing with MongoDB
 */
import { syncManager } from './sync-manager';
import { getUserProfile, createDefaultProfile, saveUserProfile } from './storage';

/**
 * Initialize sync and load data from MongoDB
 * Call this on app startup
 */
export async function initializeDataSync(): Promise<void> {
  try {
    // Get or create profile from localStorage
    const profile = getUserProfile();
    console.log('[Sync] Initializing sync for profile:', profile.id);
    
    // Set user ID and try to load from MongoDB
    const result = await syncManager.setUserId(profile.id);
    
    if (result.dataFound) {
      console.log('[Sync] Data loaded from MongoDB, profile restored');
      // Profile was restored from MongoDB, don't save again
      return;
    }
    
    // No data found in MongoDB - check if we should save local data
    console.log('[Sync] No data found in MongoDB for profile:', profile.id);
    
    // Only save to MongoDB if:
    // 1. Profile has meaningful progress (not a brand new profile)
    // 2. Profile was created more than 1 minute ago (prevents immediate saves on page refresh)
    const profileAge = Date.now() - new Date(profile.createdAt).getTime();
    const hasProgress = profile.level > 1 || profile.xp > 0 || 
                       Object.values(profile.visibleStats || {}).some((v: any) => v > 10) ||
                       profile.createdAt < new Date(Date.now() - 60000).toISOString(); // Created more than 1 min ago
    
    if (hasProgress) {
      console.log('[Sync] Profile has progress or is established, syncing to MongoDB');
      await syncManager.forceSaveUserData();
    } else {
      console.log('[Sync] Profile appears to be brand new (no progress, created < 1 min ago)');
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
 * Use this for explicit saves (e.g., on page unload).
 * Skips sync for brand-new profiles (no progress, created < 1 min ago) to avoid creating extra DB users.
 */
export async function forceSyncToDatabase(): Promise<void> {
  try {
    const profile = getUserProfile();
    const hasProgress = profile.level > 1 || profile.xp > 0 ||
      Object.values(profile.visibleStats || {}).some((v: unknown) => Number(v) > 10);
    const profileAgeMs = Date.now() - new Date(profile.createdAt).getTime();
    const isBrandNew = !hasProgress && profileAgeMs < 60000;
    if (isBrandNew) {
      console.log('[Sync] Skipping force-sync for brand-new profile (no progress, created < 1 min ago)');
      return;
    }
    await syncManager.forceSaveUserData();
    console.log('Data synced to database');
  } catch (error) {
    console.error('Error syncing to database:', error);
    // Fail silently - localStorage is the source of truth
  }
}

/**
 * Load data from MongoDB and restore to localStorage
 * Use this to refresh data from the cloud
 */
export async function loadFromDatabase(): Promise<void> {
  try {
    const profile = getUserProfile();
    await syncManager.setUserId(profile.id);
    const result = await syncManager.loadUserData();
    
    if (result.success && result.data) {
      console.log('Data loaded from database');
    }
  } catch (error) {
    console.error('Error loading from database:', error);
  }
}

