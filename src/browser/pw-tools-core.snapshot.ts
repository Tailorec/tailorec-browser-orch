import { type AriaSnapshotNode, formatAriaSnapshot, type RawAXNode } from "./cdp.js";
import {
  buildRoleSnapshotFromAiSnapshot,
  buildRoleSnapshotFromAriaSnapshot,
  getRoleSnapshotStats,
  type RoleSnapshotOptions,
  type RoleRefMap,
} from "./pw-role-snapshot.js";
import {
  ensurePageState,
  getPageForTargetId,
  storeRoleRefsForTarget,
  type WithSnapshotForAI,
} from "./pw-session.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("pw-snapshot");

export async function snapshotAriaViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  limit?: number;
}): Promise<{ nodes: AriaSnapshotNode[] }> {
  const started = Date.now();
  log.debug("snapshot aria started", { cdp_url: opts.cdpUrl, target_id: opts.targetId, limit: opts.limit });
  const limit = Math.max(1, Math.min(2000, Math.floor(opts.limit ?? 500)));
  const page = await getPageForTargetId({
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId,
  });
  ensurePageState(page);
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Accessibility.enable").catch(() => {});
    const res = (await session.send("Accessibility.getFullAXTree")) as {
      nodes?: RawAXNode[];
    };
    const nodes = Array.isArray(res?.nodes) ? res.nodes : [];
    const out = { nodes: formatAriaSnapshot(nodes, limit) };
    log.info("snapshot aria succeeded", {
      cdp_url: opts.cdpUrl,
      target_id: opts.targetId,
      nodes: out.nodes.length,
      duration_ms: Date.now() - started,
    });
    return out;
  } finally {
    await session.detach().catch(() => {});
  }
}

export async function snapshotAiViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  timeoutMs?: number;
  maxChars?: number;
}): Promise<{ snapshot: string; truncated?: boolean; refs: RoleRefMap }> {
  const started = Date.now();
  log.debug("snapshot ai started", { cdp_url: opts.cdpUrl, target_id: opts.targetId, max_chars: opts.maxChars });
  const page = await getPageForTargetId({
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId,
  });
  ensurePageState(page);

  const maybe = page as unknown as WithSnapshotForAI;
  if (!maybe._snapshotForAI) {
    throw new Error("Playwright _snapshotForAI is not available. Upgrade playwright-core.");
  }

  const result = await maybe._snapshotForAI({
    timeout: Math.max(500, Math.min(60_000, Math.floor(opts.timeoutMs ?? 5000))),
    track: "response",
  });
  let snapshot = String(result?.full ?? "");
  const maxChars = opts.maxChars;
  const limit =
    typeof maxChars === "number" && Number.isFinite(maxChars) && maxChars > 0
      ? Math.floor(maxChars)
      : undefined;
  let truncated = false;
  if (limit && snapshot.length > limit) {
    snapshot = `${snapshot.slice(0, limit)}\n\n[...TRUNCATED - page too large]`;
    truncated = true;
  }

  const built = buildRoleSnapshotFromAiSnapshot(snapshot);
  storeRoleRefsForTarget({
    page,
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId,
    refs: built.refs,
    mode: "aria",
  });
  const response = truncated ? { snapshot, truncated, refs: built.refs } : { snapshot, refs: built.refs };
  log.info("snapshot ai succeeded", {
    cdp_url: opts.cdpUrl,
    target_id: opts.targetId,
    chars: snapshot.length,
    refs: Object.keys(built.refs).length,
    truncated,
    duration_ms: Date.now() - started,
  });
  return response;
}

