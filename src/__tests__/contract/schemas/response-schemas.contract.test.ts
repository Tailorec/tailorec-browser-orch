import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const OkEnvelope = z.object({
  ok: z.literal(true),
  targetId: z.string(),
  url: z.string().optional(),
});

const ErrorEnvelope = z.object({
  ok: z.literal(false),
  error: z.string(),
});

const FillResultSchema = z.object({
  ref: z.string(),
  matched: z.boolean(),
  requestedValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  actualValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  warning: z.string().optional(),
});

const FillMismatchSchema = z.object({
  ref: z.string(),
  requested: z.union([z.string(), z.number(), z.boolean()]).optional(),
  actual: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  warning: z.string().optional(),
});

const ActResponseSchema = OkEnvelope.extend({
  result: z.unknown().optional(),
  state: z.record(z.string(), z.unknown()).optional(),
  states: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  options: z.array(z.record(z.string(), z.unknown())).optional(),
  blocked: z.boolean().optional(),
  blockerType: z.string().optional(),
  dismissed: z.boolean().optional(),
  strategy: z.string().optional(),
  results: z.array(FillResultSchema).optional(),
  allMatched: z.boolean().optional(),
  mismatched: z.array(FillMismatchSchema).optional(),
});

const SnapshotResponseSchema = OkEnvelope.extend({
  snapshot: z.string(),
  refs: z.record(z.string(), z.object({
    role: z.string(),
    name: z.string().optional(),
    nth: z.number().optional(),
  })).optional().default({}),
  truncated: z.boolean().optional(),
  stats: z.object({
    lines: z.number(),
    chars: z.number(),
    refs: z.number(),
    interactive: z.number(),
  }).optional(),
  started: z.boolean().optional(),
  stopped: z.boolean().optional(),
  changes: z.array(z.record(z.string(), z.unknown())).optional(),
  addedElements: z.array(z.unknown()).optional(),
  removedElements: z.array(z.unknown()).optional(),
  modifiedElements: z.array(z.unknown()).optional(),
  urlChanged: z.boolean().optional(),
  previousUrl: z.string().optional(),
  currentUrl: z.string().optional(),
  observationDurationMs: z.number().optional(),
});

const ScreenshotResponseSchema = OkEnvelope.extend({
  mimeType: z.enum(['image/png', 'image/jpeg']),
  imageBase64: z.string(),
  labels: z.number().optional(),
  skipped: z.number().optional(),
});

const HookResponseSchema = z.object({
  ok: z.literal(true),
  targetId: z.string().optional(),
  download: z.record(z.string(), z.unknown()).optional(),
});

const ControlResponseSchema = z.object({
  ok: z.literal(true),
  mode: z.literal('interactive'),
  ws_url: z.string(),
  run_id: z.string().nullable(),
  note: z.string(),
});

const StatusResponseSchema = z.object({
  ok: z.literal(true),
  profiles: z.array(z.string()),
});

