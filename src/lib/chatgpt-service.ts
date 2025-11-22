/**
 * Gemini Service - AI-Powered Assistant
 * Uses Google Gemini API for AI content generation
 */

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

class GeminiService {
  private cache: Map<string, { data: any; timestamp: number }>;
  private apiUrl: string;

  constructor() {
    this.cache = new Map();
    this.apiUrl = '/api/chatgpt'; // Keep endpoint name for backward compatibility
  }

  /**
   * Main method to call Gemini API
   * Supports both Gemini-native format and OpenAI-compatible format
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
            maxOutputTokens: options?.maxTokens ?? 8192, // Increased default for longer JSON responses
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
          max_tokens: prompt.max_tokens ?? options?.maxTokens ?? 8192, // Increased default for longer JSON responses
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
        console.error(`Gemini API HTTP Error: ${response.status} ${response.statusText}`);
        console.error(`Error response:`, errorText);
        
        if (response.status === 401) {
          const error = new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
          (error as any).isAuthError = true;
          (error as any).statusCode = 401;
          throw error;
        } else if (response.status === 429) {
          // Try to parse retry-after from response
          let retryAfter = 60; // Default to 60 seconds
          try {
            const errorData = JSON.parse(errorText);
            const errorMsg = errorData?.details?.error?.message || errorData?.error?.message || '';
            // Try to extract retry time from message (e.g., "Please try again in 20s")
            const retryMatch = errorMsg.match(/try again in (\d+)s?/i);
            if (retryMatch) {
              retryAfter = parseInt(retryMatch[1]) + 10; // Add buffer
            }
            // Check Retry-After header
            const retryAfterHeader = response.headers.get('Retry-After');
            if (retryAfterHeader) {
              retryAfter = parseInt(retryAfterHeader) + 10;
            }
          } catch {
            // Use default if parsing fails
          }
          const error = new Error(`Gemini API Rate Limited - too many requests. Please wait ${retryAfter} seconds.`);
          (error as any).isRateLimitError = true;
          (error as any).statusCode = 429;
          (error as any).retryAfter = retryAfter;
          throw error;
        } else if (response.status === 503) {
          throw new Error('Gemini API Service Unavailable - please try again later');
        } else if (response.status >= 500) {
          throw new Error(`Gemini API Server Error: ${response.status}`);
        } else {
          throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
        }
      }

      const result: GeminiResponse = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        console.error('Invalid Gemini API response structure:', result);
        throw new Error('Invalid response structure from Gemini API');
      }

      // Cache the response
      this.cache.set(cacheKey, {
        data: text,
        timestamp: Date.now()
      });

      return text;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Gemini API request timed out (30s)');
      } else if (error instanceof Error && error.message.includes('Service Unavailable')) {
        console.error('Gemini API Service Unavailable (503) - this is temporary');
      } else if (error instanceof Error && error.message.includes('Rate Limited')) {
        console.error('Gemini API Rate Limited (429) - too many requests');
      } else {
        console.error('Error calling Gemini API:', error);
      }
      throw error;
    }
  }

  /**
   * Call Gemini API and parse JSON response
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
      let cleaned = response.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      
      // Check if JSON appears truncated (doesn't end properly)
      if (!cleaned.endsWith('}') && !cleaned.endsWith(']')) {
        // Response might be truncated - try to recover by finding last complete structure
        console.warn('JSON response appears truncated, attempting recovery...');
        
        // First, try to fix unterminated strings
        // Find the last complete string (ends with ") that's not escaped
        const stringPattern = /"([^"\\]|\\.)*"/g;
        let lastMatch;
        let match;
        while ((match = stringPattern.exec(cleaned)) !== null) {
          lastMatch = match;
        }
        
        // If we found a string match and there's content after it that looks incomplete
        if (lastMatch) {
          const afterLastString = cleaned.substring(lastMatch.index + lastMatch[0].length);
          // If there's incomplete text after the last string (likely another string that was cut)
          if (afterLastString.trim() && !afterLastString.trim().startsWith(',') && !afterLastString.trim().startsWith('}') && !afterLastString.trim().startsWith(']')) {
            // Cut at the end of the last complete string
            cleaned = cleaned.substring(0, lastMatch.index + lastMatch[0].length);
          }
        }
        
        // Find the last complete object/array
        let braceDepth = 0;
        let bracketDepth = 0;
        let inString = false;
        let escapeNext = false;
        let lastValidPos = -1;
        
        for (let i = 0; i < cleaned.length; i++) {
          const char = cleaned[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (inString) continue;
          
          if (char === '{') {
            braceDepth++;
          } else if (char === '}') {
            braceDepth--;
            if (braceDepth === 0 && bracketDepth === 0) {
              lastValidPos = i;
            }
          } else if (char === '[') {
            bracketDepth++;
          } else if (char === ']') {
            bracketDepth--;
            if (braceDepth === 0 && bracketDepth === 0) {
              lastValidPos = i;
            }
          } else if ((char === ',' || char === '\n' || char === ' ') && braceDepth === 0 && bracketDepth === 0) {
            lastValidPos = i;
          }
        }
        
        // If we found a valid position, cut there
        if (lastValidPos > cleaned.length * 0.5) {
          cleaned = cleaned.substring(0, lastValidPos + 1);
        } else {
          // Fallback: find last complete brace/bracket
          const lastBrace = cleaned.lastIndexOf('}');
          const lastBracket = cleaned.lastIndexOf(']');
          const cutPoint = Math.max(lastBrace, lastBracket);
          if (cutPoint > cleaned.length * 0.5) {
            cleaned = cleaned.substring(0, cutPoint + 1);
          }
        }
        
        // Try to close the root object/array if needed
        if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
          // Count open/close braces
          const openBraces = (cleaned.match(/\{/g) || []).length;
          const closeBraces = (cleaned.match(/\}/g) || []).length;
          if (openBraces > closeBraces) {
            // Remove any trailing incomplete content before closing
            cleaned = cleaned.replace(/,\s*$/, '').replace(/:\s*$/, '').replace(/:\s*"[^"]*$/, '": ""');
            cleaned += '}'.repeat(openBraces - closeBraces);
          }
        } else if (cleaned.startsWith('[') && !cleaned.endsWith(']')) {
          const openBrackets = (cleaned.match(/\[/g) || []).length;
          const closeBrackets = (cleaned.match(/\]/g) || []).length;
          if (openBrackets > closeBrackets) {
            cleaned = cleaned.replace(/,\s*$/, '');
            cleaned += ']'.repeat(openBrackets - closeBrackets);
          }
        }
      }
      
      return JSON.parse(cleaned) as T;
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      console.error('Response text:', response.substring(0, 1000)); // Log first 1000 chars for better debugging
      throw new Error('Invalid JSON response from Gemini API');
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Gemini cache cleared');
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
// Keeping the name 'chatGPTService' for backward compatibility with existing code
export const chatGPTService = new GeminiService();
export default chatGPTService;

