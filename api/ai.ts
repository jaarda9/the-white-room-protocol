/**
 * Server LLM gateway: POST `{ payload, providerOverride? }`.
 * Canonical path: `/api/ai`. Legacy URL `/api/chatgpt` is rewritten here via `vercel.json`.
 *
 * OpenAI-compat + Gemini helpers are inlined in this file so the serverless bundle does not
 * depend on resolving `../lib/*` (avoids cold-start MODULE_NOT_FOUND on Vercel).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- LLM providers (inlined) ---

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: { role?: string; content?: any };
    finish_reason?: string;
    text?: string;
  }>;
  error?: any;
};

function extractTextFromOpenAIChoice(choice: any): string {
  if (!choice) return '';

  const messageContent = choice?.message?.content;
  if (typeof messageContent === 'string') {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .filter(Boolean)
      .join('');
  }

  if (messageContent && typeof messageContent === 'object') {
    if (typeof messageContent.text === 'string') return messageContent.text;
    if (typeof messageContent.content === 'string') return messageContent.content;
  }

  if (typeof choice?.text === 'string') {
    return choice.text;
  }

  return '';
}

function parsePositiveIntEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function geminiContentsToOpenAIMessages(contents: any[]): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  if (!Array.isArray(contents)) return [];
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const c of contents) {
    const roleRaw = c?.role;
    const role: 'user' | 'assistant' =
      roleRaw === 'model' || roleRaw === 'assistant' ? 'assistant' : 'user';
    const text = c?.parts?.map((p: any) => p?.text).filter(Boolean).join('') ?? '';
    if (text) messages.push({ role, content: String(text) });
  }
  return messages;
}

type CompatProviderId = 'openrouter' | 'routewai' | 'openai_compat' | 'deepseek';

function getOpenAICompatConfig(provider: CompatProviderId): {
  apiKey: string | undefined;
  apiUrl: string;
  resolvedModel: string;
} | null {
  switch (provider) {
    case 'openrouter':
      return {
        apiKey: process.env.OPENROUTER_API_KEY,
        apiUrl: process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions',
        resolvedModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
      };
    case 'routewai':
      return {
        apiKey: process.env.ROUTEWAI_API_KEY,
        apiUrl: process.env.ROUTEWAI_API_URL || '',
        resolvedModel: process.env.ROUTEWAI_MODEL || 'glm-4.5-air:free',
      };
    case 'openai_compat':
      return {
        apiKey: process.env.OPENAI_COMPAT_API_KEY,
        apiUrl: process.env.OPENAI_COMPAT_API_URL || '',
        resolvedModel: process.env.OPENAI_COMPAT_MODEL || 'glm-4.5-air:free',
      };
    case 'deepseek':
      return {
        apiKey: process.env.DEEPSEEK_API_KEY,
        apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
        resolvedModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      };
    default:
      return null;
  }
}

type CompatRunResult =
  | {
      ok: true;
      text: string;
      finishReason: string;
      provider: string;
      model: string;
    }
  | { ok: false; status: number; body: Record<string, unknown> };

async function runOpenAICompatCompletion(
  provider: CompatProviderId,
  payload: any,
  compatOptions?: { maxTokensCap?: number; fetchTimeoutMs?: number }
): Promise<CompatRunResult> {
  const cfg = getOpenAICompatConfig(provider);
  if (!cfg) {
    return { ok: false, status: 500, body: { error: `Unknown compat provider: ${provider}` } };
  }

  const { apiKey, apiUrl, resolvedModel } = cfg;

  if (!apiKey) {
    return { ok: false, status: 500, body: { error: `Missing API key env var for provider: ${provider}` } };
  }
  if (!apiUrl) {
    return {
      ok: false,
      status: 500,
      body: {
        error: `Missing API URL env var for provider: ${provider}`,
        hint:
          provider === 'routewai'
            ? 'Set ROUTEWAI_API_URL to your RouteWAI OpenAI-compatible /chat/completions endpoint.'
            : 'Set OPENAI_COMPAT_API_URL (or provider-specific *_API_URL).',
      },
    };
  }

  let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  let temperature = 0.7;
  let max_tokens = 2048;
  /** Default 8192: large lab JSON (e.g. mental 4 modules) needs headroom. Lower via OPENAI_COMPAT_MAX_TOKENS if upstream times out. */
  const maxTokensCap =
    compatOptions?.maxTokensCap ?? parsePositiveIntEnv(process.env.OPENAI_COMPAT_MAX_TOKENS, 8192);
  const compatFetchTimeoutMs =
    compatOptions?.fetchTimeoutMs ?? parsePositiveIntEnv(process.env.OPENAI_COMPAT_FETCH_TIMEOUT_MS, 42_000);

  if (payload?.messages && Array.isArray(payload.messages)) {
    messages = payload.messages.map((m: any) => ({
      role: m.role === 'system' || m.role === 'assistant' ? m.role : 'user',
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
    return { ok: false, status: 400, body: { error: 'Missing or invalid payload. Expected payload.messages or payload.contents' } };
  }

  if (Number.isFinite(maxTokensCap) && maxTokensCap > 0) {
    max_tokens = Math.min(max_tokens, Math.floor(maxTokensCap));
  }

  const wantsJsonMode =
    payload?.response_format?.type === 'json_object' ||
    payload?.generationConfig?.responseMimeType === 'application/json';

  const buildBody = (
    tokenBudget: number,
    withJsonMode: boolean,
    overrideMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ) => ({
    model: resolvedModel,
    messages: overrideMessages || messages,
    temperature,
    max_tokens: tokenBudget,
    ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
  });

  const requestOnce = async (
    tokenBudget: number,
    timeoutMs: number,
    withJsonMode: boolean,
    overrideMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildBody(tokenBudget, withJsonMode, overrideMessages)),
        signal: controller.signal,
      });
      const data = (await upstream.json().catch(() => ({}))) as OpenAIChatCompletionResponse;
      return { upstream, data };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let upstream: Response;
  let data: OpenAIChatCompletionResponse;
  try {
    ({ upstream, data } = await requestOnce(max_tokens, compatFetchTimeoutMs, wantsJsonMode));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (!isAbort && !msg.toLowerCase().includes('aborted')) throw err;
    const retryTokens = Math.max(300, Math.floor(max_tokens * 0.6));
    ({ upstream, data } = await requestOnce(retryTokens, compatFetchTimeoutMs, wantsJsonMode));
  }

  if (!upstream.ok && upstream.status === 400 && wantsJsonMode) {
    const raw = JSON.stringify(data || {}).toLowerCase();
    if (raw.includes('json mode is not enabled') || raw.includes('invalid_argument')) {
      ({ upstream, data } = await requestOnce(Math.max(300, Math.floor(max_tokens * 0.8)), compatFetchTimeoutMs, false));
    }
  }

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      body: { error: 'OpenAI-compatible API request failed', provider, details: data },
    };
  }

  let choice = data?.choices?.[0];
  let text = extractTextFromOpenAIChoice(choice);
  let rawFinishReason = choice?.finish_reason ?? 'STOP';

  if (!String(text || '').trim() && String(rawFinishReason).toLowerCase() === 'stop') {
    ({ upstream, data } = await requestOnce(Math.max(300, Math.floor(max_tokens * 0.85)), compatFetchTimeoutMs, false));
    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status,
        body: { error: 'OpenAI-compatible API request failed', provider, details: data },
      };
    }
    choice = data?.choices?.[0];
    text = extractTextFromOpenAIChoice(choice);
    rawFinishReason = choice?.finish_reason ?? rawFinishReason;
  }

  if (!String(text || '').trim()) {
    const finalOnlyMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      {
        role: 'system',
        content:
          'Return only the final answer content. Do not include reasoning, analysis, or hidden thoughts. ' +
          'If JSON is requested, return strict JSON only.',
      },
      ...messages,
    ];
    ({ upstream, data } = await requestOnce(Math.max(300, Math.floor(max_tokens * 0.9)), compatFetchTimeoutMs, wantsJsonMode, finalOnlyMessages));
    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status,
        body: { error: 'OpenAI-compatible API request failed', provider, details: data },
      };
    }
    choice = data?.choices?.[0];
    text = extractTextFromOpenAIChoice(choice);
    rawFinishReason = choice?.finish_reason ?? rawFinishReason;
  }

  if (!String(text || '').trim()) {
    return {
      ok: false,
      status: 502,
      body: { error: 'OpenAI-compatible API returned no final text content after retries', provider, details: data },
    };
  }

  const normalizedFinishReason =
    rawFinishReason === 'length' || rawFinishReason === 'max_tokens' ? 'MAX_TOKENS' : rawFinishReason;

  return {
    ok: true,
    text,
    finishReason: normalizedFinishReason,
    provider,
    model: resolvedModel,
  };
}

