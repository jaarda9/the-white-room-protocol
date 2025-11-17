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
    // Get or create user ID from profile
    let profile;
    try {
      profile = getUserProfile();
    } catch (error) {
      // Profile doesn't exist, create one
      profile = createDefaultProfile();
      saveUserProfile(profile);
    }

    // Set user ID and load data
    const result = await syncManager.setUserId(profile.id);
    
    if (result.dataFound) {
      console.log('Data loaded from MongoDB');
    } else {
      console.log('No existing data found, using local data');
      // Save local data to MongoDB
      await syncManager.forceSaveUserData();
    }
  } catch (error) {
    console.error('Error initializing data sync:', error);
    // Continue with local storage only
  }
}

/**
 * Force sync current localStorage data to MongoDB
 * Use this for explicit saves (e.g., on page unload)
 */
export async function forceSyncToDatabase(): Promise<void> {
  try {
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

