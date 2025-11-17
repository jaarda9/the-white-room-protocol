import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY;
    const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY or CHATGPT_API_KEY env var' });
    }

    const { payload } = req.body || {};
    
    // Support both Gemini-style payload and direct OpenAI format
    let messages: Array<{ role: string; content: string }> = [];
    let model = 'gpt-4o-mini';
    let temperature = 0.7;
    let maxTokens = 2048;
    let responseFormat: { type: string } | undefined;

    if (payload) {
      // If it's Gemini-style format (contents array)
      if (payload.contents && Array.isArray(payload.contents)) {
        // Extract text from Gemini format
        const textParts = payload.contents
          .flatMap((content: any) => content.parts || [])
          .map((part: any) => part.text)
          .filter(Boolean);
        
        if (textParts.length > 0) {
          messages = [
            { role: 'system', content: 'You are a helpful AI assistant.' },
            { role: 'user', content: textParts.join('\n') }
          ];
        }

        // Extract generation config if present
        if (payload.generationConfig) {
          if (payload.generationConfig.temperature !== undefined) {
            temperature = payload.generationConfig.temperature;
          }
          if (payload.generationConfig.maxOutputTokens !== undefined) {
            maxTokens = payload.generationConfig.maxOutputTokens;
          }
          if (payload.generationConfig.responseMimeType === 'application/json') {
            responseFormat = { type: 'json_object' };
          }
        }
      } 
      // If it's direct OpenAI format
      else if (payload.messages) {
        messages = payload.messages;
        model = payload.model || model;
        temperature = payload.temperature ?? temperature;
        maxTokens = payload.max_tokens ?? maxTokens;
        if (payload.response_format) {
          responseFormat = payload.response_format;
        }
      }
      // If it's just a string prompt
      else if (typeof payload === 'string') {
        messages = [
          { role: 'system', content: 'You are a helpful AI assistant.' },
          { role: 'user', content: payload }
        ];
      }
    }

    if (messages.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid payload. Expected payload.contents (Gemini format) or payload.messages (OpenAI format)' });
    }

    // Enforce a 25s upstream timeout to avoid 504s from Vercel (free tier has 10s limit, pro has 60s)
    // Using 25s to be safe and allow time for response processing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (responseFormat) {
      requestBody.response_format = responseFormat;
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return res.status(response.status).json({ 
        error: 'OpenAI API request failed', 
        details: errorData 
      });
    }

    const data = await response.json();

    // Convert OpenAI response to Gemini-compatible format for backward compatibility
    const content = data.choices?.[0]?.message?.content || '';
    
    // If response format is JSON, parse it
    let parsedContent = content;
    if (responseFormat?.type === 'json_object') {
      try {
        parsedContent = JSON.parse(content);
      } catch {
        // If parsing fails, return as string
      }
    }

    // Return in Gemini-compatible format
    const geminiCompatibleResponse = {
      candidates: [{
        content: {
          parts: [{
            text: typeof parsedContent === 'string' ? parsedContent : JSON.stringify(parsedContent)
          }]
        }
      }]
    };

    return res.status(200).json(geminiCompatibleResponse);

  } catch (err) {
    console.error('ChatGPT proxy error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    if (errorMessage.includes('aborted')) {
      return res.status(504).json({ error: 'Request timeout' });
    }
    
    return res.status(500).json({ error: errorMessage });
  }
}