type GeminiRunResult =
  | { ok: true; data: any; model: string }
  | { ok: false; status: number; body: Record<string, unknown> };

async function executeGeminiGenerate(
  payload: any,
  geminiOptions?: { timeoutMs?: number }
): Promise<GeminiRunResult> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  if (!GEMINI_API_KEY) {
    return {
      ok: false,
      status: 500,
      body: { error: 'Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY env var' },
    };
  }

  let geminiPayload: any = {
    contents: [],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  };

  if (payload) {
    if (payload.contents && Array.isArray(payload.contents)) {
      geminiPayload.contents = payload.contents;
      if (payload.generationConfig) {
        geminiPayload.generationConfig = {
          ...geminiPayload.generationConfig,
          ...payload.generationConfig,
        };
        if (payload.generationConfig.responseMimeType === 'application/json') {
          geminiPayload.safetySettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ];
        }
      }
    } else if (payload.messages && Array.isArray(payload.messages)) {
      const systemMessages = payload.messages
        .filter((msg: any) => msg.role === 'system')
        .map((msg: any) => msg.content);

      const conversationParts = payload.messages
        .filter((msg: any) => msg.role !== 'system')
        .map((msg: any) => ({
          parts: [{ text: msg.content }],
          role: msg.role === 'assistant' ? 'model' : 'user',
        }));

      if (systemMessages.length > 0 && conversationParts.length > 0 && conversationParts[0].role === 'user') {
        conversationParts[0].parts[0].text = `${systemMessages.join('\n')}\n\n${conversationParts[0].parts[0].text}`;
      } else if (systemMessages.length > 0) {
        conversationParts.unshift({
          parts: [{ text: systemMessages.join('\n') }],
          role: 'user',
        });
      }

      geminiPayload.contents = conversationParts;

      if (payload.temperature !== undefined) {
        geminiPayload.generationConfig.temperature = payload.temperature;
      }
      if (payload.max_tokens !== undefined) {
        geminiPayload.generationConfig.maxOutputTokens = payload.max_tokens;
      }
      if (payload.response_format?.type === 'json_object') {
        geminiPayload.generationConfig.responseMimeType = 'application/json';
        geminiPayload.safetySettings = [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ];
      }
    } else if (typeof payload === 'string') {
      geminiPayload.contents = [
        {
          parts: [{ text: payload }],
          role: 'user',
        },
      ];
    }
  }

  if (!geminiPayload.contents || geminiPayload.contents.length === 0) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Missing or invalid payload. Expected payload.contents (Gemini format) or payload.messages (OpenAI format)',
      },
    };
  }

  const geminiTimeoutMs = geminiOptions?.timeoutMs ?? 25_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), geminiTimeoutMs);

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiPayload),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  const rawBody = await response.text();
  let data: any;
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        error: 'Upstream Gemini returned non-JSON response',
        status: response.status,
        snippet: rawBody.slice(0, 400),
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: { error: 'Upstream Gemini request failed', details: data },
    };
  }

  return { ok: true, data, model: GEMINI_MODEL };
}

