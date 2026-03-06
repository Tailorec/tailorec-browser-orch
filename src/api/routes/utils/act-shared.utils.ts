/**
 * Action Route Shared Utilities
 * 
 * Shared logic for action route handlers (click, type, etc.).
 * Extracted from: src/browser/routes/agent.act.shared.ts
 */

/**
 * Action kind types
 */
export type ActKind =
  | 'click'
  | 'dblclick'
  | 'type'
  | 'press'
  | 'hover'
  | 'scroll'
  | 'drag'
  | 'select'
  | 'fill'
  | 'wait'
  | 'evaluate'
  | 'close'
  | 'resize'
  | 'file_upload'
  | 'dialog'
  | 'download'
  | 'screenshot';

/**
 * Check if value is a valid action kind
 */
export function isActKind(value: string): value is ActKind {
  const validKinds: string[] = [
    'click',
    'dblclick',
    'type',
    'press',
    'hover',
    'scroll',
    'drag',
    'select',
    'fill',
    'wait',
    'evaluate',
    'close',
    'resize',
    'file_upload',
    'dialog',
    'download',
    'screenshot',
  ];
  return validKinds.includes(value);
}

/**
 * Parse click button from string
 */
export function parseClickButton(value: string | undefined): 'left' | 'right' | 'middle' {
  const normalized = (value || 'left').toLowerCase();
  if (normalized === 'left' || normalized === 'main') return 'left';
  if (normalized === 'right' || normalized === 'secondary') return 'right';
  if (normalized === 'middle' || normalized === 'auxiliary') return 'middle';
  return 'left';
}

/**
 * Parse click modifiers from array
 */
export function parseClickModifiers(
  values: string[] | undefined,
): Array<'Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift'> {
  if (!Array.isArray(values)) return [];

  const validModifiers = new Set(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift']);
  return values
    .map((v) => {
      const normalized = String(v);
      // Normalize common variations
      if (normalized.toLowerCase() === 'ctrl') return 'Control';
      if (normalized.toLowerCase() === 'cmd' || normalized.toLowerCase() === 'command')
        return 'Meta';
      return normalized;
    })
    .filter((v): v is typeof validModifiers extends Set<infer T> ? T : never =>
      validModifiers.has(v as any),
    ) as Array<'Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift'>;
}

/**
 * Parse wait options
 */
export function parseWaitOptions(body: any): {
  timeMs?: number;
  text?: string;
  textGone?: string;
  selector?: string;
  url?: string;
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
  fn?: string;
} {
  const result: any = {};

  if (body.timeMs !== undefined) {
    result.timeMs = Math.max(0, Math.min(60000, Number(body.timeMs) || 0));
  }

  if (body.text) result.text = String(body.text);
  if (body.textGone) result.textGone = String(body.textGone);
  if (body.selector) result.selector = String(body.selector);
  if (body.url) result.url = String(body.url);

  if (body.loadState) {
    const valid = ['load', 'domcontentloaded', 'networkidle'];
    if (valid.includes(body.loadState)) {
      result.loadState = body.loadState;
    }
  }

  if (body.fn) result.fn = String(body.fn);

  return result;
}

/**
 * Parse fill fields from request body
 */
export function parseFillFields(body: any): Array<{
  ref: string;
  type: string;
  value?: string | number | boolean;
}> {
  if (!Array.isArray(body.fields)) return [];

  return body.fields
    .filter((f: any) => f && typeof f === 'object' && f.ref)
    .map((f: any) => ({
      ref: String(f.ref),
      type: String(f.type || 'text'),
      value: f.value !== undefined ? parseFieldValue(f.value) : undefined,
    }));
}

/**
 * Parse field value to appropriate type
 */
function parseFieldValue(value: any): string | number | boolean {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
}
