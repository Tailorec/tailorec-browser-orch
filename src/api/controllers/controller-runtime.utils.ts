import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Request, Response as ExpressResponse } from 'express';
import type { BrowserRouteContext } from '../context/browser.context.js';

type RouteErrorDetails = {
  code?: string;
  retryAfterSeconds?: number;
  active?: number;
  max?: number;
};

export function getProfileName(req: Request): string {
  const profile = req.query.profile;
  return typeof profile === 'string' && profile.trim() ? profile.trim() : 'default';
}

export function getProfileContext(ctx: BrowserRouteContext, req: Request) {
  try {
    return ctx.forProfile(getProfileName(req));
  } catch (error) {
    const message = getErrorMessage(error).replace(/^Error:\s*/, '');
    const wrapped = new Error(message);
    (wrapped as Error & { status?: number }).status = 404;
    throw wrapped;
  }
}

export function getRunId(req: Request): string {
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const runId = typeof body.run_id === 'string' ? body.run_id.trim() : '';
  if (!runId) {
    const wrapped = new Error('run_id is required');
    (wrapped as Error & { status?: number }).status = 400;
    throw wrapped;
  }
  return runId;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeValidationErrorMessage(error: Error): string {
  const raw = error.message.replace(/^Action validation failed:\s*/i, '').trim();
  const first = raw.split(',')[0]?.trim() || 'invalid request payload';
  const required = first.match(/^([a-zA-Z0-9_.-]+):\s*Required$/);
  if (required) {
    return `${required[1]} is required`;
  }
  const root = first.match(/^root:\s*(.+)$/i);
  if (root) {
    return root[1];
  }
  return first;
}

export function sendErrorResponse(
  res: ExpressResponse,
  status: number,
  error: unknown,
  details?: RouteErrorDetails,
): void {
  if (typeof details?.retryAfterSeconds === 'number' && Number.isFinite(details.retryAfterSeconds)) {
    res.setHeader('Retry-After', String(Math.max(0, Math.floor(details.retryAfterSeconds))));
  }
  res.status(status).json({
    ok: false,
    error: getErrorMessage(error),
    ...(details?.code ? { code: details.code } : {}),
    ...(typeof details?.active === 'number' ? { active: details.active } : {}),
    ...(typeof details?.max === 'number' ? { max: details.max } : {}),
    ...(typeof details?.retryAfterSeconds === 'number'
      ? { retry_after_seconds: Math.max(0, Math.floor(details.retryAfterSeconds)) }
      : {}),
  });
}

export function mapRouteError(
  ctx: BrowserRouteContext,
  error: unknown,
  fallback: string,
): { status: number; message: string; details?: RouteErrorDetails } {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    const maybeDetails = error as {
      code?: unknown;
      retryAfterSeconds?: unknown;
      active?: unknown;
      max?: unknown;
    };
    const details: RouteErrorDetails = {
      ...(typeof maybeDetails.code === 'string' ? { code: maybeDetails.code } : {}),
      ...(typeof maybeDetails.retryAfterSeconds === 'number'
        ? { retryAfterSeconds: maybeDetails.retryAfterSeconds }
        : {}),
      ...(typeof maybeDetails.active === 'number' ? { active: maybeDetails.active } : {}),
      ...(typeof maybeDetails.max === 'number' ? { max: maybeDetails.max } : {}),
    };
    return {
      status: (error as { status: number }).status,
      message: getErrorMessage(error),
      ...(Object.keys(details).length > 0 ? { details } : {}),
    };
  }
  if (error instanceof Error && /ValidationError$/.test(error.name)) {
    return { status: 400, message: normalizeValidationErrorMessage(error) };
  }
  return ctx.mapTabError(error) ?? { status: 500, message: getErrorMessage(error) || fallback };
}

export function normalizeScreenshotType(value: unknown, hasQuality = false): 'png' | 'jpeg' {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) {
    return hasQuality ? 'jpeg' : 'png';
  }
  if (raw === 'png') {
    return 'png';
  }
  if (raw === 'jpeg' || raw === 'jpg') {
    return 'jpeg';
  }
  throw new Error('type must be png|jpeg');
}

export async function stageUploadFromUrl(url: string): Promise<string> {
  const timeoutMs = Math.max(
    2_000,
    Math.min(120_000, Number(process.env.BROWSER_UPLOAD_DOWNLOAD_TIMEOUT_MS || 45_000)),
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (error) {
    throw new Error(`file_download_failed:${getErrorMessage(error)}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`file_download_failed:${response.status}`);
  }

  const maxBytes = Math.max(
    256 * 1024,
    Math.min(50 * 1024 * 1024, Number(process.env.BROWSER_UPLOAD_MAX_BYTES || 15 * 1024 * 1024)),
  );
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`file_download_too_large:${contentLength}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) {
    throw new Error(`file_download_too_large:${bytes.length}`);
  }

  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return '/upload.bin';
    }
  })();

  const ext = path.extname(pathname) || '.bin';
  const uploadDir = path.resolve(process.cwd(), 'upload-resume');
  await fs.mkdir(uploadDir, { recursive: true });
  const tempPath = path.join(uploadDir, `openclaw-browser-upload-${randomUUID()}${ext}`);
  await fs.writeFile(tempPath, bytes);
  return tempPath;
}

export async function resolveUploadPaths(
  paths: string[],
): Promise<{ resolved: string[]; staged: string[] }> {
  const resolved: string[] = [];
  const staged: string[] = [];

  for (const entry of paths) {
    if (/^https?:\/\//i.test(entry)) {
      const tempPath = await stageUploadFromUrl(entry);
      resolved.push(tempPath);
      staged.push(tempPath);
    } else {
      resolved.push(entry);
    }
  }

  return { resolved, staged };
}
