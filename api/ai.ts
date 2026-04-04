/**
 * Server LLM gateway: POST `{ payload, providerOverride? }`.
 * Canonical path: `/api/ai`. Legacy URL `/api/chatgpt` is rewritten here via `vercel.json`.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  runOpenAICompatCompletion,
  executeGeminiGenerate,
  parsePositiveIntEnv,
  type CompatProviderId,
} from '../server/llm-providers';

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
