# LLM gateway setup

## Your API Key

Your OpenAI API key has been provided. To set it up:

## Local Development Setup

1. Create a `.env.local` file in the project root directory
2. Add the following line:

```
OPENAI_API_KEY=your_openai_api_key_here
```

3. Save the file
4. Restart your development server if it's running

**Important**: The `.env.local` file is already in `.gitignore`, so your API key won't be committed to version control.

## Vercel Deployment Setup

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Click **Add New**
4. Enter:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: your actual OpenAI API key (never paste a real key into this or any other file in the repo)
   - **Environment**: Select all (Production, Preview, Development)
5. Click **Save**
6. Redeploy your application

## Testing the Integration

You can test the gateway by:

1. Import the service in any component:
   ```typescript
   import aiGatewayClient from '@/lib/ai-gateway-client';
   ```

2. Use it in your code:
   ```typescript
   const response = await aiGatewayClient.complete('Hello, how are you?');
   console.log(response);
   ```

3. See `src/components/ChatGPTExample.tsx` for a complete example component.

## Security Notes

- ⚠️ **Never commit your API key to version control**
- ✅ The `.env.local` file is already ignored by git
- ✅ API calls go through the secure `/api/ai` proxy (legacy `/api/chatgpt`)
- ✅ Your API key is only stored server-side

## Next Steps

- Read [CHATGPT_INTEGRATION.md](./CHATGPT_INTEGRATION.md) for detailed usage examples
- Check out the example component at `src/components/ChatGPTExample.tsx`
- Start using `aiGatewayClient` in your components.

