import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ActionRequestSchema,
  DialogRequestSchema,
  DownloadRequestSchema,
  DownloadWaitRequestSchema,
  FileChooserRequestSchema,
} from '../../../api/validators/action.validator.js';

const SnapshotRequestSchema = z.object({
  targetId: z.string().optional(),
  timeoutMs: z.preprocess((value) => (value === '' || value == null ? undefined : Number(value)), z.number().finite().optional()),
  maxChars: z.preprocess((value) => (value === '' || value == null ? undefined : Number(value)), z.number().finite().optional()),
  interactiveOnly: z.boolean().optional(),
  compact: z.boolean().optional(),
  maxDepth: z.preprocess((value) => (value === '' || value == null ? undefined : Number(value)), z.number().finite().optional()),
});

const SnapshotDeltaRequestSchema = z.object({
  targetId: z.string().optional(),
  action: z.enum(['start', 'stop']),
  anchorRef: z.string().optional(),
});

const ScreenshotRequestSchema = z
  .object({
    targetId: z.string().optional(),
    type: z.enum(['png', 'jpeg', 'jpg']).optional(),
    ref: z.string().optional(),
    element: z.string().optional(),
    fullPage: z.boolean().optional(),
    quality: z.number().int().min(0).max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.ref && value.element) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ref and element are mutually exclusive' });
    }
    if ((value.ref || value.element) && value.fullPage) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fullPage is only allowed for full-page screenshots' });
    }
    if (value.quality !== undefined && value.type !== 'jpeg') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'quality is only allowed for jpeg screenshots' });
    }
  });

const ScreenshotLabeledRequestSchema = z.object({
  targetId: z.string().optional(),
  refs: z.record(
    z.string(),
    z.object({
      role: z.string().min(1),
      name: z.string().optional(),
      nth: z.number().optional(),
    }),
  ).refine((value) => Object.keys(value).length > 0, 'refs must not be empty'),
  type: z.enum(['png', 'jpeg', 'jpg']).optional(),
  maxLabels: z.number().int().positive().optional(),
});

const ControlRequestSchema = z.object({
  token: z.string().min(1),
  targetId: z.string().optional(),
});

function expectActionSuccess(input: unknown, expected?: Partial<z.infer<typeof ActionRequestSchema>>) {
  const parsed = ActionRequestSchema.parse(input);
  if (expected) {
    expect(parsed).toMatchObject(expected);
  }
  return parsed;
}

function expectActionFailure(input: unknown) {
  expect(() => ActionRequestSchema.parse(input)).toThrow();
}

