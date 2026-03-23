import type { Request, Response } from 'express';
import { sendErrorResponse } from './controller-runtime.utils.js';
import type { SimpleActionController } from './simple-action.controller.js';
import type { FormActionController } from './form-action.controller.js';
import type { AdvancedActionController } from './advanced-action.controller.js';

const ACT_KINDS = new Set<string>([
  'click',
  'close',
  'drag',
  'evaluate',
  'fill',
  'hover',
  'scrollIntoView',
  'press',
  'resize',
  'select',
  'type',
  'wait',
  'navigate',
  'discover_dropdown',
  'close_dropdown',
  'query_state',
  'detect_blocker',
  'dismiss_blocker',
]);

const SELECTOR_UNSUPPORTED_MESSAGE = [
  "Error: 'selector' is not supported. Use 'ref' from snapshot instead.",
  '',
  'Example workflow:',
  '1. snapshot action to get page state with refs',
  '2. act with ref: "e123" to interact with element',
  '',
  'This is more reliable for modern SPAs.',
].join('\n');

type ClickButton = 'left' | 'right' | 'middle';
type ClickModifier = 'Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift';

function toStringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => String(item));
}

function parseClickButton(raw: string): ClickButton | undefined {
  if (raw === 'left' || raw === 'right' || raw === 'middle') return raw;
  return undefined;
}

