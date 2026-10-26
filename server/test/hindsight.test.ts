import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHindsightEnabled,
  retainEventMemory,
  recallEventMemory,
  setClientForTesting,
} from '../src/services/hindsight.js';

describe('Hindsight AI Memory Service', () => {
  beforeEach(() => {
    // Reset client before each test
    setClientForTesting(null);
    delete process.env.HINDSIGHT_API_KEY;
    delete process.env.HINDSIGHT_BASE_URL;
  });

  describe('Graceful Service Failure & Degradation', () => {
    test('isHindsightEnabled returns false when env vars are absent', () => {
      assert.equal(isHindsightEnabled(), false);
    });

    test('retainEventMemory completes cleanly without throwing when disabled', async () => {
      await assert.doesNotReject(async () => {
        await retainEventMemory('event-123', 'Guest Alice checked in');
      });
    });

    test('recallEventMemory returns null when disabled', async () => {
      const result = await recallEventMemory('event-123', 'Who checked in?');
      assert.equal(result, null);
    });

    test('retainEventMemory catches and swallows client errors without crashing caller', async () => {
      const mockClient = {
        retain: async () => {
          throw new Error('Hindsight API connection timeout');
        },
        recall: async () => null,
      } as any;

      setClientForTesting(mockClient);
      assert.equal(isHindsightEnabled(), true);

      await assert.doesNotReject(async () => {
        await retainEventMemory('event-123', 'Guest Bob uploaded a photo');
      });
    });

    test('recallEventMemory returns null and swallows errors on API failure', async () => {
      const mockClient = {
        retain: async () => {},
        recall: async () => {
          throw new Error('503 Service Unavailable');
        },
      } as any;

      setClientForTesting(mockClient);
      const result = await recallEventMemory('event-123', 'What happened?');
      assert.equal(result, null);
    });
  });

  describe('Event Isolation & Bank Scoping', () => {
    test('retainEventMemory strictly scopes bank_id to eventId', async () => {
      const calls: Array<{ bankId: string; content: string }> = [];
      const mockClient = {
        retain: async (bankId: string, content: string) => {
          calls.push({ bankId, content });
        },
        recall: async () => null,
      } as any;

      setClientForTesting(mockClient);

      await retainEventMemory('wedding-2026', 'Cake cutting at 8:00 PM');
      await retainEventMemory('conference-2026', 'Keynote started in Hall A');

      assert.equal(calls.length, 2);
      assert.equal(calls[0].bankId, 'wedding-2026');
      assert.equal(calls[0].content, 'Cake cutting at 8:00 PM');
      assert.equal(calls[1].bankId, 'conference-2026');
      assert.equal(calls[1].content, 'Keynote started in Hall A');
    });

    test('recallEventMemory strictly queries only the requested event bank_id', async () => {
      const queries: Array<{ bankId: string; query: string }> = [];
      const mockClient = {
        retain: async () => {},
        recall: async (bankId: string, query: string) => {
          queries.push({ bankId, query });
          if (bankId === 'event-alpha') {
            return {
              results: [{ text: 'Alpha surprise party at 9 PM', type: 'memory' }],
            };
          }
          return { results: [] };
        },
      } as any;

      setClientForTesting(mockClient);

      const alphaResult = await recallEventMemory('event-alpha', 'surprise?');
      const betaResult = await recallEventMemory('event-beta', 'surprise?');

      assert.equal(queries.length, 2);
      assert.equal(queries[0].bankId, 'event-alpha');
      assert.equal(queries[1].bankId, 'event-beta');

      assert.deepEqual(alphaResult, {
        results: [{ text: 'Alpha surprise party at 9 PM', type: 'memory' }],
      });
      assert.deepEqual(betaResult, {
        results: [],
      });
    });
  });

  describe('Recall Normalization', () => {
    test('normalizes diverse response shapes into typed results array', async () => {
      const mockClient = {
        retain: async () => {},
        recall: async () => ({
          results: [
            { text: 'Memory 1', type: 'fact' },
            { content: 'Memory 2' }, // content fallback
            { other: 'value' },       // empty text fallback
          ],
        }),
      } as any;

      setClientForTesting(mockClient);

      const result = await recallEventMemory('event-xyz', 'summary');
      assert.deepEqual(result, {
        results: [
          { text: 'Memory 1', type: 'fact' },
          { text: 'Memory 2', type: 'memory' },
          { text: '', type: 'memory' },
        ],
      });
    });
  });
});
