# When User Profiles Are Created and Synced to MongoDB

## Where profiles are created (client)

- **`src/lib/storage.ts`**
  - **`getUserProfile()`**  
    Creates a new profile (new UUID) only when:
    1. **No profile in localStorage** – first visit, cleared storage, different browser/device/incognito, or different origin (e.g. `http` vs `https`, or different domain).
    2. **Stored profile JSON is invalid** – `JSON.parse` throws, so we create a new profile and overwrite localStorage.

- **`createDefaultProfile()`**  
  Used only by `getUserProfile()`. Each call generates a new `id` via `crypto.randomUUID()`.

## When a new profile was being written to MongoDB (and what we fixed)

MongoDB gets a new document only when the **`/api/sync`** POST runs with a **new `userId`** (upsert in `api/sync.ts`).

Previously, new users were created in the DB in these situations:

1. **Right after creating a new profile**  
   `saveUserProfile(newProfile)` was triggering sync whenever `syncManager.getUserId()` was set. Right after creating a profile we write it to localStorage, so `getUserId()` returns the new id and we synced that brand-new profile immediately → new DB user on every first visit / reload with empty storage / parse error.

2. **Race on first load**  
   If two code paths called `getUserProfile()` while localStorage was still empty (e.g. Dashboard + `initializeDataSync`), both could create different profiles and both could trigger sync → two DB users.

3. **Page unload**  
   `forceSyncToDatabase()` (e.g. on `beforeunload`) was saving whatever was in localStorage, including brand-new profiles with no progress → new DB user when closing a tab right after first load.

## Changes made

1. **`saveUserProfile()` (storage.ts)**  
   Sync to MongoDB only when:
   - The profile **has progress** (level > 1, xp > 0, or any stat > 10), or
   - The profile is **not “brand new”** (created more than 1 minute ago).  
   Brand-new profiles (no progress, created &lt; 1 min ago) no longer trigger background sync from `saveUserProfile()`.

2. **`getUserProfile()` (storage.ts)**  
   A **creation lock** (`profileCreationInProgress`) ensures only one profile is created per page load when localStorage is empty. A second caller that sees the lock re-reads localStorage once and uses the profile written by the first caller, avoiding two different UUIDs and two DB users.

3. **`forceSyncToDatabase()` (storage-sync.ts)**  
   Before calling `forceSaveUserData()`, we now skip sync for **brand-new profiles** (no progress and created &lt; 1 min ago). So closing the tab right after first visit no longer creates a DB user.

4. **`initializeDataSync()`**  
   Already only saved when the profile had progress or was older than 1 minute; no change.

## Summary

- **Profiles are created** only in `getUserProfile()` when localStorage is empty or the stored JSON is invalid.
- **Profiles are written to MongoDB** only when:
  - The profile has progress, or
  - The profile was created more than 1 minute ago,  
  and only through the existing sync paths (`saveUserProfile` background sync, `initializeDataSync`, or `forceSyncToDatabase`).

This prevents duplicate/ghost users from reloads, multiple tabs, or closing the tab right after first load, while still syncing real usage once there is progress or the profile is “established” by time.
