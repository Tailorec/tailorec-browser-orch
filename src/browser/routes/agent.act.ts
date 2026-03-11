import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

import path from "node:path";
import type { BrowserFormField } from "../client-actions-core.js";
import type { BrowserRouteContext, ProfileContext } from "../server-context.js";
import type { BrowserRouteRegistrar } from "./types.js";
import {
  type ActKind,
  isActKind,
  parseClickButton,
  parseClickModifiers,
} from "./agent.act.shared.js";
import {
  handleRouteError,
  readBody,
  resolveProfileContext,
  SELECTOR_UNSUPPORTED_MESSAGE,
} from "./agent.shared.js";
import { jsonError, toBoolean, toNumber, toStringArray, toStringOrEmpty } from "./utils.js";
import { getPwAiModule } from "../pw-ai-module.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("browser-act");

function parseScreenshotType(value: unknown): "png" | "jpeg" {
  const raw = toStringOrEmpty(value).toLowerCase();
  if (!raw || raw === "png") {
    return "png";
  }
  if (raw === "jpeg" || raw === "jpg") {
    return "jpeg";
  }
  throw new Error("type must be png|jpeg");
}

export async function stageUploadFromUrl(url: string): Promise<string> {
  const timeoutMs = Math.max(
    2_000,
    Math.min(120_000, Number(process.env.BROWSER_UPLOAD_DOWNLOAD_TIMEOUT_MS || 45_000)),
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`file_download_failed:${reason}`);
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
  const contentLength = Number(response.headers.get("content-length") || 0);
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
      return "/upload.bin";
    }
  })();
  const ext = path.extname(pathname) || ".bin";
  const uploadDir = path.resolve(process.cwd(), "upload-resume");
  await fs.mkdir(uploadDir, { recursive: true });
  const tempPath = path.join(uploadDir, `openclaw-browser-upload-${randomUUID()}${ext}`);
  await fs.writeFile(tempPath, bytes);
  return tempPath;
}

export async function resolveUploadPaths(paths: string[]): Promise<{ resolved: string[]; staged: string[] }> {
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

export async function executeFileChooserUpload(args: {
  profileCtx: ProfileContext;
  getPwModule: () => Promise<Awaited<ReturnType<typeof getPwAiModule>>>;
  targetId?: string;
  ref?: string;
  inputRef?: string;
  element?: string;
  paths: string[];
  timeoutMs?: number;
  keepStagedFiles?: boolean;
}): Promise<void> {
  const { profileCtx, getPwModule, targetId, ref, inputRef, element, paths, timeoutMs, keepStagedFiles } = args;

  let stagedPaths: string[] = [];
  try {
    const { resolved: resolvedPaths, staged } = await resolveUploadPaths(paths);
    stagedPaths = staged;

    const tab = await profileCtx.ensureTabAvailable(targetId);
    const pw = await getPwModule();
    if (!pw) {
      throw new Error("playwright_unavailable");
    }

    if (inputRef || element) {
      if (ref) {
        throw new Error("ref cannot be combined with inputRef/element");
      }
      await pw.setInputFilesViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        inputRef,
        element,
        paths: resolvedPaths,
      });
      return;
    }

    await pw.armFileUploadViaPlaywright({
      cdpUrl: profileCtx.profile.cdpUrl,
      targetId: tab.targetId,
      paths: resolvedPaths,
      timeoutMs: timeoutMs ?? undefined,
    });
    if (ref) {
      await pw.clickViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        ref,
      });
    }
  } finally {
    if (keepStagedFiles) {
      log.info("keeping staged upload files for debugging", {
        staged_paths: stagedPaths,
      });
    } else {
      await Promise.all(stagedPaths.map((tempPath) => fs.unlink(tempPath).catch(() => undefined)));
    }
  }
}

