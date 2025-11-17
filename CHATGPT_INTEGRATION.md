# ChatGPT Integration Guide

This project uses OpenAI's ChatGPT API instead of Google Gemini for AI-powered features.

## Setup

### 1. Get Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Create a new API key
4. Copy the key (it starts with `sk-`)

### 2. Set Environment Variable

#### For Local Development

Create a `.env.local` file in the project root:

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

#### For Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key
   - **Environment**: Production, Preview, Development (select all)
4. Redeploy your application

## Usage

### Basic Usage

```typescript
import chatGPTService from '@/lib/chatgpt-service';

// Simple text prompt
const response = await chatGPTService.callChatGPT('What is the meaning of life?');
console.log(response);

// With options
const response = await chatGPTService.callChatGPT('Generate a creative story', {
  temperature: 0.9,
  maxTokens: 1000,
  model: 'gpt-4o-mini'
});
```

### JSON Response

```typescript
// Get structured JSON response
interface MyResponse {
  message: string;
  items: string[];
}

const data = await chatGPTService.callChatGPTJSON<MyResponse>(
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
const response = await chatGPTService.callChatGPT({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing' }
  ],
  model: 'gpt-4o-mini',
  temperature: 0.7,
  max_tokens: 1000
});
```

## API Endpoint

The ChatGPT API is proxied through `/api/chatgpt` to keep your API key secure on the server.

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

## Migration from Gemini

If you're migrating from Gemini, the service maintains backward compatibility:

```typescript
// Old Gemini-style code still works
const response = await chatGPTService.callChatGPT('Your prompt');
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
chatGPTService.clearCache();
```

## Error Handling

```typescript
try {
  const response = await chatGPTService.callChatGPT('Your prompt');
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

## Cost Considerations

- **gpt-4o-mini**: Cheaper, faster, good for most tasks (default)
- **gpt-4o**: More capable, more expensive
- **gpt-4-turbo**: Best quality, most expensive

You can specify the model in options:
```typescript
await chatGPTService.callChatGPT('Prompt', { model: 'gpt-4o-mini' });
```

## Security Notes

- **Never commit your API key to version control**
- The API key is stored server-side only (in environment variables)
- All API calls go through the `/api/chatgpt` proxy endpoint
- Client-side code never has direct access to the API key

