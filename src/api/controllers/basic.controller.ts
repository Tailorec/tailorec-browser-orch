import type { Request, Response } from 'express';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import type { BrowserRouteContext } from '../context/browser.context.js';

const log = createSubsystemLogger('basic-controller');

export class BasicController {
  constructor(private browserContext: BrowserRouteContext) {}

  async handleHealth(_req: Request, res: Response): Promise<void> {
    res.send('Tailorec Browser Service OK');
  }

  async handleStatus(_req: Request, res: Response): Promise<void> {
    const state = this.browserContext.state();
    log.info('status request completed', { profiles: state.profiles.size });
    res.json({
      ok: true,
      profiles: Array.from(state.profiles.keys()),
    });
  }
}
