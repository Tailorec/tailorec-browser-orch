import fs from 'node:fs/promises';
import type { Request, Response } from 'express';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { SessionService } from '../../core/services/session.service.js';
import {
  armDialog,
  armFileUpload,
  download,
  waitForDownload,
} from '../../adapters/playwright/playwright.downloads.adapter.js';
import {
  getProfileContext,
  getRunId,
  mapRouteError,
  resolveUploadPaths,
  sendErrorResponse,
} from './controller-runtime.utils.js';

const log = createSubsystemLogger('hooks-controller');

export class HooksController {
  private readonly validator = new ActionValidator();

  constructor(
    private sessionService: SessionService,
    private browserContext: BrowserRouteContext,
  ) {}

  async handleFileChooser(req: Request, res: Response): Promise<void> {
    let stagedPaths: string[] = [];
    try {
      const dto = this.validator.validateFileChooser(req.body || {});
      if (!dto.paths.length) {
        sendErrorResponse(res, 400, 'paths are required');
        return;
      }
      if ((dto.inputRef || dto.element) && dto.ref) {
        sendErrorResponse(res, 400, 'ref cannot be combined with inputRef/element');
        return;
      }

      const profileCtx = getProfileContext(this.browserContext, req);
      const runId = getRunId(req);
      const tab = await profileCtx.ensureTabAvailable(runId, dto.targetId);
      const page = await this.sessionService.getPage(tab.targetId, tab.browserEndpoint);
      const resolved = await resolveUploadPaths(dto.paths);
      stagedPaths = resolved.staged;

      if (dto.inputRef || dto.element) {
        const locator = dto.inputRef
          ? this.sessionService.refLocator(tab.targetId, dto.inputRef)
          : page.locator(dto.element!);
        await locator.setInputFiles(resolved.resolved);
      } else {
        const armId = this.sessionService.bumpUploadArmId(tab.targetId);
        await armFileUpload(page, {
          paths: resolved.resolved,
          timeoutMs: dto.timeoutMs,
          isActive: () => this.sessionService.getUploadArmId(tab.targetId) === armId,
        });
        if (dto.ref) {
          await this.sessionService.refLocator(tab.targetId, dto.ref).click({
            timeout: dto.timeoutMs ?? 8000,
          });
        }
      }

      res.json({ ok: true });
      log.info('file chooser armed', { target_id: tab.targetId, paths: dto.paths.length });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'File chooser failed');
      sendErrorResponse(res, mapped.status, mapped.message, mapped.details);
    } finally {
      if (process.env.BROWSER_KEEP_STAGED_UPLOADS !== 'true') {
        await Promise.all(stagedPaths.map((tempPath) => fs.unlink(tempPath).catch(() => undefined)));
      }
    }
  }

  async handleDialog(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateDialog(req.body || {});
      const profileCtx = getProfileContext(this.browserContext, req);
      const runId = getRunId(req);
      const tab = await profileCtx.ensureTabAvailable(runId, dto.targetId);
      const page = await this.sessionService.getPage(tab.targetId, tab.browserEndpoint);
      const armId = this.sessionService.bumpDialogArmId(tab.targetId);
      await armDialog(page, {
        accept: dto.accept,
        promptText: dto.promptText,
        timeoutMs: dto.timeoutMs,
        isActive: () => this.sessionService.getDialogArmId(tab.targetId) === armId,
      });
      res.json({ ok: true });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Dialog hook failed');
      sendErrorResponse(res, mapped.status, mapped.message, mapped.details);
    }
  }

  async handleWaitDownload(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateDownloadWait(req.body || {});
      const profileCtx = getProfileContext(this.browserContext, req);
      const runId = getRunId(req);
      const tab = await profileCtx.ensureTabAvailable(runId, dto.targetId);
      const page = await this.sessionService.getPage(tab.targetId, tab.browserEndpoint);
      const armId = this.sessionService.bumpDownloadArmId(tab.targetId);
      const result = await waitForDownload(page, {
        path: dto.path,
        timeoutMs: dto.timeoutMs,
        isActive: () => this.sessionService.getDownloadArmId(tab.targetId) === armId,
      });
      res.json({ ok: true, targetId: tab.targetId, download: result });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Wait for download failed');
      sendErrorResponse(res, mapped.status, mapped.message, mapped.details);
    }
  }

  async handleDownload(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateDownload(req.body || {});
      const profileCtx = getProfileContext(this.browserContext, req);
      const runId = getRunId(req);
      const tab = await profileCtx.ensureTabAvailable(runId, dto.targetId);
      const page = await this.sessionService.getPage(tab.targetId, tab.browserEndpoint);
      await this.sessionService.restoreRoleRefs(tab.targetId, tab.browserEndpoint);
      const armId = this.sessionService.bumpDownloadArmId(tab.targetId);
      const result = await download(page, {
        ref: dto.ref,
        path: dto.path,
        timeoutMs: dto.timeoutMs,
        refLocator: (_page, ref) => this.sessionService.refLocator(tab.targetId, ref),
        isActive: () => this.sessionService.getDownloadArmId(tab.targetId) === armId,
      });
      res.json({ ok: true, targetId: tab.targetId, download: result });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Download failed');
      sendErrorResponse(res, mapped.status, mapped.message, mapped.details);
    }
  }
}
