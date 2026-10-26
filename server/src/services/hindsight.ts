/**
 * Hindsight AI Memory Service
 *
 * Provides fire-and-forget `retainEventMemory` and `recallEventMemory` helpers
 * scoped per event via `bank_id = eventId`.
 *
 * Gracefully degrades when HINDSIGHT_API_KEY / HINDSIGHT_BASE_URL are absent —
 * the rest of the app continues to work normally without these env vars.
 */

import { HindsightClient } from '@vectorize-io/hindsight-client';

// Lazily initialised singleton — avoids crashing on import when keys are absent.
let _client: HindsightClient | null = null;

function getClient(): HindsightClient | null {
  if (_client) return _client;
  const apiKey = process.env.HINDSIGHT_API_KEY;
  const baseUrl = process.env.HINDSIGHT_BASE_URL;
  if (!apiKey || !baseUrl) return null;
  _client = new HindsightClient({ baseUrl, apiKey });
  return _client;
}

/**
 * Returns `true` when Hindsight credentials are configured and the client
 * can be initialised.
 */
export function isHindsightEnabled(): boolean {
  return getClient() !== null;
}

/**
 * Fire-and-forget: store a memory fragment for the given event.
 *
 * Uses `eventId` as the `bank_id` so each event's memories are isolated.
 * Never throws — errors are logged and swallowed so callers are unaffected.
 */
export async function retainEventMemory(eventId: string, content: string): Promise<void> {
  const client = getClient();
  if (!client) return; // Hindsight not configured — silently skip

  try {
    await client.retain(eventId, content);
  } catch (err: unknown) {
    // Log the error category but NEVER log credential values
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[hindsight] retainEventMemory failed:', message);
  }
}

/**
 * Query stored memories for the given event.
 *
 * Returns `null` when Hindsight is disabled or on error, so callers can
 * detect the unavailable state and respond with `{ results: [], unavailable: true }`.
 */
export async function recallEventMemory(
  eventId: string,
  query: string,
): Promise<{ results: Array<{ text: string; type: string }> } | null> {
  const client = getClient();
  if (!client) return null; // Hindsight not configured

  try {
    const response = await client.recall(eventId, query);
    // Normalise whatever the SDK returns into our typed shape
    const results: Array<{ text: string; type: string }> = Array.isArray(response?.results)
      ? response.results.map((r: any) => ({
          text: String(r?.text ?? r?.content ?? ''),
          type: String(r?.type ?? 'memory'),
        }))
      : [];
    return { results };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[hindsight] recallEventMemory failed:', message);
    return null;
  }
}