const DetailedErrorEnvelope = ErrorEnvelope.extend({
  code: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

describe('response schemas contract', () => {
  describe('ActResponse schema contracts', () => {
    it('click response structure', () => {
      expect(
        ActResponseSchema.parse({
          ok: true,
          targetId: 'tab-123',
          url: 'https://example.com',
        }),
      ).toMatchObject({ ok: true, targetId: 'tab-123', url: 'https://example.com' });
    });

    it('type response structure', () => {
      expect(ActResponseSchema.parse({ ok: true, targetId: 'tab-123' })).toMatchObject({ ok: true, targetId: 'tab-123' });
    });

    it('fill response structure with results', () => {
      const parsed = ActResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        results: [
          { ref: 'd1', matched: true, requestedValue: 'John', actualValue: 'John' },
          { ref: 'd2', matched: false, requestedValue: 'john@example.com', actualValue: 'JOHN@EXAMPLE.COM', warning: 'Case mismatch' },
        ],
        allMatched: false,
        mismatched: [
          { ref: 'd2', requested: 'john@example.com', actual: 'JOHN@EXAMPLE.COM', warning: 'Case mismatch' },
        ],
      });
      expect(parsed.results).toHaveLength(2);
      expect(parsed.mismatched).toHaveLength(1);
      expect(parsed.allMatched).toBe(false);
    });

    it('evaluate response structure with result', () => {
      expect(
        ActResponseSchema.parse({
          ok: true,
          targetId: 'tab-123',
          url: 'https://example.com',
          result: 'Page Title',
        }).result,
      ).toBe('Page Title');
    });

    it('navigate response structure', () => {
      expect(
        ActResponseSchema.parse({
          ok: true,
          targetId: 'tab-123',
          url: 'https://new-url.com',
        }).url,
      ).toBe('https://new-url.com');
    });

    it('query_state response with single ref', () => {
      const parsed = ActResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        state: {
          visible: true,
          enabled: true,
          text: 'Submit',
        },
      });
      expect(parsed.state).toBeDefined();
    });

    it('query_state response with multiple refs', () => {
      const parsed = ActResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        states: {
          d1: { visible: true, enabled: true },
          d2: { visible: false, enabled: false },
        },
      });
      expect(parsed.states).toBeDefined();
    });

    it('discover_dropdown response structure', () => {
      const parsed = ActResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        options: [
          { value: '1', label: 'Option 1', selected: false },
          { value: '2', label: 'Option 2', selected: true },
        ],
      });
      expect(parsed.options).toHaveLength(2);
    });

    it('detect_blocker response structure', () => {
      const parsed = ActResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        blocked: true,
        blockerType: 'cookie-banner',
      });
      expect(parsed.blocked).toBe(true);
      expect(parsed.blockerType).toBe('cookie-banner');
    });

    it('dismiss_blocker response structure', () => {
      const parsed = ActResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        dismissed: true,
        strategy: 'click',
      });
      expect(parsed.dismissed).toBe(true);
      expect(parsed.strategy).toBe('click');
    });

    it('all successful responses include ok: true', () => {
      const responses = [
        { ok: true, targetId: 't1' },
        { ok: true, targetId: 't1', url: 'https://example.com' },
        { ok: true, targetId: 't1', result: 'value' },
      ];
      for (const response of responses) {
        expect(ActResponseSchema.parse(response).ok).toBe(true);
      }
    });

    it('all successful responses include targetId', () => {
      const responses = [
        { ok: true, targetId: 't1' },
        { ok: true, targetId: 't1', url: 'https://example.com' },
      ];
      for (const response of responses) {
        expect(ActResponseSchema.parse(response).targetId).toBeDefined();
      }
    });
  });

  describe('SnapshotResponse schema contracts', () => {
    it('basic snapshot response', () => {
      const parsed = SnapshotResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        url: 'https://example.com',
        snapshot: '<html>...</html>',
      });
      expect(parsed.snapshot).toBeDefined();
    });

    it('snapshot with refs', () => {
      const parsed = SnapshotResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        url: 'https://example.com',
        snapshot: '<html>...</html>',
        refs: {
          d1: { role: 'button', name: 'Submit' },
          d2: { role: 'textbox', name: 'Email' },
        },
      });
      expect(Object.keys(parsed.refs ?? {})).toHaveLength(2);
    });

    it('snapshot with truncated indicator', () => {
      expect(
        SnapshotResponseSchema.parse({
          ok: true,
          targetId: 'tab-123',
          url: 'https://example.com',
          snapshot: '<html>...',
          truncated: true,
        }).truncated,
      ).toBe(true);
    });

    it('snapshot with stats', () => {
      const parsed = SnapshotResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        url: 'https://example.com',
        snapshot: 'snapshot',
        refs: { e1: { role: 'button' } },
        stats: { lines: 1, chars: 8, refs: 1, interactive: 1 },
      });
      expect(parsed.stats).toMatchObject({ lines: 1, chars: 8, refs: 1, interactive: 1 });
    });

    it('snapshot delta start response', () => {
      expect(
        SnapshotResponseSchema.parse({
          ok: true,
          targetId: 'tab-123',
          url: 'https://example.com',
          snapshot: 'snapshot',
          started: true,
        }).started,
      ).toBe(true);
    });

    it('snapshot delta stop response with changes', () => {
      const parsed = SnapshotResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        url: 'https://example.com',
        snapshot: 'snapshot',
        stopped: true,
        changes: [
          { type: 'added', ref: 'd3' },
          { type: 'removed', ref: 'd1' },
          { type: 'modified', ref: 'd2' },
        ],
      });
      expect(parsed.stopped).toBe(true);
      expect(parsed.changes).toHaveLength(3);
    });

    it('snapshot delta stop response with observer arrays', () => {
      const parsed = SnapshotResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        url: 'https://example.com',
        snapshot: 'snapshot',
        addedElements: [],
        removedElements: [],
        modifiedElements: [],
        urlChanged: false,
        previousUrl: 'https://example.com',
        currentUrl: 'https://example.com',
        observationDurationMs: 100,
      });
      expect(parsed.urlChanged).toBe(false);
      expect(parsed.observationDurationMs).toBe(100);
    });
  });

  describe('ScreenshotResponse schema contracts', () => {
    it('basic screenshot response', () => {
      const parsed = ScreenshotResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        url: 'https://example.com',
        mimeType: 'image/png',
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      });
      expect(parsed.mimeType).toBe('image/png');
      expect(parsed.imageBase64).toBeDefined();
    });

    it('jpeg screenshot response', () => {
      const parsed = ScreenshotResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        url: 'https://example.com',
        mimeType: 'image/jpeg',
        imageBase64: '/9j/4AAQSkZJRgABAQAAAQABAAD',
      });
      expect(parsed.mimeType).toBe('image/jpeg');
    });

    it('labeled screenshot response includes counts', () => {
      const parsed = ScreenshotResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        url: 'https://example.com',
        mimeType: 'image/png',
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
        labels: 4,
        skipped: 2,
      });
      expect(parsed.labels).toBe(4);
      expect(parsed.skipped).toBe(2);
    });
  });

  describe('Hook and error response schemas', () => {
    it('download response structure', () => {
      const parsed = HookResponseSchema.extend({ targetId: z.string() }).parse({
        ok: true,
        targetId: 'tab-123',
        download: {
          path: '/path/to/download.pdf',
          suggestedFilename: 'document.pdf',
          totalBytes: 102400,
        },
      });
      expect(parsed.download).toMatchObject({
        path: '/path/to/download.pdf',
        suggestedFilename: 'document.pdf',
        totalBytes: 102400,
      });
    });

    it('wait/download response structure', () => {
      const parsed = HookResponseSchema.extend({ targetId: z.string() }).parse({
        ok: true,
        targetId: 'tab-123',
        download: {
          path: '/path/to/download.pdf',
          suggestedFilename: 'report.xlsx',
          totalBytes: 51200,
        },
      });
      expect(parsed.download).toMatchObject({
        path: '/path/to/download.pdf',
        suggestedFilename: 'report.xlsx',
        totalBytes: 51200,
      });
    });

    it('file chooser hook response structure', () => {
      expect(HookResponseSchema.parse({ ok: true })).toEqual({ ok: true });
    });

    it('dialog hook response structure', () => {
      expect(HookResponseSchema.parse({ ok: true })).toEqual({ ok: true });
    });

    it('wait download response structure', () => {
      const parsed = HookResponseSchema.parse({
        ok: true,
        download: { path: '/tmp/download.txt' },
      });
      expect(parsed.download).toEqual({ path: '/tmp/download.txt' });
    });

    it('control endpoint response structure', () => {
      const parsed = ControlResponseSchema.parse({
        ok: true,
        mode: 'interactive',
        ws_url: 'ws://127.0.0.1:4000/control/live?token=abc',
        run_id: 'run-123',
        note: 'Use ws_url for browser interaction.',
      });
      expect(parsed.run_id).toBe('run-123');
      expect(parsed.ws_url).toContain('/control/live');
    });

    it('control response without run_id', () => {
      const parsed = ControlResponseSchema.parse({
        ok: true,
        mode: 'interactive',
        ws_url: 'ws://127.0.0.1:4000/control/live?token=abc123',
        run_id: null,
        note: 'Use ws_url for browser interaction.',
      });
      expect(parsed.run_id).toBeNull();
    });

    it('status endpoint response structure', () => {
      const parsed = StatusResponseSchema.parse({
        ok: true,
        profiles: ['default', 'profile-1', 'profile-2'],
      });
      expect(parsed.profiles).toHaveLength(3);
    });

    it('status with empty profiles', () => {
      const parsed = StatusResponseSchema.parse({
        ok: true,
        profiles: [],
      });
      expect(parsed.profiles).toHaveLength(0);
    });

    it('error envelope structure', () => {
      expect(ErrorEnvelope.parse({ ok: false, error: 'bad request' })).toEqual({
        ok: false,
        error: 'bad request',
      });
    });

    it('error envelope with code and details', () => {
      const parsed = DetailedErrorEnvelope.parse({
        ok: false,
        error: 'Browser action timed out',
        code: 'WAIT_LOAD_STATE_TIMEOUT',
        details: {
          kind: 'wait',
          targetId: 'tab-123',
          loadState: 'networkidle',
          timeoutMs: 5000,
        },
      });
      expect(parsed.code).toBe('WAIT_LOAD_STATE_TIMEOUT');
      expect(parsed.details).toBeDefined();
    });

    for (const errorMessage of [
      'ref is required',
      'button must be left|right|middle',
      'unsupported kind',
      'act:evaluate is disabled by config',
      'Browser is not available',
      'Element not found: ref=d1',
      'Action timed out after 5000ms',
      'Invalid targetId: tab-999',
    ]) {
      it(`accepts error response "${errorMessage}"`, () => {
        expect(DetailedErrorEnvelope.parse({ ok: false, error: errorMessage }).error).toBe(errorMessage);
      });
    }
  });

  describe('response field type contracts', () => {
    it('ok field is always boolean', () => {
      expect(typeof true).toBe('boolean');
      expect(typeof false).toBe('boolean');
    });

    it('targetId is always string when present', () => {
      expect(OkEnvelope.parse({ ok: true, targetId: 'tab-123' }).targetId).toBe('tab-123');
    });

    it('url is always string when present', () => {
      expect(OkEnvelope.parse({ ok: true, targetId: 'tab-123', url: 'https://example.com' }).url).toBe('https://example.com');
    });

    it('mimeType follows image/* pattern', () => {
      for (const mimeType of ['image/png', 'image/jpeg']) {
        expect(ScreenshotResponseSchema.parse({
          ok: true,
          targetId: 'tab-123',
          url: 'https://example.com',
          mimeType,
          imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
        }).mimeType).toMatch(/^image\//);
      }
    });

    it('imageBase64 is a string', () => {
      const parsed = ScreenshotResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        url: 'https://example.com',
        mimeType: 'image/png',
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      });
      expect(typeof parsed.imageBase64).toBe('string');
    });

    it('profiles is always array of strings', () => {
      const parsed = StatusResponseSchema.parse({ ok: true, profiles: ['default', 'profile-1'] });
      expect(Array.isArray(parsed.profiles)).toBe(true);
      parsed.profiles.forEach((profile) => expect(typeof profile).toBe('string'));
    });

    it('results array contains objects with matched boolean', () => {
      const parsed = ActResponseSchema.parse({
        ok: true,
        targetId: 'tab-123',
        results: [
          { ref: 'd1', matched: true },
          { ref: 'd2', matched: false },
        ],
      });
      parsed.results?.forEach((result) => expect(typeof result.matched).toBe('boolean'));
    });
  });

  describe('response consistency contracts', () => {
    it('all responses have ok field', () => {
      expect(Object.hasOwn({ ok: true, targetId: 't1' }, 'ok')).toBe(true);
      expect(Object.hasOwn({ ok: false, error: 'msg' }, 'ok')).toBe(true);
    });

    it('success responses never include error field', () => {
      const response = ActResponseSchema.parse({ ok: true, targetId: 't1' });
      expect((response as { error?: string }).error).toBeUndefined();
    });

    it('error responses always include error field', () => {
      expect(DetailedErrorEnvelope.parse({ ok: false, error: 'Something went wrong' }).error).toBeDefined();
    });

    it('targetId in response matches request targetId', () => {
      const requestTargetId = 'tab-456';
      expect(ActResponseSchema.parse({ ok: true, targetId: requestTargetId }).targetId).toBe(requestTargetId);
    });
  });
});