function parseClickModifiers(raw: string[]): { modifiers?: ClickModifier[]; error?: string } {
  const valid = new Set<ClickModifier>(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift']);
  const invalid = raw.filter((item) => !valid.has(item as ClickModifier));
  if (invalid.length) {
    return { error: 'modifiers must be Alt|Control|ControlOrMeta|Meta|Shift' };
  }
  return { modifiers: raw.length ? (raw as ClickModifier[]) : undefined };
}

export class ActionCompatController {
  constructor(
    private simpleController: SimpleActionController,
    private formController: FormActionController,
    private advancedController: AdvancedActionController,
    private evaluateEnabled: boolean,
  ) {}

  async handleAct(req: Request, res: Response): Promise<void> {
    const body = (req.body || {}) as Record<string, unknown>;
    const kind = typeof req.body?.kind === 'string' ? req.body.kind : '';
    if (!ACT_KINDS.has(kind)) {
      sendErrorResponse(res, 400, 'kind is required');
      return;
    }
    if (Object.hasOwn(body, 'selector') && kind !== 'wait') {
      sendErrorResponse(res, 400, SELECTOR_UNSUPPORTED_MESSAGE);
      return;
    }

    switch (kind) {
      case 'click':
        if (!toStringOrEmpty(body.ref)) {
          sendErrorResponse(res, 400, 'ref is required');
          return;
        }
        {
          const buttonRaw = toStringOrEmpty(body.button);
          if (buttonRaw && !parseClickButton(buttonRaw)) {
            sendErrorResponse(res, 400, 'button must be left|right|middle');
            return;
          }
          const modifiers = toStringArray(body.modifiers) ?? [];
          const parsedModifiers = parseClickModifiers(modifiers);
          if (parsedModifiers.error) {
            sendErrorResponse(res, 400, parsedModifiers.error);
            return;
          }
        }
        return this.simpleController.handleClick(req, res);
      case 'type':
        if (!toStringOrEmpty(body.ref)) {
          sendErrorResponse(res, 400, 'ref is required');
          return;
        }
        if (typeof body.text !== 'string') {
          sendErrorResponse(res, 400, 'text is required');
          return;
        }
        return this.simpleController.handleType(req, res);
      case 'press':
        if (!toStringOrEmpty(body.key)) {
          sendErrorResponse(res, 400, 'key is required');
          return;
        }
        return this.simpleController.handlePress(req, res);
      case 'hover':
        if (!toStringOrEmpty(body.ref)) {
          sendErrorResponse(res, 400, 'ref is required');
          return;
        }
        return this.simpleController.handleHover(req, res);
      case 'navigate':
        if (!toStringOrEmpty(body.url)) {
          sendErrorResponse(res, 400, 'url is required');
          return;
        }
        return this.simpleController.handleNavigate(req, res);
      case 'fill':
        {
          const rawFields = Array.isArray(body.fields) ? body.fields : [];
          const valid = rawFields
            .filter((field): field is Record<string, unknown> => !!field && typeof field === 'object')
            .filter((field) => toStringOrEmpty(field.ref) && toStringOrEmpty(field.type));
          if (!valid.length) {
            sendErrorResponse(res, 400, 'fields are required');
            return;
          }
        }
        return this.formController.handleFill(req, res);
      case 'select':
        {
          const ref = toStringOrEmpty(body.ref);
          const values = toStringArray(body.values);
          if (!ref || !values?.length) {
            sendErrorResponse(res, 400, 'ref and values are required');
            return;
          }
        }
        return this.formController.handleSelect(req, res);
      case 'drag':
        if (!toStringOrEmpty(body.startRef) || !toStringOrEmpty(body.endRef)) {
          sendErrorResponse(res, 400, 'startRef and endRef are required');
          return;
        }
        return this.formController.handleDrag(req, res);
      case 'resize':
        if (!toNumber(body.width) || !toNumber(body.height)) {
          sendErrorResponse(res, 400, 'width and height are required');
          return;
        }
        return this.formController.handleResize(req, res);
      case 'wait':
        if (toStringOrEmpty(body.fn) && !this.evaluateEnabled) {
          sendErrorResponse(
            res,
            403,
            'wait --fn is disabled by config (browser.evaluateEnabled=false).\nDocs: /gateway/configuration#browser-openclaw-managed-browser',
          );
          return;
        }
        if (
          toNumber(body.timeMs) === undefined &&
          !toStringOrEmpty(body.text) &&
          !toStringOrEmpty(body.textGone) &&
          !toStringOrEmpty(body.selector) &&
          !toStringOrEmpty(body.url) &&
          !toStringOrEmpty(body.loadState) &&
          !toStringOrEmpty(body.fn)
        ) {
          sendErrorResponse(
            res,
            400,
            'wait requires at least one of: timeMs, text, textGone, selector, url, loadState, fn',
          );
          return;
        }
        return this.formController.handleWait(req, res);
      case 'evaluate':
        if (!toStringOrEmpty(body.fn)) {
          sendErrorResponse(res, 400, 'fn is required');
          return;
        }
        return this.advancedController.handleEvaluate(req, res);
      case 'close':
        return this.advancedController.handleClose(req, res);
      case 'query_state':
        {
          const ref = toStringOrEmpty(body.ref);
          const refs = Array.isArray(body.refs) ? body.refs.map(String).filter(Boolean) : [];
          if (!ref && refs.length === 0) {
            sendErrorResponse(res, 400, 'ref or refs is required');
            return;
          }
        }
        return this.advancedController.handleQueryState(req, res);
      case 'scrollIntoView':
        if (!toStringOrEmpty(body.ref)) {
          sendErrorResponse(res, 400, 'ref is required');
          return;
        }
        return this.advancedController.handleScrollIntoView(req, res);
      case 'discover_dropdown':
        if (!toStringOrEmpty(body.ref)) {
          sendErrorResponse(res, 400, 'ref is required');
          return;
        }
        return this.advancedController.handleDiscoverDropdown(req, res);
      case 'close_dropdown':
        if (!toStringOrEmpty(body.ref)) {
          sendErrorResponse(res, 400, 'ref is required');
          return;
        }
        return this.advancedController.handleCloseDropdown(req, res);
      case 'detect_blocker':
        if (!toStringOrEmpty(body.ref)) {
          sendErrorResponse(res, 400, 'ref is required');
          return;
        }
        return this.advancedController.handleDetectBlocker(req, res);
      case 'dismiss_blocker':
        if (!toStringOrEmpty(body.targetRef)) {
          sendErrorResponse(res, 400, 'targetRef is required');
          return;
        }
        return this.advancedController.handleDismissBlocker(req, res);
      default:
        sendErrorResponse(res, 400, 'kind is required');
    }
  }
}
