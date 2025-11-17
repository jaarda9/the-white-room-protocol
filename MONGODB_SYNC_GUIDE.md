# MongoDB Sync Implementation Guide

## Overview

This project now includes MongoDB Atlas synchronization based on the syslvlup-main pattern. Data is stored in both localStorage (primary) and MongoDB (backup/sync), allowing for cross-device synchronization.

## Architecture

### Blob Storage Pattern
- **Single Collection**: `userData` in MongoDB
- **Structure**: `{ userId, localStorage: {...}, lastUpdated }`
- **User ID**: Uses profile ID from localStorage (auto-generated UUID)

### Sync Manager
- **Location**: `src/lib/sync-manager.ts`
- **Pattern**: Singleton instance that handles all sync operations
- **Features**:
  - Cooldown mechanism (5 seconds after load)
  - Automatic initialization
  - Background sync (non-blocking)
  - Graceful fallback to localStorage

### Storage Layer
- **Primary**: localStorage (source of truth)
- **Sync**: MongoDB (background sync)
- **Functions**: All storage functions remain synchronous for backward compatibility
- **Auto-sync**: Triggers background sync after localStorage operations

## How It Works

### 1. Initialization
```typescript
// On app startup (App.tsx)
initializeDataSync()
  - Gets or creates user profile
  - Sets user ID in sync manager
  - Loads data from MongoDB if exists
  - Restores to localStorage
  - Saves local data if new user
```

### 2. Data Flow

**Save Operation:**
```
1. User action (e.g., complete quest)
2. localStorage.setItem() (immediate)
3. Background: syncManager.saveUserData() (async, non-blocking)
4. POST /api/sync with blob data
5. MongoDB stores entire localStorage state
```

**Load Operation:**
```
1. App startup
2. initializeDataSync()
3. GET /api/sync?userId=...
4. If found: restore to localStorage
5. If not found: use local data
```

### 3. Cooldown Mechanism
- Prevents saving within 5 seconds of loading
- Avoids race conditions
- Use `forceSaveUserData()` to bypass cooldown

## API Endpoints

### `/api/sync`

**GET** - Load user data
```
Query: ?userId=<user-id>
Response: { localStorageData: {...} }
Status: 200 (found) | 404 (not found) | 500 (error)
```

**POST** - Save user data
```
Body: { userId: string, localStorageData: {...} }
Response: { success: true, modifiedCount, upsertedId }
Status: 200 (success) | 400 (bad request) | 500 (error)
```

## Usage

### Automatic Sync
Sync happens automatically:
- On app startup (load from MongoDB)
- After localStorage operations (save to MongoDB)
- On page unload (force save)

### Manual Sync
```typescript
import { forceSyncToDatabase, loadFromDatabase } from './lib/storage-sync';

// Force save current state
await forceSyncToDatabase();

// Reload from MongoDB
await loadFromDatabase();
```

### Storage Functions
All existing storage functions work as before:
```typescript
import { getUserProfile, saveUserProfile, getDailyQuests } from './lib/storage';

// These still work synchronously
const profile = getUserProfile();
saveUserProfile(updatedProfile);
const quests = getDailyQuests();
```

## MongoDB Setup

### Environment Variables
Set in Vercel dashboard:
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/database?retryWrites=true&w=majority
```

### Database Structure
- **Database**: `white-room-protocol`
- **Collection**: `userData`
- **Documents**: 
  ```json
  {
    "_id": ObjectId,
    "userId": "uuid-string",
    "localStorage": {
      "userProfile": {...},
      "quests": [...],
      "questAttempts": [...],
      "dailyReset": "date-string"
    },
    "lastUpdated": ISODate
  }
  ```

## Features

### ✅ Cross-Device Sync
- Same user ID = same data across devices
- Automatic sync on startup
- Background sync after changes

### ✅ Offline Support
- localStorage works offline
- Sync happens when online
- No data loss if sync fails

### ✅ Performance
- Non-blocking sync operations
- Cooldown prevents excessive saves
- localStorage is always fast

### ✅ Error Handling
- Graceful fallback to localStorage
- Silent failures (doesn't break app)
- Console logging for debugging

## Development

### Local Development
```bash
# Install dependencies
npm install

# Run with Vercel CLI (for API routes)
npm install -g vercel
vercel dev

# Or run Vite only (API won't work)
npm run dev
```

### Testing Sync
1. Open browser console
2. Check for sync messages
3. Verify data in MongoDB Atlas
4. Test on multiple devices/browsers

## Troubleshooting

### Sync Not Working
- Check MongoDB connection string
- Verify API endpoint is accessible
- Check browser console for errors
- Ensure user ID exists in profile

### Data Not Syncing
- Check network tab for API calls
- Verify MongoDB collection exists
- Check user ID matches across devices
- Force sync manually: `forceSyncToDatabase()`

### Performance Issues
- Cooldown should prevent excessive saves
- Sync is non-blocking (won't slow UI)
- Check MongoDB connection pooling

## Future Enhancements

- [ ] Conflict resolution (last-write-wins)
- [ ] Partial sync (only changed data)
- [ ] Sync status indicator in UI
- [ ] Manual sync button
- [ ] Sync history/versioning
- [ ] Multi-user support with authentication

