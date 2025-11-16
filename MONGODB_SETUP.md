# MongoDB Integration Setup

This project has been integrated with MongoDB Atlas to store all data in the cloud instead of local storage.

## Vercel Environment Variables

To deploy this project on Vercel with MongoDB:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name**: `MONGODB_URI`
   - **Value**: `mongodb+srv://Vercel-Admin-atlas-amber-house:36UkjMa6SGPTMNoa@atlas-amber-house.hbybfiz.mongodb.net/?retryWrites=true&w=majority`
   - **Environment**: Production, Preview, Development (select all)

4. Redeploy your application after adding the environment variable

## Local Development

For local development with API routes:

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Run the Vercel development server:
   ```bash
   vercel dev
   ```
   This will start both the frontend and API routes locally.

3. Alternatively, you can create a `.env.local` file in the project root with:
   ```
   MONGODB_URI=mongodb+srv://Vercel-Admin-atlas-amber-house:36UkjMa6SGPTMNoa@atlas-amber-house.hbybfiz.mongodb.net/?retryWrites=true&w=majority
   ```

Note: The connection string is already set as a fallback in the code, so it will work without the environment variable when deployed to Vercel.

## API Routes

The following API endpoints are available:

- `GET /api/user-profile` - Fetch user profile
- `POST /api/user-profile` - Save user profile
- `GET /api/quests` - Fetch daily quests
- `POST /api/quests` - Save daily quests
- `GET /api/quest-attempts` - Fetch quest attempts
- `POST /api/quest-attempts` - Save quest attempt

## Database Collections

The following collections are created in MongoDB:

- `userProfiles` - Stores user profile data
- `quests` - Stores daily quest data with reset date
- `questAttempts` - Stores all quest completion attempts

## Notes

- All data is now stored in MongoDB Atlas instead of browser localStorage
- The connection string is configured to use the provided MongoDB Atlas cluster
- Data persists across devices and browser sessions
- The API routes are serverless functions deployed on Vercel