describe('request schemas contract', () => {
  describe('ActionRequest schema contracts', () => {
    describe('click action request', () => {
      it('valid click request with minimal fields', () => {
        expectActionSuccess({ kind: 'click', ref: 'd1' }, { kind: 'click', ref: 'd1', doubleClick: false });
      });

      for (const button of ['left', 'right', 'middle'] as const) {
        it(`click accepts ${button} button`, () => {
          expectActionSuccess({ kind: 'click', ref: 'd1', button }, { button });
        });
      }

      for (const modifier of ['Alt', 'Control', 'Shift', 'Meta', 'ControlOrMeta'] as const) {
        it(`click accepts ${modifier} modifier`, () => {
          expectActionSuccess({ kind: 'click', ref: 'd1', modifiers: [modifier] }, { modifiers: [modifier] });
        });
      }

      it('click accepts multiple modifiers', () => {
        expectActionSuccess(
          { kind: 'click', ref: 'd1', modifiers: ['Alt', 'Shift', 'Meta'] },
          { modifiers: ['Alt', 'Shift', 'Meta'] },
        );
      });

      it('click accepts doubleClick option', () => {
        expectActionSuccess({ kind: 'click', ref: 'd1', doubleClick: true }, { doubleClick: true });
      });

      it('click coerces timeoutMs from string', () => {
        expectActionSuccess({ kind: 'click', ref: 'd1', timeoutMs: '5000' }, { timeoutMs: 5000 });
      });

      it('click accepts targetId', () => {
        expectActionSuccess({ kind: 'click', ref: 'd1', targetId: 'tab-123' }, { targetId: 'tab-123' });
      });

      it('click missing ref is invalid', () => {
        expectActionFailure({ kind: 'click' });
      });

      it('click with invalid button is invalid', () => {
        expectActionFailure({ kind: 'click', ref: 'd1', button: 'invalid' });
      });

      it('click with invalid modifier is invalid', () => {
        expectActionFailure({ kind: 'click', ref: 'd1', modifiers: ['InvalidModifier'] });
      });
    });

    describe('type action request', () => {
      it('valid type request with minimal fields', () => {
        expectActionSuccess({ kind: 'type', ref: 'd1', text: 'Hello World' }, { submit: false, slowly: false });
      });

      it('type accepts submit option', () => {
        expectActionSuccess({ kind: 'type', ref: 'd1', text: 'Hello', submit: true }, { submit: true });
      });

      it('type accepts slowly option', () => {
        expectActionSuccess({ kind: 'type', ref: 'd1', text: 'Hello', slowly: true }, { slowly: true });
      });

      it('type coerces timeoutMs', () => {
        expectActionSuccess({ kind: 'type', ref: 'd1', text: 'Hello', timeoutMs: '3000' }, { timeoutMs: 3000 });
      });

      it('type missing ref is invalid', () => {
        expectActionFailure({ kind: 'type', text: 'Hello' });
      });

      it('type missing text is invalid', () => {
        expectActionFailure({ kind: 'type', ref: 'd1' });
      });
    });

    describe('press action request', () => {
      it('valid press request with minimal fields', () => {
        expectActionSuccess({ kind: 'press', key: 'Enter' }, { key: 'Enter' });
      });

      for (const key of ['Enter', 'Tab', 'Control+C', 'Alt+Tab', 'Meta+S', 'ArrowDown', 'F12']) {
        it(`press accepts ${key}`, () => {
          expectActionSuccess({ kind: 'press', key }, { key });
        });
      }

      it('press accepts delayMs', () => {
        expectActionSuccess({ kind: 'press', key: 'Enter', delayMs: 100 }, { delayMs: 100 });
      });

      it('press missing key is invalid', () => {
        expectActionFailure({ kind: 'press' });
      });
    });

    describe('hover action request', () => {
      it('valid hover request with minimal fields', () => {
        expectActionSuccess({ kind: 'hover', ref: 'd1' }, { ref: 'd1' });
      });

      it('hover accepts timeoutMs', () => {
        expectActionSuccess({ kind: 'hover', ref: 'd1', timeoutMs: 2000 }, { timeoutMs: 2000 });
      });

      it('hover missing ref is invalid', () => {
        expectActionFailure({ kind: 'hover' });
      });
    });

    describe('fill action request', () => {
      it('valid fill request with minimal fields', () => {
        const parsed = expectActionSuccess({
          kind: 'fill',
          fields: [{ ref: 'd1', type: 'text', value: 'John' }],
        });
        expect(parsed.fields).toHaveLength(1);
      });

      it('fill accepts multiple fields', () => {
        const parsed = expectActionSuccess({
          kind: 'fill',
          fields: [
            { ref: 'd1', type: 'text', value: 'John' },
            { ref: 'd2', type: 'email', value: 'john@example.com' },
            { ref: 'd3', type: 'password', value: 'secret' },
          ],
        });
        expect(parsed.fields).toHaveLength(3);
      });

      it('fill accepts mixed field value types', () => {
        const parsed = expectActionSuccess({
          kind: 'fill',
          fields: [
            { ref: 'd1', type: 'text', value: 'John' },
            { ref: 'd2', type: 'checkbox', value: true },
            { ref: 'd3', type: 'number', value: 42 },
          ],
        });
        expect(parsed.fields).toHaveLength(3);
      });

      it('fill accepts timeoutMs', () => {
        expectActionSuccess(
          { kind: 'fill', fields: [{ ref: 'd1', type: 'text', value: 'Test' }], timeoutMs: 5000 },
          { timeoutMs: 5000 },
        );
      });

      it('fill missing fields is invalid', () => {
        expectActionFailure({ kind: 'fill' });
      });

      it('fill with empty fields is accepted by current schema', () => {
        const parsed = expectActionSuccess({ kind: 'fill', fields: [] });
        expect(parsed.fields).toHaveLength(0);
      });

      it('fill field missing ref is invalid', () => {
        expectActionFailure({ kind: 'fill', fields: [{ type: 'text', value: 'Test' }] });
      });

      it('fill field missing type is invalid', () => {
        expectActionFailure({ kind: 'fill', fields: [{ ref: 'd1', value: 'Test' }] });
      });
    });

    describe('scrollIntoView action request', () => {
      it('valid scrollIntoView request with minimal fields', () => {
        expectActionSuccess({ kind: 'scrollIntoView', ref: 'd1' }, { ref: 'd1' });
      });

      it('scrollIntoView accepts timeoutMs', () => {
        expectActionSuccess({ kind: 'scrollIntoView', ref: 'd1', timeoutMs: 3000 }, { timeoutMs: 3000 });
      });

      it('scrollIntoView missing ref is invalid', () => {
        expectActionFailure({ kind: 'scrollIntoView' });
      });
    });

    describe('drag action request', () => {
      it('valid drag request with minimal fields', () => {
        expectActionSuccess({ kind: 'drag', startRef: 'd1', endRef: 'd2' }, { startRef: 'd1', endRef: 'd2' });
      });

      it('drag accepts timeoutMs', () => {
        expectActionSuccess({ kind: 'drag', startRef: 'd1', endRef: 'd2', timeoutMs: 5000 }, { timeoutMs: 5000 });
      });

      it('drag missing startRef is invalid', () => {
        expectActionFailure({ kind: 'drag', endRef: 'd2' });
      });

      it('drag missing endRef is invalid', () => {
        expectActionFailure({ kind: 'drag', startRef: 'd1' });
      });
    });

    describe('select action request', () => {
      it('valid select request with minimal fields', () => {
        const parsed = expectActionSuccess({ kind: 'select', ref: 'd1', values: ['option1'] });
        expect(parsed.values).toHaveLength(1);
      });

      it('select accepts multiple values', () => {
        const parsed = expectActionSuccess({ kind: 'select', ref: 'd1', values: ['option1', 'option2', 'option3'] });
        expect(parsed.values).toHaveLength(3);
      });

      it('select accepts timeoutMs', () => {
        expectActionSuccess({ kind: 'select', ref: 'd1', values: ['option1'], timeoutMs: 3000 }, { timeoutMs: 3000 });
      });

      it('select missing ref is invalid', () => {
        expectActionFailure({ kind: 'select', values: ['option1'] });
      });

      it('select missing values is invalid', () => {
        expectActionFailure({ kind: 'select', ref: 'd1' });
      });

      it('select with empty values is accepted by current schema', () => {
        const parsed = expectActionSuccess({ kind: 'select', ref: 'd1', values: [] });
        expect(parsed.values).toHaveLength(0);
      });
    });

    describe('resize action request', () => {
      it('valid resize request with minimal fields', () => {
        expectActionSuccess({ kind: 'resize', width: 1920, height: 1080 }, { width: 1920, height: 1080 });
      });

      it('resize accepts custom viewport', () => {
        expectActionSuccess({ kind: 'resize', width: 1280, height: 720 }, { width: 1280, height: 720 });
      });

      it('resize coerces width and height', () => {
        expectActionSuccess({ kind: 'resize', width: '1280', height: '720' }, { width: 1280, height: 720 });
      });

      it('resize missing width is invalid', () => {
        expectActionFailure({ kind: 'resize', height: 1080 });
      });

      it('resize missing height is invalid', () => {
        expectActionFailure({ kind: 'resize', width: 1920 });
      });
    });

    describe('wait action request', () => {
      it('valid wait request with timeMs', () => {
        expectActionSuccess({ kind: 'wait', timeMs: 1000 }, { timeMs: 1000 });
      });

      it('wait accepts text condition', () => {
        expectActionSuccess({ kind: 'wait', text: 'Loading...' }, { text: 'Loading...' });
      });

      it('wait accepts textGone condition', () => {
        expectActionSuccess({ kind: 'wait', textGone: 'Loading...' }, { textGone: 'Loading...' });
      });

      it('wait accepts selector condition', () => {
        expectActionSuccess({ kind: 'wait', selector: '.loaded' }, { selector: '.loaded' });
      });

      it('wait accepts url condition', () => {
        expectActionSuccess({ kind: 'wait', url: 'https://example.com' }, { url: 'https://example.com' });
      });

      for (const loadState of ['load', 'domcontentloaded', 'networkidle']) {
        it(`wait accepts loadState ${loadState}`, () => {
          expectActionSuccess({ kind: 'wait', loadState }, { loadState });
        });
      }

      it('wait accepts fn condition', () => {
        expectActionSuccess(
          { kind: 'wait', fn: "() => document.readyState === 'complete'" },
          { fn: "() => document.readyState === 'complete'" },
        );
      });

      it('wait accepts timeoutMs', () => {
        expectActionSuccess({ kind: 'wait', timeMs: 1000, timeoutMs: 5000 }, { timeoutMs: 5000 });
      });

      it('wait accepts targetId', () => {
        expectActionSuccess({ kind: 'wait', timeMs: 1000, targetId: 'tab-123' }, { targetId: 'tab-123' });
      });

      it('wait with no conditions is accepted by current schema', () => {
        expectActionSuccess({ kind: 'wait' }, { kind: 'wait' });
      });
    });

    describe('evaluate action request', () => {
      it('valid evaluate request with minimal fields', () => {
        expectActionSuccess({ kind: 'evaluate', fn: '() => document.title' }, { fn: '() => document.title' });
      });

      it('evaluate accepts ref', () => {
        expectActionSuccess({ kind: 'evaluate', fn: '() => this.textContent', ref: 'd1' }, { ref: 'd1' });
      });

      it('evaluate accepts targetId', () => {
        expectActionSuccess({ kind: 'evaluate', fn: '() => 1', targetId: 'tab-123' }, { targetId: 'tab-123' });
      });

      it('evaluate missing fn is invalid', () => {
        expectActionFailure({ kind: 'evaluate' });
      });
    });

    describe('navigate action request', () => {
      it('valid navigate request with minimal fields', () => {
        expectActionSuccess({ kind: 'navigate', url: 'https://example.com' }, { url: 'https://example.com' });
      });

      it('navigate accepts timeoutMs', () => {
        expectActionSuccess({ kind: 'navigate', url: 'https://example.com', timeoutMs: 30000 }, { timeoutMs: 30000 });
      });

      it('navigate accepts targetId', () => {
        expectActionSuccess({ kind: 'navigate', url: 'https://example.com', targetId: 'tab-123' }, { targetId: 'tab-123' });
      });

      it('navigate missing url is invalid', () => {
        expectActionFailure({ kind: 'navigate' });
      });
    });

    describe('close action request', () => {
      it('valid close request', () => {
        expectActionSuccess({ kind: 'close' }, { kind: 'close' });
      });

      it('close accepts targetId', () => {
        expectActionSuccess({ kind: 'close', targetId: 'tab-123' }, { targetId: 'tab-123' });
      });
    });

    describe('discover_dropdown action request', () => {
      it('valid discover_dropdown request with minimal fields', () => {
        expectActionSuccess({ kind: 'discover_dropdown', ref: 'd1' }, { ref: 'd1' });
      });

      it('discover_dropdown accepts searchText', () => {
        expectActionSuccess({ kind: 'discover_dropdown', ref: 'd1', searchText: 'Option' }, { searchText: 'Option' });
      });

      it('discover_dropdown accepts timeoutMs', () => {
        expectActionSuccess({ kind: 'discover_dropdown', ref: 'd1', timeoutMs: 3000 }, { timeoutMs: 3000 });
      });

      it('discover_dropdown missing ref is invalid', () => {
        expectActionFailure({ kind: 'discover_dropdown' });
      });
    });

    describe('close_dropdown action request', () => {
      it('valid close_dropdown request with minimal fields', () => {
        expectActionSuccess({ kind: 'close_dropdown', ref: 'd1' }, { ref: 'd1' });
      });

      it('close_dropdown missing ref is invalid', () => {
        expectActionFailure({ kind: 'close_dropdown' });
      });
    });

    describe('query_state action request', () => {
      it('valid query_state request with ref', () => {
        expectActionSuccess({ kind: 'query_state', ref: 'd1' }, { ref: 'd1' });
      });

      it('query_state accepts refs array', () => {
        const parsed = expectActionSuccess({ kind: 'query_state', refs: ['d1', 'd2', 'd3'] });
        expect(parsed.refs).toEqual(['d1', 'd2', 'd3']);
      });

      it('query_state accepts targetId', () => {
        expectActionSuccess({ kind: 'query_state', ref: 'd1', targetId: 'tab-123' }, { targetId: 'tab-123' });
      });

      it('query_state missing ref and refs is accepted by current schema', () => {
        expectActionSuccess({ kind: 'query_state' }, { kind: 'query_state' });
      });
    });

    describe('detect_blocker action request', () => {
      it('valid detect_blocker request with minimal fields', () => {
        expectActionSuccess({ kind: 'detect_blocker', ref: 'd1' }, { ref: 'd1' });
      });

      it('detect_blocker missing ref is invalid', () => {
        expectActionFailure({ kind: 'detect_blocker' });
      });
    });

    describe('dismiss_blocker action request', () => {
      it('valid dismiss_blocker request with minimal fields', () => {
        expectActionSuccess({ kind: 'dismiss_blocker', targetRef: 'd1' }, { targetRef: 'd1' });
      });

      it('dismiss_blocker accepts strategy', () => {
        expectActionSuccess({ kind: 'dismiss_blocker', targetRef: 'd1', strategy: 'click' }, { strategy: 'click' });
      });

      it('dismiss_blocker accepts closeButtonRef', () => {
        expectActionSuccess({ kind: 'dismiss_blocker', targetRef: 'd1', closeButtonRef: 'd2' }, { closeButtonRef: 'd2' });
      });

      it('dismiss_blocker missing targetRef is invalid', () => {
        expectActionFailure({ kind: 'dismiss_blocker' });
      });
    });

    describe('common action request fields', () => {
      for (const action of [
        { kind: 'click', ref: 'd1', targetId: 'tab-1' },
        { kind: 'type', ref: 'd1', text: 'test', targetId: 'tab-1' },
        { kind: 'press', key: 'Enter', targetId: 'tab-1' },
        { kind: 'wait', timeMs: 1000, targetId: 'tab-1' },
      ] as const) {
        it(`supports targetId for ${action.kind}`, () => {
          expectActionSuccess(action, { targetId: 'tab-1' });
        });
      }
    });
  });

  describe('SnapshotRequest schema contracts', () => {
    it('valid snapshot request with minimal fields', () => {
      expect(SnapshotRequestSchema.parse({})).toEqual({});
    });

    it('snapshot accepts targetId', () => {
      expect(SnapshotRequestSchema.parse({ targetId: 'tab-123' })).toEqual({ targetId: 'tab-123' });
    });

    it('snapshot coerces timeoutMs', () => {
      expect(SnapshotRequestSchema.parse({ timeoutMs: '5000' }).timeoutMs).toBe(5000);
    });

    it('snapshot coerces maxChars', () => {
      expect(SnapshotRequestSchema.parse({ maxChars: '10000' }).maxChars).toBe(10000);
    });

    it('snapshot accepts interactiveOnly', () => {
      expect(SnapshotRequestSchema.parse({ interactiveOnly: true }).interactiveOnly).toBe(true);
    });

    it('snapshot accepts compact', () => {
      expect(SnapshotRequestSchema.parse({ compact: true }).compact).toBe(true);
    });

    it('snapshot coerces maxDepth', () => {
      expect(SnapshotRequestSchema.parse({ maxDepth: '10' }).maxDepth).toBe(10);
    });

    it('snapshot accepts all options', () => {
      expect(
        SnapshotRequestSchema.parse({
          targetId: 'tab-123',
          timeoutMs: 5000,
          maxChars: 10000,
          interactiveOnly: true,
          compact: true,
          maxDepth: 10,
        }),
      ).toEqual({
        targetId: 'tab-123',
        timeoutMs: 5000,
        maxChars: 10000,
        interactiveOnly: true,
        compact: true,
        maxDepth: 10,
      });
    });
  });

  describe('SnapshotDeltaRequest schema contracts', () => {
    it('valid snapshot delta start request', () => {
      expect(SnapshotDeltaRequestSchema.parse({ action: 'start' }).action).toBe('start');
    });

    it('valid snapshot delta stop request', () => {
      expect(SnapshotDeltaRequestSchema.parse({ action: 'stop' }).action).toBe('stop');
    });

    it('snapshot delta accepts targetId', () => {
      expect(SnapshotDeltaRequestSchema.parse({ action: 'start', targetId: 'tab-123' }).targetId).toBe('tab-123');
    });

    it('snapshot delta accepts anchorRef', () => {
      expect(SnapshotDeltaRequestSchema.parse({ action: 'start', anchorRef: 'd1' }).anchorRef).toBe('d1');
    });

    it('snapshot delta with invalid action is invalid', () => {
      expect(() => SnapshotDeltaRequestSchema.parse({ action: 'invalid' })).toThrow();
    });
  });

  describe('ScreenshotRequest schema contracts', () => {
    it('valid screenshot request with minimal fields', () => {
      expect(ScreenshotRequestSchema.parse({})).toEqual({});
    });

    it('screenshot accepts targetId', () => {
      expect(ScreenshotRequestSchema.parse({ targetId: 'tab-123' }).targetId).toBe('tab-123');
    });

    for (const type of ['png', 'jpeg', 'jpg'] as const) {
      it(`screenshot accepts type ${type}`, () => {
        expect(ScreenshotRequestSchema.parse({ type }).type).toBe(type);
      });
    }

    it('screenshot accepts ref', () => {
      expect(ScreenshotRequestSchema.parse({ ref: 'd1' }).ref).toBe('d1');
    });

    it('screenshot accepts element selector', () => {
      expect(ScreenshotRequestSchema.parse({ element: '.my-element' }).element).toBe('.my-element');
    });

    it('screenshot accepts fullPage', () => {
      expect(ScreenshotRequestSchema.parse({ fullPage: true }).fullPage).toBe(true);
    });

    it('screenshot accepts all options', () => {
      expect(
        ScreenshotRequestSchema.parse({
          targetId: 'tab-123',
          type: 'jpeg',
          ref: 'd1',
          fullPage: false,
        }),
      ).toEqual({
        targetId: 'tab-123',
        type: 'jpeg',
        ref: 'd1',
        fullPage: false,
      });
    });

    it('screenshot with both ref and element is invalid', () => {
      expect(() => ScreenshotRequestSchema.parse({ ref: 'd1', element: '.my-element' })).toThrow();
    });

    it('screenshot with ref and fullPage is invalid', () => {
      expect(() => ScreenshotRequestSchema.parse({ ref: 'd1', fullPage: true })).toThrow();
    });

    it('screenshot rejects quality for png', () => {
      expect(() => ScreenshotRequestSchema.parse({ type: 'png', quality: 80 })).toThrow();
    });
  });

  describe('ScreenshotLabeledRequest schema contracts', () => {
    it('valid labeled screenshot request with minimal refs', () => {
      expect(ScreenshotLabeledRequestSchema.parse({ refs: { button1: { role: 'button' } } }).refs).toEqual({
        button1: { role: 'button' },
      });
    });

    it('labeled screenshot accepts multiple refs', () => {
      const parsed = ScreenshotLabeledRequestSchema.parse({
        refs: {
          button1: { role: 'button' },
          input1: { role: 'textbox' },
          link1: { role: 'link' },
        },
      });
      expect(Object.keys(parsed.refs)).toHaveLength(3);
    });

    it('labeled screenshot accepts name option', () => {
      expect(
        ScreenshotLabeledRequestSchema.parse({ refs: { submit: { role: 'button', name: 'Submit' } } }).refs.submit,
      ).toEqual({ role: 'button', name: 'Submit' });
    });

    it('labeled screenshot accepts nth option', () => {
      expect(
        ScreenshotLabeledRequestSchema.parse({ refs: { item: { role: 'listitem', nth: 2 } } }).refs.item,
      ).toEqual({ role: 'listitem', nth: 2 });
    });

    it('labeled screenshot accepts all options', () => {
      expect(
        ScreenshotLabeledRequestSchema.parse({
          refs: { submit: { role: 'button', name: 'Submit', nth: 0 } },
          type: 'png',
          maxLabels: 50,
        }),
      ).toEqual({
        refs: { submit: { role: 'button', name: 'Submit', nth: 0 } },
        type: 'png',
        maxLabels: 50,
      });
    });

    it('labeled screenshot missing refs is invalid', () => {
      expect(() => ScreenshotLabeledRequestSchema.parse({})).toThrow();
    });

    it('labeled screenshot with empty refs is invalid', () => {
      expect(() => ScreenshotLabeledRequestSchema.parse({ refs: {} })).toThrow();
    });

    it('labeled screenshot ref missing role is invalid', () => {
      expect(() => ScreenshotLabeledRequestSchema.parse({ refs: { button1: { name: 'Submit' } } })).toThrow();
    });
  });

  describe('hook and control request schemas', () => {
    it('valid file chooser request with minimal fields', () => {
      expect(FileChooserRequestSchema.parse({ paths: ['/path/to/file.txt'] }).paths).toEqual(['/path/to/file.txt']);
    });

    it('file chooser accepts targetId', () => {
      expect(FileChooserRequestSchema.parse({ targetId: 'tab-123', paths: ['/path/to/file.txt'] }).targetId).toBe('tab-123');
    });

    it('file chooser accepts ref', () => {
      expect(FileChooserRequestSchema.parse({ ref: 'd1', paths: ['/path/to/file.txt'] }).ref).toBe('d1');
    });

    it('file chooser accepts inputRef', () => {
      expect(FileChooserRequestSchema.parse({ inputRef: 'd1', paths: ['/path/to/file.txt'] }).inputRef).toBe('d1');
    });

    it('file chooser accepts element selector', () => {
      expect(FileChooserRequestSchema.parse({ element: 'input[type=file]', paths: ['/path/to/file.txt'] }).element).toBe('input[type=file]');
    });

    it('file chooser accepts multiple paths', () => {
      expect(FileChooserRequestSchema.parse({ paths: ['/path/to/file1.txt', '/path/to/file2.txt'] }).paths).toHaveLength(2);
    });

    it('file chooser accepts timeoutMs', () => {
      expect(FileChooserRequestSchema.parse({ paths: ['/path/to/file.txt'], timeoutMs: 30000 }).timeoutMs).toBe(30000);
    });

    it('file chooser accepts HTTPS URL path', () => {
      expect(FileChooserRequestSchema.parse({ paths: ['https://example.com/file.txt'] }).paths).toEqual(['https://example.com/file.txt']);
    });

    it('file chooser defaults missing paths to empty array', () => {
      expect(FileChooserRequestSchema.parse({}).paths).toEqual([]);
    });

    it('file chooser with empty paths is accepted by current schema', () => {
      expect(FileChooserRequestSchema.parse({ paths: [] }).paths).toHaveLength(0);
    });

    it('file chooser allows ref and inputRef at schema level', () => {
      const parsed = FileChooserRequestSchema.parse({
        ref: 'd1',
        inputRef: 'd2',
        paths: ['/path/to/file.txt'],
      });
      expect(parsed.ref).toBe('d1');
      expect(parsed.inputRef).toBe('d2');
    });

    it('file chooser allows ref and element at schema level', () => {
      const parsed = FileChooserRequestSchema.parse({
        ref: 'd1',
        element: 'input[type=file]',
        paths: ['/path/to/file.txt'],
      });
      expect(parsed.ref).toBe('d1');
      expect(parsed.element).toBe('input[type=file]');
    });

    it('valid dialog request with accept true', () => {
      expect(DialogRequestSchema.parse({ accept: true }).accept).toBe(true);
    });

    it('valid dialog request with accept false', () => {
      expect(DialogRequestSchema.parse({ accept: false }).accept).toBe(false);
    });

    it('dialog accepts targetId', () => {
      expect(DialogRequestSchema.parse({ targetId: 'tab-123', accept: true }).targetId).toBe('tab-123');
    });

    it('dialog accepts promptText', () => {
      expect(DialogRequestSchema.parse({ accept: true, promptText: 'Default text' }).promptText).toBe('Default text');
    });

    it('dialog accepts timeoutMs', () => {
      expect(DialogRequestSchema.parse({ accept: true, timeoutMs: 5000 }).timeoutMs).toBe(5000);
    });

    it('dialog missing accept is invalid', () => {
      expect(() => DialogRequestSchema.parse({})).toThrow();
    });

    it('valid download request with minimal fields', () => {
      const parsed = DownloadRequestSchema.parse({ ref: 'd1', path: '/path/to/download.pdf' });
      expect(parsed.ref).toBe('d1');
      expect(parsed.path).toBe('/path/to/download.pdf');
    });

    it('download accepts targetId', () => {
      expect(DownloadRequestSchema.parse({ targetId: 'tab-123', ref: 'd1', path: '/path/to/download.pdf' }).targetId).toBe('tab-123');
    });

    it('download accepts timeoutMs', () => {
      expect(DownloadRequestSchema.parse({ ref: 'd1', path: '/path/to/download.pdf', timeoutMs: 60000 }).timeoutMs).toBe(60000);
    });

    it('download missing ref is invalid', () => {
      expect(() => DownloadRequestSchema.parse({ path: '/path/to/download.pdf' })).toThrow();
    });

    it('download missing path is invalid', () => {
      expect(() => DownloadRequestSchema.parse({ ref: 'd1' })).toThrow();
    });

    it('valid wait/download request with minimal fields', () => {
      expect(DownloadWaitRequestSchema.parse({ path: '/path/to/download.pdf' }).path).toBe('/path/to/download.pdf');
    });

    it('wait/download accepts targetId', () => {
      expect(DownloadWaitRequestSchema.parse({ targetId: 'tab-123', path: '/path/to/download.pdf' }).targetId).toBe('tab-123');
    });

    it('wait/download accepts timeoutMs', () => {
      expect(DownloadWaitRequestSchema.parse({ path: '/path/to/download.pdf', timeoutMs: 60000 }).timeoutMs).toBe(60000);
    });

    it('wait/download missing path is accepted by current schema', () => {
      expect(DownloadWaitRequestSchema.parse({})).toEqual({});
    });

    it('valid control request with token', () => {
      expect(ControlRequestSchema.parse({ token: 'jwt.token.value' }).token).toBe('jwt.token.value');
    });

    it('control request with token and targetId', () => {
      expect(ControlRequestSchema.parse({ token: 'jwt.token.value', targetId: 'tab-123' }).targetId).toBe('tab-123');
    });

    it('control request missing token is invalid', () => {
      expect(() => ControlRequestSchema.parse({})).toThrow();
    });
  });

  describe('invalid request schema contracts', () => {
    it('act request with missing kind is invalid', () => {
      expectActionFailure({ ref: 'd1' });
    });

    it('act request with unknown kind is invalid', () => {
      expectActionFailure({ kind: 'unknown_action', ref: 'd1' });
    });

    it('act request with null body is invalid', () => {
      expectActionFailure(null);
    });

    it('act request with empty object is invalid', () => {
      expectActionFailure({});
    });

    it('act request with wrong type for kind is invalid', () => {
      expectActionFailure({ kind: 123, ref: 'd1' });
    });

    it('act request with wrong type for ref is invalid', () => {
      expectActionFailure({ kind: 'click', ref: 123 });
    });

    it('snapshot request with wrong type for timeoutMs is invalid', () => {
      expect(() => SnapshotRequestSchema.parse({ timeoutMs: 'not-a-number' })).toThrow();
    });
  });
});
