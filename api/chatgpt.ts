import type { VercelRequest, VercelResponse } from '@vercel/node';

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  error?: any;
};

function geminiContentsToOpenAIMessages(contents: any[]): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  // Minimal conversion: map Gemini "user"/"model" to OpenAI roles.
  // Our client mostly sends a single user prompt in `contents`.
  if (!Array.isArray(contents)) return [];
  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  for (const c of contents) {
    const roleRaw = c?.role;
    const role: 'user' | 'assistant' =
      roleRaw === 'model' || roleRaw === 'assistant' ? 'assistant' : 'user';
    const text = c?.parts?.map((p: any) => p?.text).filter(Boolean).join('') ?? '';
    if (text) messages.push({ role, content: String(text) });
  }
  return messages;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    /**
     * Provider selection
     *
     * - Default: Google Gemini via Generative Language API (existing behavior)
     * - Optional: OpenAI-compatible gateway (OpenAI-style /chat/completions)
     *   Supported provider values:
     *     - AI_PROVIDER=openrouter  (uses OPENROUTER_* env vars)
     *     - AI_PROVIDER=routewai    (uses ROUTEWAI_* env vars)
     *     - AI_PROVIDER=openai_compat (uses OPENAI_COMPAT_* env vars)
     */
    const AI_PROVIDER_RAW = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

    const { payload } = req.body || {};
    
    // ---------- OpenAI-compatible provider path ----------
    const openAICompatProviders = new Set(['openrouter', 'routewai', 'openai_compat']);

    // If Gemini keys are missing, auto-fallback to openai-compatible if configured.
    const geminiKeyPresent = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    const shouldTryOpenAICompat =
      openAICompatProviders.has(AI_PROVIDER_RAW) ||
      (!geminiKeyPresent && Boolean(process.env.OPENAI_COMPAT_API_KEY || process.env.OPENROUTER_API_KEY || process.env.ROUTEWAI_API_KEY));

    if (shouldTryOpenAICompat) {
      const provider = openAICompatProviders.has(AI_PROVIDER_RAW) ? AI_PROVIDER_RAW : 'openai_compat';

      const apiKey =
        provider === 'openrouter'
          ? process.env.OPENROUTER_API_KEY
          : provider === 'routewai'
            ? process.env.ROUTEWAI_API_KEY
            : process.env.OPENAI_COMPAT_API_KEY;

      const model =
        provider === 'openrouter'
          ? process.env.OPENROUTER_MODEL
          : provider === 'routewai'
            ? process.env.ROUTEWAI_MODEL
            : process.env.OPENAI_COMPAT_MODEL;

      const apiUrl =
        provider === 'openrouter'
          ? (process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions')
          : provider === 'routewai'
            ? (process.env.ROUTEWAI_API_URL || '')
            : (process.env.OPENAI_COMPAT_API_URL || '');

      const resolvedModel = model || 'glm-4.5-air:free';

      if (!apiKey) {
        return res.status(500).json({ error: `Missing API key env var for provider: ${provider}` });
      }
      if (!apiUrl) {
        return res.status(500).json({
          error: `Missing API URL env var for provider: ${provider}`,
          hint:
            provider === 'routewai'
              ? 'Set ROUTEWAI_API_URL to your RouteWAI OpenAI-compatible /chat/completions endpoint.'
              : 'Set OPENAI_COMPAT_API_URL (or provider-specific *_API_URL).',
        });
      }

      // Accept either OpenAI-style payload.messages or Gemini-style payload.contents.
      let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
      let temperature = 0.7;
      let max_tokens = 2048;

      if (payload?.messages && Array.isArray(payload.messages)) {
        messages = payload.messages.map((m: any) => ({
          role: (m.role === 'system' || m.role === 'assistant') ? m.role : 'user',
          content: String(m.content ?? ''),
        }));
        if (payload.temperature !== undefined) temperature = payload.temperature;
        if (payload.max_tokens !== undefined) max_tokens = payload.max_tokens;
      } else if (payload?.contents && Array.isArray(payload.contents)) {
        messages = geminiContentsToOpenAIMessages(payload.contents);
        if (payload.generationConfig?.temperature !== undefined) temperature = payload.generationConfig.temperature;
        if (payload.generationConfig?.maxOutputTokens !== undefined) max_tokens = payload.generationConfig.maxOutputTokens;
      } else if (typeof payload === 'string') {
        messages = [{ role: 'user', content: payload }];
      }

      if (!messages.length) {
        return res.status(400).json({ error: 'Missing or invalid payload. Expected payload.messages or payload.contents' });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const upstream = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages,
          temperature,
          max_tokens,
          // If our client asked for JSON, enforce JSON mode when supported.
          ...(payload?.response_format?.type === 'json_object'
            ? { response_format: { type: 'json_object' } }
            : payload?.generationConfig?.responseMimeType === 'application/json'
              ? { response_format: { type: 'json_object' } }
              : {}),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await upstream.json().catch(() => ({}))) as OpenAIChatCompletionResponse;

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: 'OpenAI-compatible API request failed',
          provider,
          details: data,
        });
      }

      const text = data?.choices?.[0]?.message?.content ?? '';

      // Normalize response to Gemini-like format expected by `src/lib/chatgpt-service.ts`.
      return res.status(200).json({
        candidates: [
          {
            content: { parts: [{ text }] },
            finishReason: data?.choices?.[0]?.finish_reason ?? 'STOP',
          },
        ],
      });
    }

    // ---------- Gemini provider path (existing behavior) ----------
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    // Using gemini-2.5-flash as the default model (latest and fastest)
    // Alternative models: gemini-2.5-flash-latest, gemini-1.5-pro, gemini-pro
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY env var' });
    }

    // Convert various input formats to Gemini format
    let geminiPayload: any = {
      contents: [],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192, // Increased default for larger JSON responses
      }
    };

    if (payload) {
      // If it's already Gemini-style format (contents array)
      if (payload.contents && Array.isArray(payload.contents)) {
        geminiPayload.contents = payload.contents;
        if (payload.generationConfig) {
          geminiPayload.generationConfig = {
            ...geminiPayload.generationConfig,
            ...payload.generationConfig
          };
          // If requesting JSON, reduce safety filters (Gemini blocks more than ChatGPT)
          if (payload.generationConfig.responseMimeType === 'application/json') {
            geminiPayload.safetySettings = [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
            ];
          }
        }
      } 
      // If it's OpenAI format (messages array), convert to Gemini format
      else if (payload.messages && Array.isArray(payload.messages)) {
        // Convert OpenAI messages to Gemini contents
        // OpenAI: [{ role: 'system', content: '...' }, { role: 'user', content: '...' }]
        // Gemini: [{ parts: [{ text: '...' }], role: 'user' or 'model' }]
        const systemMessages = payload.messages
          .filter((msg: any) => msg.role === 'system')
          .map((msg: any) => msg.content);
        
        const conversationParts = payload.messages
          .filter((msg: any) => msg.role !== 'system')
          .map((msg: any) => ({
            parts: [{ text: msg.content }],
            role: msg.role === 'assistant' ? 'model' : 'user'
          }));

        // Combine system message with first user message if present
        if (systemMessages.length > 0 && conversationParts.length > 0 && conversationParts[0].role === 'user') {
          conversationParts[0].parts[0].text = `${systemMessages.join('\n')}\n\n${conversationParts[0].parts[0].text}`;
        } else if (systemMessages.length > 0) {
          // Add system message as first user message
          conversationParts.unshift({
            parts: [{ text: systemMessages.join('\n') }],
            role: 'user'
          });
        }

        geminiPayload.contents = conversationParts;

        // Convert OpenAI parameters to Gemini
        if (payload.temperature !== undefined) {
          geminiPayload.generationConfig.temperature = payload.temperature;
        }
        if (payload.max_tokens !== undefined) {
          geminiPayload.generationConfig.maxOutputTokens = payload.max_tokens;
        }
        if (payload.response_format?.type === 'json_object') {
          geminiPayload.generationConfig.responseMimeType = 'application/json';
          // Reduce safety filters for JSON responses (Gemini blocks more content than ChatGPT)
          // This is a key difference - Gemini's safety filters are stricter
          geminiPayload.safetySettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
          ];
        }
      }
      // If it's just a string prompt
      else if (typeof payload === 'string') {
        geminiPayload.contents = [{
          parts: [{ text: payload }],
          role: 'user'
        }];
      }
    }

    if (!geminiPayload.contents || geminiPayload.contents.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid payload. Expected payload.contents (Gemini format) or payload.messages (OpenAI format)' });
    }

    // Enforce a 25s upstream timeout to avoid 504s from Vercel (free tier has 10s limit, pro has 60s)
    // Using 25s to be safe and allow time for response processing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Gemini API request failed', 
        details: data 
      });
    }

    // Gemini API returns: { candidates: [...], usageMetadata: {...}, modelVersion: '...', responseId: '...' }
    // We need to ensure the response structure matches what the client expects
    // Log for debugging if structure is unexpected
    if (data.candidates && data.candidates.length > 0 && !data.candidates[0]?.content?.parts?.[0]?.text) {
      console.warn('Gemini API response missing text in expected location:', {
        hasCandidates: !!data.candidates,
        candidateCount: data.candidates?.length,
        firstCandidate: data.candidates?.[0],
        finishReason: data.candidates?.[0]?.finishReason,
        safetyRatings: data.candidates?.[0]?.safetyRatings
      });
    }

    // Gemini API already returns the correct format with candidates array
    return res.status(200).json(data);

  } catch (err) {
    console.error('Gemini API proxy error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    if (errorMessage.includes('aborted')) {
      return res.status(504).json({ error: 'Request timeout' });
    }
    
    return res.status(500).json({ error: errorMessage });
  }
}

