import type { Request, Response } from 'express';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { SessionService } from '../../core/services/session.service.js';
import { PlaywrightNavigationAdapter } from '../../adapters/playwright/playwright.navigation.adapter.js';
import { getProfileContext, mapRouteError, normalizeScreenshotType, sendErrorResponse } from './controller-runtime.utils.js';

type LabeledRef = { role: string; name?: string; nth?: number };

export class MediaController {
  constructor(
    private sessionService: SessionService,
    private navigationAdapter: PlaywrightNavigationAdapter,
    private browserContext: BrowserRouteContext,
  ) {}

  async handleScreenshot(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body || {};
      const targetId = typeof body.targetId === 'string' ? body.targetId : undefined;
      const quality = this.toNumber(body.quality);
      let type: 'png' | 'jpeg';
      try {
        type = normalizeScreenshotType(body.type, quality !== undefined);
      } catch (error) {
        sendErrorResponse(res, 400, error);
        return;
      }
      const ref = typeof body.ref === 'string' ? body.ref.trim() : '';
      const element = typeof body.element === 'string' ? body.element.trim() : '';
      const fullPage = this.toBoolean(body.fullPage) === true;

      if (ref && element) {
        sendErrorResponse(res, 400, 'ref and element are mutually exclusive');
        return;
      }
      if ((ref || element) && fullPage) {
        sendErrorResponse(res, 400, 'fullPage is only allowed for full-page screenshots');
        return;
      }
      if (quality !== undefined) {
        if (type !== 'jpeg') {
          sendErrorResponse(res, 400, 'quality is only allowed for jpeg screenshots');
          return;
        }
        if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
          sendErrorResponse(res, 400, 'quality must be an integer between 0 and 100');
          return;
        }
      }

      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const page = await this.sessionService.getPage(tab.targetId, profileCtx.profile.cdpUrl);
      await this.sessionService.restoreRoleRefs(tab.targetId, profileCtx.profile.cdpUrl);
      const screenshotOptions = {
        type,
        ...(type === 'jpeg' && typeof quality === 'number' ? { quality } : {}),
      };

      const result = ref
        ? { buffer: await this.sessionService.refLocator(tab.targetId, ref).screenshot(screenshotOptions) }
        : element
          ? { buffer: await page.locator(element).first().screenshot(screenshotOptions) }
          : await this.navigationAdapter.takeScreenshot(page, { type, quality, fullPage });

