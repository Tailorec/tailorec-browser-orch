import type {
  BrowserConsoleMessage,
  BrowserNetworkRequest,
  BrowserPageError,
} from "./pw-session.js";
import { ensurePageState, getPageForTargetId } from "./pw-session.js";
import { createSubsystemLogger } from "../adapters/logging/pino-logger.adapter.js";

const log = createSubsystemLogger("pw-activity");

export async function getPageErrorsViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  clear?: boolean;
}): Promise<{ errors: BrowserPageError[] }> {
  const started = Date.now();
  const page = await getPageForTargetId(opts);
  const state = ensurePageState(page);
  const errors = [...state.errors];
  if (opts.clear) {
    state.errors = [];
  }
  log.debug("retrieved page errors", {
    cdp_url: opts.cdpUrl,
    target_id: opts.targetId,
    clear: Boolean(opts.clear),
    count: errors.length,
    duration_ms: Date.now() - started,
  });
  return { errors };
}

export async function getNetworkRequestsViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  filter?: string;
  clear?: boolean;
}): Promise<{ requests: BrowserNetworkRequest[] }> {
  const started = Date.now();
  const page = await getPageForTargetId(opts);
  const state = ensurePageState(page);
  const raw = [...state.requests];
  const filter = typeof opts.filter === "string" ? opts.filter.trim() : "";
  const requests = filter ? raw.filter((r) => r.url.includes(filter)) : raw;
  if (opts.clear) {
    state.requests = [];
    state.requestIds = new WeakMap();
  }
  log.debug("retrieved network requests", {
    cdp_url: opts.cdpUrl,
    target_id: opts.targetId,
    clear: Boolean(opts.clear),
    filter: filter || undefined,
    count: requests.length,
    duration_ms: Date.now() - started,
  });
  return { requests };
}

function consolePriority(level: string) {
  switch (level) {
    case "error":
      return 3;
    case "warning":
      return 2;
    case "info":
    case "log":
      return 1;
    case "debug":
      return 0;
    default:
      return 1;
  }
}

export async function getConsoleMessagesViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  level?: string;
}): Promise<BrowserConsoleMessage[]> {
  const started = Date.now();
  const page = await getPageForTargetId(opts);
  const state = ensurePageState(page);
  if (!opts.level) {
    const all = [...state.console];
    log.debug("retrieved console messages", {
      cdp_url: opts.cdpUrl,
      target_id: opts.targetId,
      level: opts.level,
      count: all.length,
      duration_ms: Date.now() - started,
    });
    return all;
  }
  const min = consolePriority(opts.level);
  const filtered = state.console.filter((msg) => consolePriority(msg.type) >= min);
  log.debug("retrieved console messages", {
    cdp_url: opts.cdpUrl,
    target_id: opts.targetId,
    level: opts.level,
    count: filtered.length,
    duration_ms: Date.now() - started,
  });
  return filtered;
}
