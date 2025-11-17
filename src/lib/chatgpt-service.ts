/**
 * ChatGPT Service - AI-Powered Assistant
 * Replaces Gemini integration with OpenAI ChatGPT
 */

interface ChatGPTResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

class ChatGPTService {
  private cache: Map<string, { data: any; timestamp: number }>;
  private apiUrl: string;

  constructor() {
    this.cache = new Map();
    this.apiUrl = '/api/chatgpt';
  }

  /**
   * Main method to call ChatGPT
   * Supports both Gemini-compatible format and direct OpenAI format
   */
  async callChatGPT(
    prompt: string | { messages?: Array<{ role: string; content: string }>; model?: string; temperature?: number; max_tokens?: number },
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'json' | 'text';
      model?: string;
    }
  ): Promise<string> {
    try {
      const cacheKey = JSON.stringify({ prompt, options });
      
      // Check cache first (1 hour cache)
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < 3600000) {
          return cached.data;
        }
      }

      let payload: any;

      // Handle different input formats
      if (typeof prompt === 'string') {
        // Gemini-compatible format
        payload = {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 2048,
            ...(options?.responseFormat === 'json' && { responseMimeType: 'application/json' })
          }
        };
      } else {
        // Direct OpenAI format
        payload = {
          messages: prompt.messages || [
            { role: 'system', content: 'You are a helpful AI assistant.' },
            { role: 'user', content: typeof prompt === 'string' ? prompt : '' }
          ],
          model: prompt.model || options?.model || 'gpt-4o-mini',
          temperature: prompt.temperature ?? options?.temperature ?? 0.7,
          max_tokens: prompt.max_tokens ?? options?.maxTokens ?? 2048,
          ...(options?.responseFormat === 'json' && { response_format: { type: 'json_object' } })
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ChatGPT API HTTP Error: ${response.status} ${response.statusText}`);
        console.error(`Error response:`, errorText);
        
        if (response.status === 503) {
          throw new Error('ChatGPT API Service Unavailable - please try again later');
        } else if (response.status === 429) {
          throw new Error('ChatGPT API Rate Limited - too many requests');
        } else if (response.status >= 500) {
          throw new Error(`ChatGPT API Server Error: ${response.status}`);
        } else {
          throw new Error(`ChatGPT API Error: ${response.status} ${response.statusText}`);
        }
      }

      const result: ChatGPTResponse = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        console.error('Invalid ChatGPT API response structure:', result);
        throw new Error('Invalid response structure from ChatGPT API');
      }

      // Cache the response
      this.cache.set(cacheKey, {
        data: text,
        timestamp: Date.now()
      });

      return text;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('ChatGPT API request timed out (30s)');
      } else if (error instanceof Error && error.message.includes('Service Unavailable')) {
        console.error('ChatGPT API Service Unavailable (503) - this is temporary');
      } else if (error instanceof Error && error.message.includes('Rate Limited')) {
        console.error('ChatGPT API Rate Limited (429) - too many requests');
      } else {
        console.error('Error calling ChatGPT:', error);
      }
      throw error;
    }
  }

  /**
   * Call ChatGPT and parse JSON response
   */
  async callChatGPTJSON<T = any>(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<T> {
    const response = await this.callChatGPT(prompt, {
      ...options,
      responseFormat: 'json'
    });

    try {
      // Try to parse as JSON
      const cleaned = response.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      return JSON.parse(cleaned) as T;
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      console.error('Response text:', response);
      throw new Error('Invalid JSON response from ChatGPT');
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('ChatGPT cache cleared');
  }

  /**
   * Get cache info for debugging
   */
  getCacheInfo(): { cacheSize: number } {
    return {
      cacheSize: this.cache.size
    };
  }
}

// Export singleton instance
export const chatGPTService = new ChatGPTService();
export default chatGPTService;

