import type { Request, Response } from 'express';
import { SessionService } from '../../core/services/session.service.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { ActivityValidator } from '../validators/activity.validator.js';
import { getProfileContext, mapRouteError, sendLegacyError } from './controller-runtime.utils.js';

export class ActivityController {
  private readonly validator = new ActivityValidator();

  constructor(
    private sessionService: SessionService,
    private browserContext: BrowserRouteContext,
  ) {}

  async handleConsole(req: Request, res: Response): Promise<void> {
    await this.handleActivity(req, res, 'console');
  }

  async handleErrors(req: Request, res: Response): Promise<void> {
    await this.handleActivity(req, res, 'errors');
  }

  async handleNetwork(req: Request, res: Response): Promise<void> {
    await this.handleActivity(req, res, 'network');
  }

  private async handleActivity(
    req: Request,
    res: Response,
    kind: 'console' | 'errors' | 'network',
  ): Promise<void> {
    try {
      const dto = this.validator.validate(req.body || {});
      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(dto.targetId);
      await this.sessionService.getSession(tab.targetId, profileCtx.profile.cdpUrl);

      const limit = dto.limit;
      if (kind === 'console') {
        const data = this.sessionService.getConsoleMessages(tab.targetId);
        res.json({ ok: true, targetId: tab.targetId, console: this.applyLimit(data, limit) });
        return;
      }

      if (kind === 'errors') {
        const data = this.sessionService.getPageErrors(tab.targetId);
        res.json({ ok: true, targetId: tab.targetId, errors: this.applyLimit(data, limit) });
        return;
      }

      const data = this.sessionService.getNetworkRequests(tab.targetId);
      res.json({ ok: true, targetId: tab.targetId, requests: this.applyLimit(data, limit) });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Activity retrieval failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  private applyLimit<T>(items: T[], limit?: number): T[] {
    if (!limit || limit <= 0 || items.length <= limit) {
      return items;
    }
    return items.slice(items.length - limit);
  }
}

