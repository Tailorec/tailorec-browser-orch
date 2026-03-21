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

export class ActionCompatController {
  constructor(
    private simpleController: SimpleActionController,
    private formController: FormActionController,
    private advancedController: AdvancedActionController,
    private evaluateEnabled: boolean,
  ) {}

  async handleAct(req: Request, res: Response): Promise<void> {
    const kind = typeof req.body?.kind === 'string' ? req.body.kind : '';
    if (!ACT_KINDS.has(kind)) {
      sendErrorResponse(res, 400, 'kind is required');
      return;
    }
    if (req.body && Object.hasOwn(req.body, 'selector') && kind !== 'wait') {
      sendErrorResponse(res, 400, SELECTOR_UNSUPPORTED_MESSAGE);
      return;
    }

    switch (kind) {
      case 'click':
        return this.simpleController.handleClick(req, res);
      case 'type':
        return this.simpleController.handleType(req, res);
      case 'press':
        return this.simpleController.handlePress(req, res);
      case 'hover':
        return this.simpleController.handleHover(req, res);
      case 'navigate':
        return this.simpleController.handleNavigate(req, res);
      case 'fill':
        return this.formController.handleFill(req, res);
      case 'select':
        return this.formController.handleSelect(req, res);
      case 'drag':
        return this.formController.handleDrag(req, res);
      case 'resize':
        return this.formController.handleResize(req, res);
      case 'wait':
        if (req.body?.fn && !this.evaluateEnabled) {
          sendErrorResponse(
            res,
            403,
            'wait --fn is disabled by config (browser.evaluateEnabled=false).\nDocs: /gateway/configuration#browser-openclaw-managed-browser',
          );
          return;
        }
        return this.formController.handleWait(req, res);
      case 'evaluate':
        return this.advancedController.handleEvaluate(req, res);
      case 'close':
        return this.advancedController.handleClose(req, res);
      case 'query_state':
        return this.advancedController.handleQueryState(req, res);
      case 'scrollIntoView':
        return this.advancedController.handleScrollIntoView(req, res);
      case 'discover_dropdown':
        return this.advancedController.handleDiscoverDropdown(req, res);
      case 'close_dropdown':
        return this.advancedController.handleCloseDropdown(req, res);
      case 'detect_blocker':
        return this.advancedController.handleDetectBlocker(req, res);
      case 'dismiss_blocker':
        return this.advancedController.handleDismissBlocker(req, res);
      default:
        sendErrorResponse(res, 400, 'kind is required');
    }
  }
}
