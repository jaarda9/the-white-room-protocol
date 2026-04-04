# LLM gateway integration (client + `/api/ai`)

The app talks to models through a **server proxy** so API keys stay on the server. The browser client is `aiGatewayClient` in `src/lib/ai-gateway-client.ts`. The canonical HTTP route is **`/api/ai`**. Requests to **`/api/chatgpt`** are **rewritten to `/api/ai`** in `vercel.json` so older clients keep working without a second serverless bundle.

Supported stacks include **Google Gemini** (`GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`) and **OpenAI-compatible** gateways (**OpenRouter**, Routeway, or a custom base URL) via `AI_PROVIDER` and the matching env vars. If no Gemini key is set but an OpenRouter (or other compat) key is present, the server uses that path.

## Setup

### 1. Choose a provider and keys

- **Gemini**: create a key in Google AI Studio / Cloud and set `GEMINI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY`). Optional: `GEMINI_MODEL`.
- **OpenRouter**: set `OPENROUTER_API_KEY` and optional `OPENROUTER_MODEL`. Use `AI_PROVIDER=openrouter` if you want to force this path when Gemini is also configured.
- **DeepSeek** (OpenAI-compatible): set `DEEPSEEK_API_KEY`. Optional: `DEEPSEEK_API_URL` (default `https://api.deepseek.com/v1/chat/completions`), `DEEPSEEK_MODEL` (default `deepseek-chat`). Used for the default compat path when inferred, and **required** (with Gemini) for lab `providerOverride: "lab"` (DeepSeek first, then Gemini).
- **Output token caps (OpenAI-compat)**: `OPENAI_COMPAT_MAX_TOKENS` caps `max_tokens` sent upstream (default **8192** if unset). Large lab JSON may need this; if you previously set `2600`, raise or remove it. **`LAB_COMPAT_MAX_TOKENS`** (default **12288**) applies only to the **lab** DeepSeek leg.
- **Lab timeouts (server)**: **`LAB_COMPAT_FETCH_TIMEOUT_MS`** (default **95000**) for the lab DeepSeek upstream fetch; **`LAB_GEMINI_FETCH_TIMEOUT_MS`** (default **95000**) for the lab Gemini leg (including Gemini-only lab when DeepSeek is unset). Align with Vercel `maxDuration` (e.g. 120s).

See `api/ai.ts` and `lib/llm-providers.ts` for routing.

### 2. Environment variables

#### Local development

Add variables to `.env.local` in the project root (never commit real keys).

#### Vercel

Add the same variables under **Settings → Environment Variables** for Production / Preview / Development, then redeploy.

## Usage

### Basic Usage

```typescript
import aiGatewayClient from '@/lib/ai-gateway-client';

// Simple text prompt
const response = await aiGatewayClient.complete('What is the meaning of life?');
console.log(response);

// With options
const story = await aiGatewayClient.complete('Generate a creative story', {
  temperature: 0.9,
  maxTokens: 1000,
  model: 'gpt-4o-mini'
});
console.log(story);
```

### JSON Response

```typescript
// Get structured JSON response
interface MyResponse {
  message: string;
  items: string[];
}

const data = await aiGatewayClient.completeJson<MyResponse>(
  'Return a JSON object with a message and items array',
  {
    temperature: 0.7,
    maxTokens: 500
  }
);

console.log(data.message);
console.log(data.items);
```

### Advanced Usage (Direct OpenAI Format)

```typescript
const response = await aiGatewayClient.complete({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing' }
  ],
  model: 'gpt-4o-mini',
  temperature: 0.7,
  max_tokens: 1000
});
```

## API endpoint

Requests are proxied through **`/api/ai`** (legacy: **`/api/chatgpt`**) so keys stay on the server.

### Request Format

The endpoint accepts both Gemini-compatible format (for backward compatibility) and direct OpenAI format:

**Gemini-compatible format:**
```json
{
  "payload": {
    "contents": [{
      "parts": [{
        "text": "Your prompt here"
      }]
    }],
    "generationConfig": {
      "temperature": 0.7,
      "maxOutputTokens": 2048,
      "responseMimeType": "application/json"
    }
  }
}
```

**OpenAI format:**
```json
{
  "payload": {
    "messages": [
      { "role": "user", "content": "Your prompt here" }
    ],
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 2048
  }
}
```

## Backward compatibility

The gateway still accepts Gemini-style request bodies from the client. Deprecated names:

```typescript
// Gemini-shaped payloads from the client still work; the gateway normalizes responses.
const response = await aiGatewayClient.complete('Your prompt');
```

The response format is also compatible, returning:
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "Response text here"
      }]
    }
  }]
}
```

## Caching

The service includes automatic caching (1 hour) to reduce API calls and costs. Cache can be cleared:

```typescript
aiGatewayClient.clearCache();
```

## Error Handling

```typescript
try {
  const response = await aiGatewayClient.complete('Your prompt');
} catch (error) {
  if (error.message.includes('Rate Limited')) {
    // Handle rate limiting
  } else if (error.message.includes('Service Unavailable')) {
    // Handle service unavailable
  } else {
    // Handle other errors
  }
}
```

## Cost and models

Pricing and defaults depend on the **provider** and **model** you configure (Gemini vs OpenRouter vs other OpenAI-compatible APIs). Pass `model` in the OpenAI-style payload or set provider env vars such as `OPENROUTER_MODEL` / `GEMINI_MODEL`.

```typescript
await aiGatewayClient.complete('Prompt', { model: 'gpt-4o-mini' });
```

## Security Notes

- **Never commit your API key to version control**
- The API key is stored server-side only (in environment variables)
- All API calls go through the `/api/ai` proxy endpoint (legacy `/api/chatgpt` still works)
- Client-side code never has direct access to the API key

