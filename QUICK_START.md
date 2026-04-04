# Quick start — LLM gateway (`/api/ai`)

## ✅ Setup Complete!

All files have been created and configured. Here's what's ready:

### Files Created:
- ✅ `/api/ai.ts` - API proxy (serverless); `/api/chatgpt` is rewritten to `/api/ai` in `vercel.json`
- ✅ `/src/lib/ai-gateway-client.ts` - Browser client (`aiGatewayClient.complete` / `completeJson`)
- ✅ `/src/components/ChatGPTExample.tsx` - Example component
- ✅ `.env.local` - Local environment file with your API key (already created)

### Environment Variables:
- ✅ **Local**: `.env.local` file created with your API key
- ✅ **Vercel**: You've already added `OPENAI_API_KEY` to Vercel environment variables

## 🚀 How to Use

### 1. Import the service in any component:

```typescript
import aiGatewayClient from '@/lib/ai-gateway-client';
```

### 2. Use it in your code:

```typescript
// Simple text prompt
const response = await aiGatewayClient.complete('Hello, how are you?');
console.log(response);

// Get JSON response
interface MyData {
  message: string;
  items: string[];
}

const data = await aiGatewayClient.completeJson<MyData>(
  'Return JSON with message and items array'
);
```

### 3. See the example component:

Check out `src/components/ChatGPTExample.tsx` for a complete working example.

## 🧪 Testing

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Import and use the service in any component to test it.

3. For Vercel deployment, the API endpoint will automatically work once you deploy.

## 📚 Documentation

- See `CHATGPT_INTEGRATION.md` for detailed usage examples
- See `SETUP_CHATGPT.md` for setup instructions

## 🔒 Security

- ✅ API key is stored in `.env.local` (not committed to git)
- ✅ API key is set in Vercel environment variables
- ✅ All API calls go through secure `/api/ai` proxy (legacy `/api/chatgpt`)
- ✅ Client-side code never sees the API key

## ✨ You're All Set!

The gateway is ready to use: import `aiGatewayClient` and call `complete` / `completeJson`.

