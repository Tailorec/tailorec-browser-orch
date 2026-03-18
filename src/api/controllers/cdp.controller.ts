import type { Request, Response } from 'express';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { CdpValidator } from '../validators/cdp.validator.js';
import { getProfileContext, mapRouteError, sendLegacyError } from './controller-runtime.utils.js';
import {
  captureScreenshot,
  createTargetViaCdp,
  evaluateJavaScript,
  resolveTargetCdpWebSocketUrl,
} from '../../adapters/utils/cdp.utils.js';

export class CdpController {
  private readonly validator = new CdpValidator();

  constructor(private browserContext: BrowserRouteContext) {}

  async handleScreenshot(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateScreenshot(req.body || {});
      const profileCtx = getProfileContext(this.browserContext, req);

      let targetId = dto.targetId;
      if (!targetId && !dto.wsUrl) {
        const tab = await profileCtx.ensureTabAvailable(undefined);
        targetId = tab.targetId;
      }

      const wsUrl = dto.wsUrl
        ? dto.wsUrl
        : (await resolveTargetCdpWebSocketUrl(profileCtx.profile.cdpUrl, targetId)).wsUrl;

      const buffer = await captureScreenshot({
        wsUrl,
        fullPage: dto.fullPage === true,
        format: dto.format ?? 'png',
        quality: dto.quality,
      });

      const mimeType = (dto.format ?? 'png') === 'jpeg' ? 'image/jpeg' : 'image/png';
      res.json({
        ok: true,
        ...(targetId ? { targetId } : {}),
        mimeType,
        imageBase64: buffer.toString('base64'),
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'CDP screenshot failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  async handleCreateTarget(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateCreateTarget(req.body || {});
      const profileCtx = getProfileContext(this.browserContext, req);
      const created = await createTargetViaCdp({
        cdpUrl: profileCtx.profile.cdpUrl,
        url: dto.url,
      });
      res.json({
        ok: true,
        targetId: created.targetId,
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'CDP create target failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  async handleEvaluate(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateEvaluate(req.body || {});
      const profileCtx = getProfileContext(this.browserContext, req);

      let targetId = dto.targetId;
      if (!targetId && !dto.wsUrl) {
        const tab = await profileCtx.ensureTabAvailable(undefined);
        targetId = tab.targetId;
      }

      const wsUrl = dto.wsUrl
        ? dto.wsUrl
        : (await resolveTargetCdpWebSocketUrl(profileCtx.profile.cdpUrl, targetId)).wsUrl;

      const evaluated = await evaluateJavaScript({
        wsUrl,
        expression: dto.expression,
        awaitPromise: dto.awaitPromise,
        returnByValue: dto.returnByValue,
      });

      res.json({
        ok: true,
        ...(targetId ? { targetId } : {}),
        result: evaluated.result,
        exceptionDetails: evaluated.exceptionDetails,
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'CDP evaluate failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }
}