export function registerBrowserAgentActRoutes(
  app: BrowserRouteRegistrar,
  ctx: BrowserRouteContext,
) {
  app.post("/act", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const kindRaw = toStringOrEmpty(body.kind);
    if (!isActKind(kindRaw)) {
      return jsonError(res, 400, "kind is required");
    }
    const kind: ActKind = kindRaw;
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    if (Object.hasOwn(body, "selector") && kind !== "wait") {
      return jsonError(res, 400, SELECTOR_UNSUPPORTED_MESSAGE);
    }

    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const cdpUrl = profileCtx.profile.cdpUrl;
      const pw = await getPwAiModule();
      const evaluateEnabled = ctx.state().resolved.evaluateEnabled;
      log.info("act request", {
        kind,
        target_id: tab.targetId,
        profile: profileCtx.profile.name,
      });

      switch (kind) {
        case "query_state": {
          const ref = toStringOrEmpty(body.ref);
          const refs = Array.isArray(body.refs) ? body.refs.map(String).filter(Boolean) : [];

          if (refs.length > 0) {
            const result = await pw.queryElementStatesViaPlaywright({
              cdpUrl,
              targetId: tab.targetId,
              refs,
            });
            return res.json({ ok: true, targetId: tab.targetId, ...result });
          }

          if (!ref) return jsonError(res, 400, "ref or refs is required");
          const state = await pw.queryElementStateViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            ref,
          });
          return res.json({ ok: true, targetId: tab.targetId, state });
        }
        case "click": {
          const ref = toStringOrEmpty(body.ref);
          if (!ref) {
            return jsonError(res, 400, "ref is required");
          }
          const doubleClick = toBoolean(body.doubleClick) ?? false;
          const timeoutMs = toNumber(body.timeoutMs);
          const buttonRaw = toStringOrEmpty(body.button) || "";
          const button = buttonRaw ? parseClickButton(buttonRaw) : undefined;
          if (buttonRaw && !button) {
            return jsonError(res, 400, "button must be left|right|middle");
          }

          const modifiersRaw = toStringArray(body.modifiers) ?? [];
          const parsedModifiers = parseClickModifiers(modifiersRaw);
          if (parsedModifiers.error) {
            return jsonError(res, 400, parsedModifiers.error);
          }
          const modifiers = parsedModifiers.modifiers;
          const clickRequest: Parameters<typeof pw.clickViaPlaywright>[0] = {
            cdpUrl,
            targetId: tab.targetId,
            ref,
            doubleClick,
          };
          if (button) {
            clickRequest.button = button;
          }
          if (modifiers) {
            clickRequest.modifiers = modifiers;
          }
          if (timeoutMs) {
            clickRequest.timeoutMs = timeoutMs;
          }
          await pw.clickViaPlaywright(clickRequest);
          return res.json({ ok: true, targetId: tab.targetId, url: tab.url });
        }
        case "type": {
          const ref = toStringOrEmpty(body.ref);
          if (!ref) {
            return jsonError(res, 400, "ref is required");
          }
          if (typeof body.text !== "string") {
            return jsonError(res, 400, "text is required");
          }
          const text = body.text;
          const submit = toBoolean(body.submit) ?? false;
          const slowly = toBoolean(body.slowly) ?? false;
          const timeoutMs = toNumber(body.timeoutMs);
          const typeRequest: Parameters<typeof pw.typeViaPlaywright>[0] = {
            cdpUrl,
            targetId: tab.targetId,
            ref,
            text,
            submit,
            slowly,
          };
          if (timeoutMs) {
            typeRequest.timeoutMs = timeoutMs;
          }
          await pw.typeViaPlaywright(typeRequest);
          return res.json({ ok: true, targetId: tab.targetId });
        }
        case "press": {
          const key = toStringOrEmpty(body.key);
          if (!key) {
            return jsonError(res, 400, "key is required");
          }
          const delayMs = toNumber(body.delayMs);
          await pw.pressKeyViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            key,
            delayMs: delayMs ?? undefined,
          });
          return res.json({ ok: true, targetId: tab.targetId });
        }
        case "hover": {
          const ref = toStringOrEmpty(body.ref);
          if (!ref) {
            return jsonError(res, 400, "ref is required");
          }
          const timeoutMs = toNumber(body.timeoutMs);
          await pw.hoverViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            ref,
            timeoutMs: timeoutMs ?? undefined,
          });
          return res.json({ ok: true, targetId: tab.targetId });
        }
        case "scrollIntoView": {
          const ref = toStringOrEmpty(body.ref);
          if (!ref) {
            return jsonError(res, 400, "ref is required");
          }
          const timeoutMs = toNumber(body.timeoutMs);
          const scrollRequest: Parameters<typeof pw.scrollIntoViewViaPlaywright>[0] = {
            cdpUrl,
            targetId: tab.targetId,
            ref,
          };
          if (timeoutMs) {
            scrollRequest.timeoutMs = timeoutMs;
          }
          await pw.scrollIntoViewViaPlaywright(scrollRequest);
          return res.json({ ok: true, targetId: tab.targetId });
        }
        case "drag": {
          const startRef = toStringOrEmpty(body.startRef);
          const endRef = toStringOrEmpty(body.endRef);
          if (!startRef || !endRef) {
            return jsonError(res, 400, "startRef and endRef are required");
          }
          const timeoutMs = toNumber(body.timeoutMs);
          await pw.dragViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            startRef,
            endRef,
            timeoutMs: timeoutMs ?? undefined,
          });
          return res.json({ ok: true, targetId: tab.targetId });
        }
        case "select": {
          const ref = toStringOrEmpty(body.ref);
          const values = toStringArray(body.values);
          if (!ref || !values?.length) {
            return jsonError(res, 400, "ref and values are required");
          }
          const timeoutMs = toNumber(body.timeoutMs);
          await pw.selectOptionViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            ref,
            values,
            timeoutMs: timeoutMs ?? undefined,
          });
          return res.json({ ok: true, targetId: tab.targetId });
        }
        case "fill": {
          const rawFields = Array.isArray(body.fields) ? body.fields : [];
          const fields = rawFields
            .map((field) => {
              if (!field || typeof field !== "object") {
                return null;
              }
              const rec = field as Record<string, unknown>;
              const ref = toStringOrEmpty(rec.ref);
              const type = toStringOrEmpty(rec.type);
              if (!ref || !type) {
                return null;
              }
              const value =
                typeof rec.value === "string" ||
                typeof rec.value === "number" ||
                typeof rec.value === "boolean"
                  ? rec.value
                  : undefined;
              const parsed: BrowserFormField =
                value === undefined ? { ref, type } : { ref, type, value };
              return parsed;
            })
            .filter((field): field is BrowserFormField => field !== null);
          if (!fields.length) {
            return jsonError(res, 400, "fields are required");
          }
          const timeoutMs = toNumber(body.timeoutMs);
          const fillResponse = await pw.fillFormViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            fields,
            timeoutMs: timeoutMs ?? undefined,
          });
          return res.json({
            ok: true,
            targetId: tab.targetId,
            results: fillResponse.results,
            allMatched: fillResponse.results.every((r) => r.matched),
            mismatched: fillResponse.results
              .filter((r) => !r.matched)
              .map((r) => ({
                ref: r.ref,
                requested: r.requestedValue,
                actual: r.actualValue,
                warning: r.warning,
              })),
          });
        }
        case "resize": {
          const width = toNumber(body.width);
          const height = toNumber(body.height);
          if (!width || !height) {
            return jsonError(res, 400, "width and height are required");
          }
          await pw.resizeViewportViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            width,
            height,
          });
          return res.json({ ok: true, targetId: tab.targetId, url: tab.url });
        }
        case "wait": {
          const timeMs = toNumber(body.timeMs);
          const text = toStringOrEmpty(body.text) || undefined;
          const textGone = toStringOrEmpty(body.textGone) || undefined;
          const selector = toStringOrEmpty(body.selector) || undefined;
          const url = toStringOrEmpty(body.url) || undefined;
          const loadStateRaw = toStringOrEmpty(body.loadState);
          const loadState =
            loadStateRaw === "load" ||
            loadStateRaw === "domcontentloaded" ||
            loadStateRaw === "networkidle"
              ? loadStateRaw
              : undefined;
          const fn = toStringOrEmpty(body.fn) || undefined;
          const timeoutMs = toNumber(body.timeoutMs) ?? undefined;
          if (fn && !evaluateEnabled) {
            return jsonError(
              res,
              403,
              [
                "wait --fn is disabled by config (browser.evaluateEnabled=false).",
                "Docs: /gateway/configuration#browser-openclaw-managed-browser",
              ].join("\n"),
            );
          }
          if (
            timeMs === undefined &&
            !text &&
            !textGone &&
            !selector &&
            !url &&
            !loadState &&
            !fn
          ) {
            return jsonError(
              res,
              400,
              "wait requires at least one of: timeMs, text, textGone, selector, url, loadState, fn",
            );
          }
          await pw.waitForViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            timeMs,
            text,
            textGone,
            selector,
            url,
            loadState,
            fn,
            timeoutMs,
          });
          return res.json({ ok: true, targetId: tab.targetId });
        }
        case "evaluate": {
          if (!evaluateEnabled) {
            return jsonError(
              res,
              403,
              [
                "act:evaluate is disabled by config (browser.evaluateEnabled=false).",
                "Docs: /gateway/configuration#browser-openclaw-managed-browser",
              ].join("\n"),
            );
          }
          const fn = toStringOrEmpty(body.fn);
          if (!fn) {
            return jsonError(res, 400, "fn is required");
          }
          const ref = toStringOrEmpty(body.ref) || undefined;
          const result = await pw.evaluateViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            fn,
            ref,
          });
          return res.json({
            ok: true,
            targetId: tab.targetId,
            url: tab.url,
            result,
          });
        }
        case "navigate": {
          const url = toStringOrEmpty(body.url);
          if (!url) {
            return jsonError(res, 400, "url is required");
          }
          const timeoutMs = toNumber(body.timeoutMs);
          const result = await pw.navigateViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            url,
            timeoutMs,
          });
          return res.json({ ok: true, targetId: tab.targetId, url: result.url });
        }
        case "close": {
          await pw.closePageViaPlaywright({ cdpUrl, targetId: tab.targetId });
          return res.json({ ok: true, targetId: tab.targetId });
        }
        case "discover_dropdown": {
          const ref = toStringOrEmpty(body.ref);
          if (!ref) {
            return jsonError(res, 400, "ref is required");
          }
          const searchText = toStringOrEmpty(body.searchText) || undefined;
          const timeoutMs = toNumber(body.timeoutMs);
          const result = await pw.discoverDropdownOptionsViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            ref,
            searchText,
            timeoutMs: timeoutMs ?? undefined,
          });
          return res.json({ ok: true, targetId: tab.targetId, ...result });
        }
        case "close_dropdown": {
          const ref = toStringOrEmpty(body.ref);
          if (!ref) {
            return jsonError(res, 400, "ref is required");
          }
          await pw.closeDropdownViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            ref,
          });
          return res.json({ ok: true, targetId: tab.targetId });
        }
        case "detect_blocker": {
          const ref = toStringOrEmpty(body.ref);
          if (!ref) {
            return jsonError(res, 400, "ref is required");
          }
          const result = await pw.detectBlockingElementViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            ref,
          });
          return res.json({ ok: true, targetId: tab.targetId, ...result });
        }
        case "dismiss_blocker": {
          const targetRef = toStringOrEmpty(body.targetRef);
          if (!targetRef) {
            return jsonError(res, 400, "targetRef is required");
          }
          const strategy = toStringOrEmpty(body.strategy) as any;
          const closeButtonRef = toStringOrEmpty(body.closeButtonRef) || undefined;
          const result = await pw.dismissBlockerViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            targetRef,
            strategy: strategy || undefined,
            closeButtonRef,
          });
          return res.json({ ok: true, targetId: tab.targetId, ...result });
        }
        default: {
          return jsonError(res, 400, "unsupported kind");
        }
      }
    } catch (err) {
      const body = readBody(req);
      const loadStateRaw = toStringOrEmpty(body.loadState);
      const timeoutMs = toNumber(body.timeoutMs);
      const errMsg = err instanceof Error ? err.message : String(err);

      // Rich timeout response for observability/debugging.
      if (errMsg.includes("waitForLoadState") && errMsg.includes("Timeout")) {
        const loadStateHint =
          loadStateRaw === "networkidle"
            ? "networkidle can hang on pages with long-polling/analytics; prefer load or domcontentloaded"
            : "increase timeoutMs or use a less strict wait condition";
        log.warn("act wait timed out", {
          kind: kindRaw,
          target_id: targetId,
          load_state: loadStateRaw || undefined,
          timeout_ms: timeoutMs,
          hint: loadStateHint,
        });
        return res.status(408).json({
          ok: false,
          error: "Browser wait action timed out",
          code: "WAIT_LOAD_STATE_TIMEOUT",
          details: {
            kind: kindRaw,
            targetId: targetId || null,
            loadState: loadStateRaw || null,
            timeoutMs: timeoutMs ?? null,
            hint: loadStateHint,
            raw: errMsg.slice(0, 1000),
          },
        });
      }

      log.exception("act route failed", err, { kind: kindRaw, target_id: targetId });
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/hooks/file-chooser", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    const ref = toStringOrEmpty(body.ref) || undefined;
    const inputRef = toStringOrEmpty(body.inputRef) || undefined;
    const element = toStringOrEmpty(body.element) || undefined;
    const paths = toStringArray(body.paths) ?? [];
    const timeoutMs = toNumber(body.timeoutMs);
    if (!paths.length) {
      return jsonError(res, 400, "paths are required");
    }
    if ((inputRef || element) && ref) {
      return jsonError(res, 400, "ref cannot be combined with inputRef/element");
    }

    try {
      await executeFileChooserUpload({
        profileCtx,
        getPwModule: getPwAiModule,
        targetId,
        ref,
        inputRef,
        element,
        paths,
        timeoutMs: timeoutMs ?? undefined,
        keepStagedFiles: process.env.BROWSER_KEEP_STAGED_UPLOADS === "true",
      });
      res.json({ ok: true });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/hooks/dialog", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    const accept = toBoolean(body.accept);
    const promptText = toStringOrEmpty(body.promptText) || undefined;
    const timeoutMs = toNumber(body.timeoutMs);
    if (accept === undefined) {
      return jsonError(res, 400, "accept is required");
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await getPwAiModule();
      await pw.armDialogViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        accept,
        promptText,
        timeoutMs: timeoutMs ?? undefined,
      });
      res.json({ ok: true });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/wait/download", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    const out = toStringOrEmpty(body.path) || undefined;
    const timeoutMs = toNumber(body.timeoutMs);
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await getPwAiModule();
      const result = await pw.waitForDownloadViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        path: out,
        timeoutMs: timeoutMs ?? undefined,
      });
      res.json({ ok: true, targetId: tab.targetId, download: result });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/download", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    const ref = toStringOrEmpty(body.ref);
    const out = toStringOrEmpty(body.path);
    const timeoutMs = toNumber(body.timeoutMs);
    if (!ref) {
      return jsonError(res, 400, "ref is required");
    }
    if (!out) {
      return jsonError(res, 400, "path is required");
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await getPwAiModule();
      const result = await pw.downloadViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        ref,
        path: out,
        timeoutMs: timeoutMs ?? undefined,
      });
      res.json({ ok: true, targetId: tab.targetId, download: result });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/screenshot", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    const quality = toNumber(body.quality);
    const requestedType = toStringOrEmpty(body.type);
    let type: "png" | "jpeg";
    try {
      type = requestedType || quality !== undefined && quality !== null ? parseScreenshotType(requestedType || "jpeg") : parseScreenshotType(body.type);
    } catch (err) {
      return jsonError(res, 400, err);
    }
    const ref = toStringOrEmpty(body.ref) || undefined;
    const element = toStringOrEmpty(body.element) || undefined;
    const fullPage = toBoolean(body.fullPage);

    if (ref && element) {
      return jsonError(res, 400, "ref and element are mutually exclusive");
    }
    if ((ref || element) && fullPage) {
      return jsonError(res, 400, "fullPage is only allowed for full-page screenshots");
    }
    if (quality !== undefined && quality !== null) {
      if (type !== "jpeg") {
        return jsonError(res, 400, "quality is only allowed for jpeg screenshots");
      }
      if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
        return jsonError(res, 400, "quality must be an integer between 0 and 100");
      }
    }

    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await getPwAiModule();
      const result = await pw.takeScreenshotViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        ref,
        element,
        fullPage: fullPage === true,
        type,
        quality: quality ?? undefined,
      });
      res.json({
        ok: true,
        targetId: tab.targetId,
        url: tab.url,
        mimeType: type === "jpeg" ? "image/jpeg" : "image/png",
        imageBase64: result.buffer.toString("base64"),
      });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/screenshot/labeled", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    let type: "png" | "jpeg";
    try {
      type = parseScreenshotType(body.type);
    } catch (err) {
      return jsonError(res, 400, err);
    }

    const rawRefs =
      body.refs && typeof body.refs === "object" && !Array.isArray(body.refs)
        ? (body.refs as Record<string, unknown>)
        : null;
    if (!rawRefs) {
      return jsonError(res, 400, "refs object is required");
    }

    const refs: Record<string, { role: string; name?: string; nth?: number }> = {};
    for (const [ref, val] of Object.entries(rawRefs)) {
      if (!val || typeof val !== "object" || Array.isArray(val)) {
        continue;
      }
      const rec = val as Record<string, unknown>;
      const role = toStringOrEmpty(rec.role);
      if (!role) {
        continue;
      }
      const name = toStringOrEmpty(rec.name) || undefined;
      const nth = toNumber(rec.nth);
      refs[ref] = {
        role,
        ...(name ? { name } : {}),
        ...(typeof nth === "number" ? { nth } : {}),
      };
    }

    if (!Object.keys(refs).length) {
      return jsonError(res, 400, "refs must include at least one valid {role,name?,nth?} entry");
    }

    const maxLabels = toNumber(body.maxLabels);

    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await getPwAiModule();
      const result = await pw.screenshotWithLabelsViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        refs,
        maxLabels,
        type,
      });
      res.json({
        ok: true,
        targetId: tab.targetId,
        url: tab.url,
        mimeType: type === "jpeg" ? "image/jpeg" : "image/png",
        imageBase64: result.buffer.toString("base64"),
        labels: result.labels,
        skipped: result.skipped,
      });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/highlight", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    const ref = toStringOrEmpty(body.ref);
    if (!ref) {
      return jsonError(res, 400, "ref is required");
    }
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await getPwAiModule();
      await pw.highlightViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        ref,
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
}
