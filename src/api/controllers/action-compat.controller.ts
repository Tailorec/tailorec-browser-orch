import type { Request, Response } from 'express';
import { sendErrorResponse } from './controller-runtime.utils.js';
import type { SimpleActionController } from './simple-action.controller.js';
import type { FormActionController } from './form-action.controller.js';
import type { AdvancedActionController } from './advanced-action.controller.js';
import type { HooksController } from './hooks.controller.js';
import type { MediaController } from './media.controller.js';

export class ActionCompatController {
  constructor(
    private simpleController: SimpleActionController,
    private formController: FormActionController,
    private advancedController: AdvancedActionController,
    private hooksController: HooksController,
    private mediaController: MediaController,
    private evaluateEnabled: boolean,
  ) {}

  async handleAct(req: Request, res: Response): Promise<void> {
    const kind = typeof req.body?.kind === 'string' ? req.body.kind : '';
    if (req.body && Object.hasOwn(req.body, 'selector') && kind !== 'wait') {
      sendErrorResponse(
        res,
        400,
        'CSS selectors are not supported. Use role-based refs (e.g., e1, e2) from snapshots.',
      );
      return;
    }

    switch (kind) {
      case 'click':
      case 'dblclick':
        if (kind === 'dblclick') {
          req.body.doubleClick = true;
        }
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
      case 'scroll':
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
      case 'file_upload':
        return this.hooksController.handleFileChooser(req, res);
      case 'dialog':
        return this.hooksController.handleDialog(req, res);
      case 'download':
        return this.hooksController.handleDownload(req, res);
      case 'screenshot':
        return this.mediaController.handleScreenshot(req, res);
      default:
        sendErrorResponse(res, 400, kind ? 'unsupported kind' : 'kind is required');
    }
  }
}