      res.json({
        ok: true,
        targetId: tab.targetId,
        url: tab.url,
        mimeType: type === 'jpeg' ? 'image/jpeg' : 'image/png',
        imageBase64: result.buffer.toString('base64'),
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Screenshot failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  async handleLabeledScreenshot(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body || {};
      if (!body.refs || typeof body.refs !== 'object' || Array.isArray(body.refs)) {
        sendErrorResponse(res, 400, 'refs object is required');
        return;
      }

      const refs = this.parseRefs(body.refs);
      if (!Object.keys(refs).length) {
        sendErrorResponse(res, 400, 'refs must include at least one valid {role,name?,nth?} entry');
        return;
      }

      let type: 'png' | 'jpeg';
      try {
        type = normalizeScreenshotType(body.type, false);
      } catch (error) {
        sendErrorResponse(res, 400, error);
        return;
      }
      const maxLabels =
        typeof body.maxLabels === 'number' && Number.isFinite(body.maxLabels)
          ? Math.max(1, Math.floor(body.maxLabels))
          : 150;
      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(
        typeof body.targetId === 'string' ? body.targetId : undefined,
      );
      const page = await this.sessionService.getPage(tab.targetId, profileCtx.profile.cdpUrl);
      await this.sessionService.restoreRoleRefs(tab.targetId, profileCtx.profile.cdpUrl);
      const labeled = await this.takeLabeledScreenshot(
        tab.targetId,
        page,
        Object.keys(refs),
        maxLabels,
        type,
      );

      res.json({
        ok: true,
        targetId: tab.targetId,
        url: tab.url,
        mimeType: type === 'jpeg' ? 'image/jpeg' : 'image/png',
        imageBase64: labeled.buffer.toString('base64'),
        labels: labeled.labels,
        skipped: labeled.skipped,
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Labeled screenshot failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  async handleHighlight(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body || {};
      if (typeof body.ref !== 'string' || !body.ref.trim()) {
        sendErrorResponse(res, 400, 'ref is required');
        return;
      }

      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(
        typeof body.targetId === 'string' ? body.targetId : undefined,
      );
      const page = await this.sessionService.getPage(tab.targetId, profileCtx.profile.cdpUrl);
      await this.sessionService.restoreRoleRefs(tab.targetId, profileCtx.profile.cdpUrl);
      await this.sessionService.refLocator(tab.targetId, body.ref).highlight();
      res.json({ ok: true, targetId: tab.targetId });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Highlight failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  private parseRefs(raw: unknown): Record<string, LabeledRef> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }

    const refs: Record<string, LabeledRef> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }
      const record = value as Record<string, unknown>;
      const role = typeof record.role === 'string' ? record.role.trim() : '';
      if (!role) continue;
      refs[key] = {
        role,
        ...(typeof record.name === 'string' && record.name.trim() ? { name: record.name.trim() } : {}),
        ...(typeof record.nth === 'number' ? { nth: record.nth } : {}),
      };
    }
    return refs;
  }

  private async takeLabeledScreenshot(
    targetId: string,
    page: Awaited<ReturnType<SessionService['getPage']>>,
    refs: string[],
    maxLabels: number,
    type: 'png' | 'jpeg',
  ): Promise<{ buffer: Buffer; labels: number; skipped: number }> {
    const viewport = await page.evaluate(() => ({
      scrollX: window.scrollX || 0,
      scrollY: window.scrollY || 0,
      width: window.innerWidth || 0,
      height: window.innerHeight || 0,
    }));

    const boxes: Array<{ ref: string; x: number; y: number; w: number; h: number }> = [];
    let skipped = 0;

    for (const ref of refs) {
      if (boxes.length >= maxLabels) {
        skipped += 1;
        continue;
      }
      try {
        const box = await this.sessionService.refLocator(targetId, ref).boundingBox();
        if (!box) {
          skipped += 1;
          continue;
        }
        const x1 = box.x + box.width;
        const y1 = box.y + box.height;
        if (
          x1 < viewport.scrollX ||
          box.x > viewport.scrollX + viewport.width ||
          y1 < viewport.scrollY ||
          box.y > viewport.scrollY + viewport.height
        ) {
          skipped += 1;
          continue;
        }
        boxes.push({
          ref,
          x: box.x - viewport.scrollX,
          y: box.y - viewport.scrollY,
          w: Math.max(1, box.width),
          h: Math.max(1, box.height),
        });
      } catch {
        skipped += 1;
      }
    }

    try {
      if (boxes.length) {
        await page.evaluate((labels) => {
          document.querySelectorAll('[data-openclaw-labels]').forEach((el) => el.remove());
          const root = document.createElement('div');
          root.setAttribute('data-openclaw-labels', '1');
          root.style.position = 'fixed';
          root.style.left = '0';
          root.style.top = '0';
          root.style.zIndex = '2147483647';
          root.style.pointerEvents = 'none';
          root.style.fontFamily =
            '"SF Mono","SFMono-Regular",Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace';

          for (const label of labels) {
            const box = document.createElement('div');
            box.setAttribute('data-openclaw-labels', '1');
            box.style.position = 'absolute';
            box.style.left = `${label.x}px`;
            box.style.top = `${label.y}px`;
            box.style.width = `${label.w}px`;
            box.style.height = `${label.h}px`;
            box.style.border = '2px solid #ffb020';
            box.style.boxSizing = 'border-box';

            const tag = document.createElement('div');
            tag.setAttribute('data-openclaw-labels', '1');
            tag.textContent = label.ref;
            tag.style.position = 'absolute';
            tag.style.left = `${label.x}px`;
            tag.style.top = `${Math.max(0, label.y - 18)}px`;
            tag.style.background = '#ffb020';
            tag.style.color = '#1a1a1a';
            tag.style.fontSize = '12px';
            tag.style.lineHeight = '14px';
            tag.style.padding = '1px 4px';
            tag.style.borderRadius = '3px';

            root.appendChild(box);
            root.appendChild(tag);
          }

          document.documentElement.appendChild(root);
        }, boxes);
      }

      const buffer = await page.screenshot({ type });
      return { buffer, labels: boxes.length, skipped };
    } finally {
      await page.evaluate(() => {
        document.querySelectorAll('[data-openclaw-labels]').forEach((el) => el.remove());
      }).catch(() => undefined);
    }
  }

  private toBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return undefined;
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
  }
}
