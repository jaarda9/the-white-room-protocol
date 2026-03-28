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
  private requestQueue: Promise<void>;
  private lastRequestAt: number;
  private readonly minRequestIntervalMs: number;
  private readonly max429Retries: number;

  constructor() {
    this.cache = new Map();
    this.apiUrl = '/api/chatgpt'; // Keep endpoint name for backward compatibility
    this.requestQueue = Promise.resolve();
    this.lastRequestAt = 0;
    // Routeway free tier is 5 RPM. Keep a safe spacing to avoid bursts.
    this.minRequestIntervalMs = 15000;
    this.max429Retries = 1;
  }

  private async waitForRateLimitSlot(): Promise<void> {
    const run = async () => {
      const now = Date.now();
      const waitMs = Math.max(0, this.minRequestIntervalMs - (now - this.lastRequestAt));
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
      this.lastRequestAt = Date.now();
    };

    const next = this.requestQueue.then(run, run);
    // Keep queue chain alive even if a waiter fails unexpectedly.
    this.requestQueue = next.catch(() => {});
    await next;
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
      const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout for slower free providers

      // Queue and pace outgoing AI calls so low-RPM providers do not hard-fail on startup bursts.
      await this.waitForRateLimitSlot();

      let response: Response;
      let attempt = 0;
      while (true) {
        response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
          signal: controller.signal,
        });

        if (response.status !== 429 || attempt >= this.max429Retries) {
          break;
        }

        // Respect provider-imposed cooldown before one retry.
        let retryAfterMs = 65000;
        try {
          const retryBody = await response.clone().json();
          const errorMsg =
            retryBody?.details?.error?.message ||
            retryBody?.error?.message ||
            retryBody?.error ||
            '';
          const match = String(errorMsg).match(/(\d+)\s*RPM|try again in (\d+)s?/i);
          if (match) {
            const sec = parseInt((match[2] || '60'), 10);
            if (Number.isFinite(sec) && sec > 0) retryAfterMs = (sec + 5) * 1000;
          }
        } catch {
          // keep default
        }

        await new Promise(resolve => setTimeout(resolve, retryAfterMs));
        // Keep spacing state coherent after long wait.
        this.lastRequestAt = Date.now();
        attempt += 1;
      }

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

      const result: any = await response.json();
      
      // Check for candidates array
      if (!result?.candidates || !Array.isArray(result.candidates) || result.candidates.length === 0) {
        console.error('Invalid Gemini API response: missing or empty candidates array', result);
        throw new Error('Invalid response structure from Gemini API: no candidates');
      }
      
      const candidate = result.candidates[0];
      
      // Check for finish reason (normalize casing because providers may return "stop")
      // MAX_TOKENS (Gemini) and LENGTH (OpenAI-compatible finish_reason) mean truncated output — not a safety block
      // Other reasons like SAFETY, RECITATION, etc. mean content was blocked
      const rawFinishReason = String(candidate.finishReason || '').trim();
      const finishReason = rawFinishReason.toUpperCase();
      const isTruncationFinish =
        finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH';

      if (finishReason && finishReason !== 'STOP' && !isTruncationFinish) {
        const reason = rawFinishReason || finishReason;
        const safetyRatings = candidate.safetyRatings || [];
        const blockedCategories = safetyRatings
          .filter((r: any) => r.blocked)
          .map((r: any) => r.category);
        
        console.error('Gemini API response blocked by safety filters:', {
          finishReason: reason,
          blockedCategories: blockedCategories,
          safetyRatings: safetyRatings,
          candidate: candidate
        });
        
        throw new Error(`Gemini API response blocked: ${reason}. Blocked categories: ${blockedCategories.join(', ') || 'unknown'}. Gemini has stricter content filters than ChatGPT.`);
      }
      
      // Truncation — log warning but continue (JSON recovery may still succeed)
      if (isTruncationFinish) {
        console.warn(
          'AI response truncated at max tokens (finishReason: ' +
            (rawFinishReason || finishReason) +
            ') — response may be incomplete. Consider increasing max_tokens / maxOutputTokens.'
        );
      }
      
      // Try to get text from content.parts
      // Sometimes the first part is empty while later parts contain text.
      let text = '';
      const contentParts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      for (const part of contentParts) {
        if (typeof part === 'string' && part.trim()) {
          text += part;
          continue;
        }
        if (typeof part?.text === 'string' && part.text.trim()) {
          text += part.text;
        }
      }
      text = text.trim();
      
      // Special handling for truncation - might have different structure
      if (!text && isTruncationFinish && candidate.content) {
        // Truncation might return content without parts array
        // Check alternative locations for text
        const contentAny = candidate.content as any;
        if (contentAny.text && typeof contentAny.text === 'string') {
          text = contentAny.text;
          console.warn('Found text in content.text for truncated response');
        } else if (contentAny.content && typeof contentAny.content === 'string') {
          text = contentAny.content;
          console.warn('Found text in content.content for truncated response');
        } else if (!contentAny.parts || contentAny.parts.length === 0) {
          // No parts array - known issue when output is fully truncated
          // The response was completely truncated, nothing we can do
          console.error('AI truncation: content exists but parts array is missing/empty:', {
            hasContent: !!candidate.content,
            contentKeys: Object.keys(candidate.content),
            content: candidate.content,
            fullCandidate: candidate
          });
          throw new Error(
            'AI response completely truncated at token limit — no text was returned. Increase max_tokens / maxOutputTokens for this request.'
          );
        }
      }
      
      // Fallback: check if text is directly in the part (some API versions)
      if (!text && candidate?.content?.parts?.[0]) {
        const part = candidate.content.parts[0];
        // Check if text might be a direct property or if there's JSON in a different format
        if (typeof part === 'string') {
          text = part;
        } else if (part.text === undefined && Object.keys(part).length === 0) {
          // Empty part might indicate blocked content
          console.warn('Gemini API returned empty part - content may be blocked');
        }
      }
      
      // If text is not found, check if there's an error or different structure
      if (!text) {
        // Check if there's an error message
        if (candidate.content?.parts?.[0]?.error) {
          throw new Error(`Gemini API error: ${candidate.content.parts[0].error.message || 'Unknown error'}`);
        }

        // OpenAI-compatible providers can legally return STOP with empty content.
        // Don't misclassify this as "blocked by safety"; return a clearer failure.
        if (finishReason === 'STOP') {
          throw new Error('AI response was empty. Provider returned STOP without text content.');
        }
        
        // Check if content might be missing or blocked
        if (!candidate.content) {
          console.error('Gemini API candidate missing content:', {
            finishReason: candidate.finishReason,
            safetyRatings: candidate.safetyRatings,
            citationMetadata: candidate.citationMetadata,
            fullCandidate: candidate
          });
          throw new Error(`Gemini API response blocked or incomplete. Finish reason: ${candidate.finishReason || 'UNKNOWN'}`);
        }
        
        // Check if parts array is missing or empty (non-MAX_TOKENS case)
        if (!candidate.content.parts || candidate.content.parts.length === 0) {
          console.error('Gemini API candidate missing parts array:', {
            hasContent: !!candidate.content,
            content: candidate.content,
            finishReason: candidate.finishReason,
            fullCandidate: candidate
          });
          throw new Error('Invalid response structure from Gemini API: content.parts array is missing or empty');
        }
        
        // Check if first part is missing text
        const firstPart = candidate.content.parts[0];
        if (!firstPart) {
          console.error('Gemini API candidate missing first part:', {
            partsLength: candidate.content.parts.length,
            parts: candidate.content.parts,
            fullCandidate: candidate
          });
          throw new Error('Invalid response structure from Gemini API: parts[0] is missing');
        }
        
        // Log the actual structure for debugging
        console.error('Invalid Gemini API response structure - part exists but no text:', {
          firstPart: firstPart,
          firstPartKeys: Object.keys(firstPart),
          hasText: 'text' in firstPart,
          hasInlineData: 'inlineData' in firstPart,
          hasFunctionCall: 'functionCall' in firstPart,
          hasFunctionResponse: 'functionResponse' in firstPart,
          fullCandidate: candidate,
          fullResult: result
        });
        
        // Check if text might be in a different property or if it's using function calling
        if (firstPart.inlineData) {
          throw new Error('Gemini API returned inline data instead of text. This is not supported.');
        }
        if (firstPart.functionCall) {
          throw new Error('Gemini API returned function call instead of text. This is not supported.');
        }
        
        throw new Error('Invalid response structure from Gemini API: parts[0].text is missing or undefined');
      }

      // Cache the response
      this.cache.set(cacheKey, {
        data: text,
        timestamp: Date.now()
      });

      return text;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Gemini API request timed out (50s)');
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

      let shouldRecover = false;

      // Fast path: if it's already valid JSON, return immediately.
      try {
        return JSON.parse(cleaned) as T;
      } catch (parseError) {
        // We'll try to recover below.
        shouldRecover = true;
        console.warn('Failed to parse JSON response, attempting recovery...', {
          parseError: parseError instanceof Error ? parseError.message : String(parseError)
        });
      }

      // Extra signal: also recover when it looks truncated.
      if (!cleaned.endsWith('}') && !cleaned.endsWith(']')) {
        shouldRecover = true;
        console.warn('JSON response appears truncated (missing closing), attempting recovery...');
      }

      if (shouldRecover) {
        // Response might be truncated - try to recover by finding last complete structure

        const stripTrailingIncompleteFragments = (input: string): string => {
          let s = input.trimEnd();
          let guard = 0;
          while (guard++ < 40) {
            const t = s.trimEnd();
            if (!t.length) break;
            let cut: string | null = null;
            // Truncated first element in JSON array: [ { "k": v, ...   (no closing } )
            if (/\[\s*\{[^{}]*$/.test(t)) {
              cut = t.replace(/\[\s*\{[^{}]*$/, '[');
            } else if (/,[\s]*\{[^{}]*$/s.test(t)) {
              // Truncated object after comma in array/object
              cut = t.replace(/,[\s]*\{[^{}]*$/s, '');
            } else if (/,[\s]*"[^"]+"\s*:\s*[^,}\]]+\s*$/s.test(t)) {
              // Trailing comma then a complete single property (next key never started) — drop the lone property fragment
              cut = t.replace(/,[\s]*"[^"]+"\s*:\s*[^,}\]]+\s*$/s, '');
            }
            if (cut !== null && cut !== t) {
              s = cut.trimEnd();
              continue;
            }
            break;
          }
          return s;
        };

        cleaned = stripTrailingIncompleteFragments(cleaned);
        
        // Parse character by character to find last valid position
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
            // If we're closing a string, mark this position as potentially valid
            if (!inString) {
              lastValidPos = i;
            }
            continue;
          }
          
          if (inString) continue;
          
          // Track depth
          if (char === '{') {
            braceDepth++;
          } else if (char === '}') {
            braceDepth--;
            if (braceDepth >= 0 && bracketDepth >= 0) {
              lastValidPos = i;
            }
          } else if (char === '[') {
            bracketDepth++;
          } else if (char === ']') {
            bracketDepth--;
            if (braceDepth >= 0 && bracketDepth >= 0) {
              lastValidPos = i;
            }
          } else if (char === ',' && braceDepth > 0) {
            // Commas inside objects are valid break points if we're at a complete property
            // Check if the character before is a valid value terminator
            let j = i - 1;
            while (j >= 0 && (cleaned[j] === ' ' || cleaned[j] === '\n' || cleaned[j] === '\t' || cleaned[j] === '\r')) {
              j--;
            }
            if (j >= 0 && (cleaned[j] === '"' || cleaned[j] === '}' || cleaned[j] === ']' || /[0-9]/.test(cleaned[j]) || cleaned[j] === 'e' || cleaned[j] === 'l')) {
              // Previous character looks like end of a value
              lastValidPos = i;
            }
          }
        }
        
        // If we're still inside structures at the end, we need to close them
        if (lastValidPos >= 0 && lastValidPos < cleaned.length - 1) {
          // Cut at the last valid position
          cleaned = cleaned.substring(0, lastValidPos + 1);
        }
        
        // Now clean up any incomplete trailing structures
        // Recalculate depths to see what needs closing
        braceDepth = 0;
        bracketDepth = 0;
        inString = false;
        escapeNext = false;
        
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
          
          if (char === '{') braceDepth++;
          else if (char === '}') braceDepth--;
          else if (char === '[') bracketDepth++;
          else if (char === ']') bracketDepth--;
        }
        
        // Remove trailing incomplete content by finding last complete structure boundary
        // Look backwards from the end for incomplete property definitions
        let removeIncomplete = true;
        while (removeIncomplete && cleaned.length > 0) {
          const trimmed = cleaned.trimEnd();
          let changed = false;
          
          // Remove trailing incomplete patterns
          if (trimmed.endsWith(',')) {
            cleaned = trimmed.slice(0, -1).trimEnd();
            changed = true;
          } else if (trimmed.match(/,\s*"[^"]+"\s*:\s*\{\s*$/)) {
            // Incomplete object property: "prop": {
            cleaned = trimmed.replace(/,\s*"[^"]+"\s*:\s*\{\s*$/, '').trimEnd();
            braceDepth = Math.max(0, braceDepth - 1);
            changed = true;
          } else if (trimmed.match(/"[^"]+"\s*:\s*\{\s*$/)) {
            // Incomplete object property (first property): "prop": {
            cleaned = trimmed.replace(/"[^"]+"\s*:\s*\{\s*$/, '').trimEnd();
            braceDepth = Math.max(0, braceDepth - 1);
            changed = true;
          } else if (trimmed.match(/,\s*"[^"]+"\s*:\s*\[\s*$/)) {
            // Incomplete array property: "prop": [
            cleaned = trimmed.replace(/,\s*"[^"]+"\s*:\s*\[\s*$/, '').trimEnd();
            bracketDepth = Math.max(0, bracketDepth - 1);
            changed = true;
          } else if (trimmed.match(/"[^"]+"\s*:\s*\[\s*$/)) {
            // Incomplete array property (first property): "prop": [
            cleaned = trimmed.replace(/"[^"]+"\s*:\s*\[\s*$/, '').trimEnd();
            bracketDepth = Math.max(0, bracketDepth - 1);
            changed = true;
          } else if (trimmed.match(/:\s*"[^"]*$/)) {
            // Incomplete string value
            cleaned = trimmed.replace(/:\s*"[^"]*$/, '').trimEnd();
            changed = true;
          } else if (trimmed.endsWith(':')) {
            // Trailing colon
            cleaned = trimmed.slice(0, -1).trimEnd();
            changed = true;
          } else if (trimmed.endsWith('{') && braceDepth > 0) {
            // Trailing incomplete object start
            cleaned = trimmed.slice(0, -1).trimEnd();
            braceDepth--;
            changed = true;
          } else if (trimmed.endsWith('[') && bracketDepth > 0) {
            // Trailing incomplete array start
            cleaned = trimmed.slice(0, -1).trimEnd();
            bracketDepth--;
            changed = true;
          }
          
          if (!changed) {
            removeIncomplete = false;
          }
        }
        
        // Close all remaining open structures
        for (let i = 0; i < bracketDepth; i++) {
          cleaned += ']';
        }
        for (let i = 0; i < braceDepth; i++) {
          cleaned += '}';
        }
        
        if (lastValidPos < 0) {
          // Fallback: find last complete brace/bracket
          const lastBrace = cleaned.lastIndexOf('}');
          const lastBracket = cleaned.lastIndexOf(']');
          const cutPoint = Math.max(lastBrace, lastBracket);
          if (cutPoint > cleaned.length * 0.3) { // Allow cutting even if we lose some content
            cleaned = cleaned.substring(0, cutPoint + 1);
            
            // Close root structure
            if (cleaned.startsWith('{')) {
              const openBraces = (cleaned.match(/\{/g) || []).length;
              const closeBraces = (cleaned.match(/\}/g) || []).length;
              for (let i = 0; i < openBraces - closeBraces; i++) {
                cleaned += '}';
              }
            }
          }
        }

        // Final attempt to parse recovered JSON.
        try {
          return JSON.parse(cleaned) as T;
        } catch {
          cleaned = stripTrailingIncompleteFragments(cleaned);
          // Recompute bracket/brace balance after another strip pass
          braceDepth = 0;
          bracketDepth = 0;
          inString = false;
          escapeNext = false;
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
            if (char === '{') braceDepth++;
            else if (char === '}') braceDepth--;
            else if (char === '[') bracketDepth++;
            else if (char === ']') bracketDepth--;
          }
          while (cleaned.trimEnd().endsWith(',')) {
            cleaned = cleaned.trimEnd().slice(0, -1).trimEnd();
          }
          for (let i = 0; i < bracketDepth; i++) cleaned += ']';
          for (let i = 0; i < braceDepth; i++) cleaned += '}';
          return JSON.parse(cleaned) as T;
        }
      }

      // Should be unreachable due to shouldRecover=true on parse failure,
      // but keep a defensive return.
      return JSON.parse(cleaned) as T;
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      console.error('Response text:', response.substring(0, 1500)); // Log first 1500 chars for better debugging
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

