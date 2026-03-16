import type { Router } from 'express';
import type { SimpleActionController } from '../controllers/simple-action.controller.js';
import type { FormActionController } from '../controllers/form-action.controller.js';
import type { AdvancedActionController } from '../controllers/advanced-action.controller.js';
import type { ActionCompatController } from '../controllers/action-compat.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

/**
 * Register action routes
 * Extracted from src/browser/routes/agent.act.ts
 */
export function registerActionRoutes(
  router: Router,
  simpleController: SimpleActionController,
  formController: FormActionController,
  advancedController: AdvancedActionController,
  compatController: ActionCompatController,
  middleware: MiddlewareRegistry,
): void {
  router.post(
    '/act',
    middleware.correlation,
    middleware.logging,
    compatController.handleAct.bind(compatController),
  );

  /**
   * POST /act/click
   * Click an element
   */
  router.post(
    '/act/click',
    middleware.correlation,
    middleware.logging,
    simpleController.handleClick.bind(simpleController),
  );

  /**
   * POST /act/type
   * Type text into input
   */
  router.post(
    '/act/type',
    middleware.correlation,
    middleware.logging,
    simpleController.handleType.bind(simpleController),
  );

  /**
   * POST /act/press
   * Press a key
   */
  router.post(
    '/act/press',
    middleware.correlation,
    middleware.logging,
    simpleController.handlePress.bind(simpleController),
  );

  /**
   * POST /act/hover
   * Hover over an element
   */
  router.post(
    '/act/hover',
    middleware.correlation,
    middleware.logging,
    simpleController.handleHover.bind(simpleController),
  );

  /**
   * POST /act/fill
   * Fill form fields
   */
  router.post(
    '/act/fill',
    middleware.correlation,
    middleware.logging,
    formController.handleFill.bind(formController),
  );

  /**
   * POST /act/navigate
   * Navigate to URL
   */
  router.post(
    '/act/navigate',
    middleware.correlation,
    middleware.logging,
    simpleController.handleNavigate.bind(simpleController),
  );

  /**
   * POST /act/wait
   * Wait for condition
   */
  router.post(
    '/act/wait',
    middleware.correlation,
    middleware.logging,
    formController.handleWait.bind(formController),
  );

  /**
   * POST /act/query_state
   * Query element state(s)
   */
  router.post(
    '/act/query_state',
    middleware.correlation,
    middleware.logging,
    advancedController.handleQueryState.bind(advancedController),
  );

  /**
   * POST /act/resize
   * Resize viewport
   */
  router.post(
    '/act/resize',
    middleware.correlation,
    middleware.logging,
    formController.handleResize.bind(formController),
  );

  /**
   * POST /act/drag
   * Drag from one element to another
   */
  router.post(
    '/act/drag',
    middleware.correlation,
    middleware.logging,
    formController.handleDrag.bind(formController),
  );

  /**
   * POST /act/select
   * Select options
   */
  router.post(
    '/act/select',
    middleware.correlation,
    middleware.logging,
    formController.handleSelect.bind(formController),
  );

  /**
   * POST /act/scrollIntoView
   * Scroll element into view
   */
  router.post(
    '/act/scrollIntoView',
    middleware.correlation,
    middleware.logging,
    advancedController.handleScrollIntoView.bind(advancedController),
  );

  /**
   * POST /act/evaluate
   * Evaluate JavaScript
   */
  router.post(
    '/act/evaluate',
    middleware.correlation,
    middleware.logging,
    advancedController.handleEvaluate.bind(advancedController),
  );

  /**
   * POST /act/close
   * Close page/tab
   */
  router.post(
    '/act/close',
    middleware.correlation,
    middleware.logging,
    advancedController.handleClose.bind(advancedController),
  );

  /**
   * POST /act/discover_dropdown
   * Discover dropdown options
   */
  router.post(
    '/act/discover_dropdown',
    middleware.correlation,
    middleware.logging,
    advancedController.handleDiscoverDropdown.bind(advancedController),
  );

  /**
   * POST /act/close_dropdown
   * Close dropdown
   */
  router.post(
    '/act/close_dropdown',
    middleware.correlation,
    middleware.logging,
    advancedController.handleCloseDropdown.bind(advancedController),
  );

  /**
   * POST /act/detect_blocker
   * Detect blocking element
   */
  router.post(
    '/act/detect_blocker',
    middleware.correlation,
    middleware.logging,
    advancedController.handleDetectBlocker.bind(advancedController),
  );

  /**
   * POST /act/dismiss_blocker
   * Dismiss blocking element
   */
  router.post(
    '/act/dismiss_blocker',
    middleware.correlation,
    middleware.logging,
    advancedController.handleDismissBlocker.bind(advancedController),
  );
}
