/**
 * Checks a Gemini API key through the server (api/ai.ts `verify-key`), which asks Google's
 * model list: free, and it does not spend generation quota.
 * `valid: null` = Google could not be reached, so the key is neither accepted nor rejected.
 */
export async function verifyGeminiKey(key: string): Promise<{ valid: boolean | null; reason?: string }> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify-key', key: key.trim() }),
    });
    if (!res.ok) return { valid: null, reason: `The System answered ${res.status}.` };
    const data = await res.json();
    return { valid: data?.valid ?? null, reason: data?.reason };
  } catch {
    return { valid: null, reason: 'Could not reach the System.' };
  }
}

export interface AiUsageToday {
  /** Pacific-time date: Gemini free quotas reset at midnight Pacific. */
  date: string;
  /** Requests served today by the player's own key(s). */
  user: number;
  /** Requests served today by the shared guild key. */
  shared: number;
}

export async function fetchAiUsageToday(): Promise<AiUsageToday | null> {
  try {
    const res = await fetch(`/api/ai?action=usage&_t=${Date.now()}`);
    if (!res.ok) return null;
    return (await res.json()) as AiUsageToday;
  } catch {
    return null;
  }
}