export async function snapshotRoleViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  selector?: string;
  frameSelector?: string;
  refsMode?: "role" | "aria";
  options?: RoleSnapshotOptions;
}): Promise<{
  snapshot: string;
  refs: Record<string, { role: string; name?: string; nth?: number }>;
  stats: { lines: number; chars: number; refs: number; interactive: number };
}> {
  const started = Date.now();
  log.debug("snapshot role started", {
    cdp_url: opts.cdpUrl,
    target_id: opts.targetId,
    refs_mode: opts.refsMode ?? "role",
    selector: opts.selector,
    frame_selector: opts.frameSelector,
  });
  const page = await getPageForTargetId({
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId,
  });
  ensurePageState(page);

  if (opts.refsMode === "aria") {
    if (opts.selector?.trim() || opts.frameSelector?.trim()) {
      throw new Error("refs=aria does not support selector/frame snapshots yet.");
    }
    const maybe = page as unknown as WithSnapshotForAI;
    if (!maybe._snapshotForAI) {
      throw new Error("refs=aria requires Playwright _snapshotForAI support.");
    }
    const result = await maybe._snapshotForAI({
      timeout: 5000,
      track: "response",
    });
    const built = buildRoleSnapshotFromAiSnapshot(String(result?.full ?? ""), opts.options);
    storeRoleRefsForTarget({
      page,
      cdpUrl: opts.cdpUrl,
      targetId: opts.targetId,
      refs: built.refs,
      mode: "aria",
    });
    const out = {
      snapshot: built.snapshot,
      refs: built.refs,
      stats: getRoleSnapshotStats(built.snapshot, built.refs),
    };
    log.info("snapshot role succeeded", {
      cdp_url: opts.cdpUrl,
      target_id: opts.targetId,
      refs: Object.keys(out.refs).length,
      chars: out.snapshot.length,
      duration_ms: Date.now() - started,
    });
    return out;
  }

  const frameSelector = opts.frameSelector?.trim() || "";
  const selector = opts.selector?.trim() || "";
  const locator = frameSelector
    ? selector
      ? page.frameLocator(frameSelector).locator(selector)
      : page.frameLocator(frameSelector).locator(":root")
    : selector
      ? page.locator(selector)
      : page.locator(":root");

  const ariaSnapshot = await locator.ariaSnapshot();
  const built = buildRoleSnapshotFromAriaSnapshot(String(ariaSnapshot ?? ""), opts.options);
  storeRoleRefsForTarget({
    page,
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId,
    refs: built.refs,
    frameSelector: frameSelector || undefined,
    mode: "role",
  });
  const out = {
    snapshot: built.snapshot,
    refs: built.refs,
    stats: getRoleSnapshotStats(built.snapshot, built.refs),
  };
  log.info("snapshot role succeeded", {
    cdp_url: opts.cdpUrl,
    target_id: opts.targetId,
    refs: Object.keys(out.refs).length,
    chars: out.snapshot.length,
    duration_ms: Date.now() - started,
  });
  return out;
}

export async function navigateViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  url: string;
  timeoutMs?: number;
}): Promise<{ url: string }> {
  const started = Date.now();
  log.info("navigate started", { cdp_url: opts.cdpUrl, target_id: opts.targetId, url: opts.url });
  const url = String(opts.url ?? "").trim();
  if (!url) {
    throw new Error("url is required");
  }
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.goto(url, {
    timeout: Math.max(1000, Math.min(120_000, opts.timeoutMs ?? 20_000)),
  });
  const result = { url: page.url() };
  log.info("navigate succeeded", { cdp_url: opts.cdpUrl, target_id: opts.targetId, url: result.url, duration_ms: Date.now() - started });
  return result;
}

export async function resizeViewportViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  width: number;
  height: number;
}): Promise<void> {
  const started = Date.now();
  log.debug("resize started", { cdp_url: opts.cdpUrl, target_id: opts.targetId, width: opts.width, height: opts.height });
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.setViewportSize({
    width: Math.max(1, Math.floor(opts.width)),
    height: Math.max(1, Math.floor(opts.height)),
  });
  log.info("resize succeeded", { cdp_url: opts.cdpUrl, target_id: opts.targetId, duration_ms: Date.now() - started });
}

export async function closePageViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
}): Promise<void> {
  const started = Date.now();
  log.info("close page started", { cdp_url: opts.cdpUrl, target_id: opts.targetId });
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.close();
  log.info("close page succeeded", { cdp_url: opts.cdpUrl, target_id: opts.targetId, duration_ms: Date.now() - started });
}

export async function pdfViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
}): Promise<{ buffer: Buffer }> {
  const started = Date.now();
  log.debug("pdf generation started", { cdp_url: opts.cdpUrl, target_id: opts.targetId });
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const buffer = await page.pdf({ printBackground: true });
  log.info("pdf generation succeeded", { cdp_url: opts.cdpUrl, target_id: opts.targetId, bytes: buffer.length, duration_ms: Date.now() - started });
  return { buffer };
}
