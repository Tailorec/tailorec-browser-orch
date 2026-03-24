import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('response schemas contract', () => {
  it('defines the shared response envelopes used by the current API', () => {
    const okEnvelope = z.object({ ok: z.literal(true) });
    const errorEnvelope = z.object({ ok: z.literal(false), error: z.string() });
    const snapshotResponse = okEnvelope.extend({
      targetId: z.string(),
      url: z.string(),
      snapshot: z.string(),
      refs: z.record(z.string(), z.object({ role: z.string(), name: z.string().optional(), nth: z.number().optional() })),
      truncated: z.boolean().optional(),
      stats: z.object({
        lines: z.number(),
        chars: z.number(),
        refs: z.number(),
        interactive: z.number(),
      }).optional(),
    });

    expect(errorEnvelope.parse({ ok: false, error: 'bad request' })).toEqual({
      ok: false,
      error: 'bad request',
    });
    expect(
      snapshotResponse.parse({
        ok: true,
        targetId: 'tab-1',
        url: 'https://example.test',
        snapshot: 'snapshot',
        refs: { e1: { role: 'button' } },
        stats: { lines: 1, chars: 8, refs: 1, interactive: 1 },
      }),
    ).toMatchObject({ ok: true, targetId: 'tab-1' });
  });
});