// --- HTTP handler ---

/** Lets the browser read these via fetch (see ai-gateway-client lastGatewayInfo). */
const LLM_IDENTITY_HEADERS =
  'X-LLM-Provider, X-LLM-Model, X-LLM-Override, X-LLM-Fallback';

function setLlmResponseIdentity(
  res: VercelResponse,
  identity: { provider: string; model?: string; clientOverride?: string; fallback?: string }
) {
  res.setHeader('X-LLM-Provider', identity.provider);
  if (identity.model) res.setHeader('X-LLM-Model', identity.model);
  if (identity.clientOverride) res.setHeader('X-LLM-Override', identity.clientOverride);
  if (identity.fallback) res.setHeader('X-LLM-Fallback', identity.fallback);
}

function jsonCandidates(text: string, finishReason: string) {
  return {
    candidates: [
      {
        content: { parts: [{ text }] },
        finishReason,
      },
    ],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', LLM_IDENTITY_HEADERS);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const AI_PROVIDER_RAW = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

    const { payload, providerOverride } = req.body || {};
    const override = String(providerOverride || '').toLowerCase();
    const forceGemini = override === 'gemini';
    /** Mental / physical / social / knowledge labs: DeepSeek first, then Gemini. */
    const forceLabStack = override === 'lab';

    const geminiKeyPresent = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);

    const openAICompatProviders = new Set<string>([
      'openrouter',
      'routewai',
      'openai_compat',
      'deepseek',
    ]);

    if (forceGemini && !geminiKeyPresent) {
      return res.status(500).json({
        error:
          'This request asked for Gemini (providerOverride: "gemini") but GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is not set.',
      });
    }

    // ---------- Isolated Gemini (test page, etc.) ----------
    if (forceGemini) {
      const g = await executeGeminiGenerate(payload);
      if (!g.ok) return res.status(g.status).json(g.body);
      setLlmResponseIdentity(res, {
        provider: 'gemini',
        model: g.model,
        clientOverride: 'gemini',
      });
      return res.status(200).json(g.data);
    }

    // ---------- Lab stack: DeepSeek → Gemini ----------
    if (forceLabStack) {
      const hasDeepseek = Boolean(process.env.DEEPSEEK_API_KEY);
      if (!hasDeepseek && !geminiKeyPresent) {
        return res.status(500).json({
          error:
            'Lab routing (providerOverride: "lab") requires DEEPSEEK_API_KEY and/or Gemini (GEMINI_API_KEY) — neither is set.',
        });
      }

      if (hasDeepseek) {
        const labCap = parsePositiveIntEnv(process.env.LAB_COMPAT_MAX_TOKENS, 12_288);
        const labFetchMs = parsePositiveIntEnv(process.env.LAB_COMPAT_FETCH_TIMEOUT_MS, 95_000);
        const d = await runOpenAICompatCompletion('deepseek', payload, {
          maxTokensCap: labCap,
          fetchTimeoutMs: labFetchMs,
        });
        if (d.ok) {
          setLlmResponseIdentity(res, {
            provider: 'deepseek',
            model: d.model,
            clientOverride: 'lab',
          });
          return res.status(200).json(jsonCandidates(d.text, d.finishReason));
        }
        console.warn('[api/ai] lab stack: DeepSeek failed, falling back to Gemini if available', d.body);
      }

      if (geminiKeyPresent) {
        const labGeminiMs = parsePositiveIntEnv(process.env.LAB_GEMINI_FETCH_TIMEOUT_MS, 95_000);
        const g = await executeGeminiGenerate(payload, { timeoutMs: labGeminiMs });
        if (!g.ok) return res.status(g.status).json(g.body);
        setLlmResponseIdentity(res, {
          provider: 'gemini',
          model: g.model,
          clientOverride: 'lab',
          ...(hasDeepseek ? { fallback: 'gemini-after-deepseek' } : {}),
        });
        return res.status(200).json(g.data);
      }

      return res.status(502).json({
        error: 'Lab stack: DeepSeek failed and Gemini is not configured.',
      });
    }

    const shouldTryOpenAICompat =
      openAICompatProviders.has(AI_PROVIDER_RAW) ||
      (!geminiKeyPresent &&
        Boolean(
          process.env.OPENAI_COMPAT_API_KEY ||
            process.env.OPENROUTER_API_KEY ||
            process.env.ROUTEWAI_API_KEY ||
            process.env.DEEPSEEK_API_KEY
        ));

    // ---------- Default OpenAI-compat path ----------
    if (shouldTryOpenAICompat) {
      const provider = (openAICompatProviders.has(AI_PROVIDER_RAW)
        ? AI_PROVIDER_RAW
        : process.env.OPENROUTER_API_KEY
          ? 'openrouter'
          : process.env.DEEPSEEK_API_KEY
            ? 'deepseek'
            : process.env.ROUTEWAI_API_KEY
              ? 'routewai'
              : 'openai_compat') as CompatProviderId;

      const r = await runOpenAICompatCompletion(provider, payload);
      if (!r.ok) return res.status(r.status).json(r.body);

      setLlmResponseIdentity(res, { provider: r.provider, model: r.model });
      return res.status(200).json(jsonCandidates(r.text, r.finishReason));
    }

    // ---------- Default Gemini ----------
    const g = await executeGeminiGenerate(payload);
    if (!g.ok) return res.status(g.status).json(g.body);

    setLlmResponseIdentity(res, { provider: 'gemini', model: g.model });
    return res.status(200).json(g.data);
  } catch (err) {
    console.error('AI gateway error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    if (errorMessage.includes('aborted')) {
      return res.status(504).json({ error: 'Request timeout' });
    }

    return res.status(500).json({ error: errorMessage });
  }
}
