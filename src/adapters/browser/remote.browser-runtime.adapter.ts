import type { ResolvedBrowserProfile } from '../../config/config.types.js';
import type { IBrowserRuntime, RunningBrowserRuntime } from '../../core/ports/browser-runtime.port.js';
import { createSubsystemLogger } from '../logging/logger.adapter.js';

const log = createSubsystemLogger('remote-browser-runtime');

type BrowserlessSessionCreateResponse = {
  id?: string;
  connect?: string;
  stop?: string;
};

type RemoteBrowserRuntimeAdapterOptions = {
  fetchFn?: typeof fetch;
  ttlMs?: number;
  processKeepAliveMs?: number;
};

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

const DEFAULT_BROWSERLESS_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const DEFAULT_BROWSERLESS_PROCESS_KEEP_ALIVE_MS = 0;

function resolveSessionApiUrl(browserEndpoint: string): URL {
  const url = new URL(browserEndpoint);
  if (url.protocol === 'ws:') {
    url.protocol = 'http:';
  } else if (url.protocol === 'wss:') {
    url.protocol = 'https:';
  }
  url.pathname = '/session';
  url.hash = '';
  return url;
}

export class RemoteBrowserRuntimeAdapter implements IBrowserRuntime {
  private readonly fetchFn: typeof fetch;
  private readonly ttlMs: number;
  private readonly processKeepAliveMs: number;

  constructor(options: RemoteBrowserRuntimeAdapterOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.ttlMs =
      options.ttlMs ?? parseNonNegativeInt(process.env.BROWSER_BROWSERLESS_SESSION_TTL_MS, DEFAULT_BROWSERLESS_SESSION_TTL_MS);
    this.processKeepAliveMs =
      options.processKeepAliveMs ??
      parseNonNegativeInt(
        process.env.BROWSER_BROWSERLESS_PROCESS_KEEP_ALIVE_MS,
        DEFAULT_BROWSERLESS_PROCESS_KEEP_ALIVE_MS,
      );
  }

  async isAvailable(
    _profile: ResolvedBrowserProfile,
    _running?: RunningBrowserRuntime,
  ): Promise<boolean> {
    return true;
  }

  async ensureBrowser(profile: ResolvedBrowserProfile): Promise<RunningBrowserRuntime> {
    const sessionApiUrl = resolveSessionApiUrl(profile.browserEndpoint);
    const body = {
      ttl: this.ttlMs,
      processKeepAlive: this.processKeepAliveMs,
    };

    const response = await this.fetchFn(sessionApiUrl.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const message = await response.text().catch(() => `status ${response.status}`);
      throw new Error(`browserless_session_create_failed:${response.status}:${message}`);
    }

    const session = (await response.json()) as BrowserlessSessionCreateResponse;
    if (!session.connect || !session.stop || !session.id) {
      throw new Error('browserless_session_create_invalid_response');
    }

    log.info('browserless session created', {
      session_id: session.id,
    });

    return {
      provider: profile.provider,
      startedAt: Date.now(),
      browserEndpoint: session.connect,
      browserSessionId: session.id,
      browserStopUrl: session.stop,
    };
  }

  async releaseBrowser(
    _profile: ResolvedBrowserProfile,
    running?: RunningBrowserRuntime,
  ): Promise<void> {
    const stopUrl = running?.browserStopUrl;
    if (!stopUrl) {
      return;
    }

    const stop = new URL(stopUrl);
    if (!stop.searchParams.has('force')) {
      stop.searchParams.set('force', 'true');
    }
    const response = await this.fetchFn(stop.toString(), {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      const message = await response.text().catch(() => `status ${response.status}`);
      throw new Error(`browserless_session_stop_failed:${response.status}:${message}`);
    }

    log.info('browserless session stopped', {
      session_id: running?.browserSessionId,
      status: response.status,
    });
  }
}
