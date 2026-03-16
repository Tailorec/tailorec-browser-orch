import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { createServer } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { createSubsystemLogger } from '../logging/logger.adapter.js';
import {
  RELAY_AUTH_HEADER,
  isLoopbackAddress,
  parseBaseUrl,
  generateRelayAuthToken,
  headerValue,
  getHeader,
} from './extension-relay.utils.js';
import type {
  CdpCommand,
  CdpResponse,
  CdpEvent,
  ExtensionForwardCommandMessage,
  ExtensionMessage,
  ExtensionPongMessage,
  ExtensionForwardEventMessage,
  AttachedToTargetEvent,
  DetachedFromTargetEvent,
  ConnectedTarget,
  ChromeExtensionRelayServer,
} from './extension-relay.types.js';

const log = createSubsystemLogger('extension-relay-server');

/**
 * Internal state for the extension relay server.
 */
type RelayServerState = {
  extensionWs: WebSocket | null;
  cdpClients: Set<WebSocket>;
  connectedTargets: Map<string, ConnectedTarget>;
  pendingExtension: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>;
  nextExtensionId: number;
  relayAuthToken: string;
};

/**
 * Cache of relay servers by port.
 */
const serversByPort = new Map<number, ChromeExtensionRelayServer>();
const relayAuthByPort = new Map<number, string>();
const serverStates = new Map<number, RelayServerState>();

/**
 * Create an HTTP response with text body.
 */
function text(res: Duplex, status: number, bodyText: string): void {
  const body = Buffer.from(bodyText);
  res.write(
    `HTTP/1.1 ${status} ${status === 200 ? 'OK' : 'ERR'}\r\n` +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      `Content-Length: ${body.length}\r\n` +
      'Connection: close\r\n' +
      '\r\n',
  );
  res.write(body);
  res.end();
}

/**
 * Reject a WebSocket upgrade request.
 */
function rejectUpgrade(socket: Duplex, status: number, bodyText: string): void {
  text(socket, status, bodyText);
  try {
    socket.destroy();
  } catch {
    // ignore
  }
}

/**
 * Create the HTTP server with JSON endpoints.
 */
function createHttpServer(
  state: RelayServerState,
  info: { host: string; port: number; baseUrl: string },
) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', info.baseUrl);
    const path = url.pathname;

    // Auth check for /json endpoints
    if (path.startsWith('/json')) {
      const token = getHeader(req, RELAY_AUTH_HEADER);
      if (!token || token !== state.relayAuthToken) {
        res.writeHead(401);
        res.end('Unauthorized');
        return;
      }
    }

    // HEAD /
    if (req.method === 'HEAD' && path === '/') {
      res.writeHead(200);
      res.end();
      return;
    }

    // GET /
    if (path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('OK');
      return;
    }

    // GET /extension/status
    if (path === '/extension/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ connected: Boolean(state.extensionWs) }));
      return;
    }

    const hostHeader = req.headers.host?.trim() || `${info.host}:${info.port}`;
    const wsHost = `ws://${hostHeader}`;
    const cdpWsUrl = `${wsHost}/cdp`;

    // GET /json/version
    if ((path === '/json/version' || path === '/json/version/') && (req.method === 'GET' || req.method === 'PUT')) {
      const payload: Record<string, unknown> = {
        Browser: 'OpenClaw/extension-relay',
        'Protocol-Version': '1.3',
      };
      if (state.extensionWs) {
        payload.webSocketDebuggerUrl = cdpWsUrl;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    // GET /json/list
    const listPaths = new Set(['/json', '/json/', '/json/list', '/json/list/']);
    if (listPaths.has(path) && (req.method === 'GET' || req.method === 'PUT')) {
      const list = Array.from(state.connectedTargets.values()).map((t) => ({
        id: t.targetId,
        type: t.targetInfo.type ?? 'page',
        title: t.targetInfo.title ?? '',
        description: t.targetInfo.title ?? '',
        url: t.targetInfo.url ?? '',
        webSocketDebuggerUrl: cdpWsUrl,
        devtoolsFrontendUrl: `/devtools/inspector.html?ws=${cdpWsUrl.replace('ws://', '')}`,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(list));
      return;
    }

    // GET /json/activate/:targetId
    const activateMatch = path.match(/^\/json\/activate\/(.+)$/);
    if (activateMatch && (req.method === 'GET' || req.method === 'PUT')) {
      const targetId = decodeURIComponent(activateMatch[1] ?? '').trim();
      if (!targetId) {
        res.writeHead(400);
        res.end('targetId required');
        return;
      }
      void (async () => {
        try {
          await sendToExtension(state, {
            id: state.nextExtensionId++,
            method: 'forwardCDPCommand',
            params: { method: 'Target.activateTarget', params: { targetId } },
          });
        } catch {
          // ignore
        }
      })();
      res.writeHead(200);
      res.end('OK');
      return;
    }

    // GET /json/close/:targetId
    const closeMatch = path.match(/^\/json\/close\/(.+)$/);
    if (closeMatch && (req.method === 'GET' || req.method === 'PUT')) {
      const targetId = decodeURIComponent(closeMatch[1] ?? '').trim();
      if (!targetId) {
        res.writeHead(400);
        res.end('targetId required');
        return;
      }
      void (async () => {
        try {
          await sendToExtension(state, {
            id: state.nextExtensionId++,
            method: 'forwardCDPCommand',
            params: { method: 'Target.closeTarget', params: { targetId } },
          });
        } catch {
          // ignore
        }
      })();
      res.writeHead(200);
      res.end('OK');
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  return server;
}

/**
 * Send a message to the extension and wait for response.
 */
async function sendToExtension(
  state: RelayServerState,
  payload: ExtensionForwardCommandMessage,
): Promise<unknown> {
  const ws = state.extensionWs;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Chrome extension not connected');
  }
  ws.send(JSON.stringify(payload));

  return await new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pendingExtension.delete(payload.id);
      reject(new Error(`extension request timeout: ${payload.params.method}`));
    }, 30_000);
    state.pendingExtension.set(payload.id, { resolve, reject, timer });
  });
}

/**
 * Broadcast an event to all CDP clients.
 */
function broadcastToCdpClients(state: RelayServerState, evt: CdpEvent): void {
  const msg = JSON.stringify(evt);
  for (const ws of state.cdpClients) {
    if (ws.readyState !== WebSocket.OPEN) {
      continue;
    }
    ws.send(msg);
  }
}

/**
 * Send a response to a CDP client.
 */
function sendResponseToCdp(state: RelayServerState, ws: WebSocket, res: CdpResponse): void {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify(res));
}

/**
 * Ensure target events are sent to a client.
 */
function ensureTargetEventsForClient(
  state: RelayServerState,
  ws: WebSocket,
  mode: 'autoAttach' | 'discover',
): void {
  for (const target of state.connectedTargets.values()) {
    if (mode === 'autoAttach') {
      ws.send(
        JSON.stringify({
          method: 'Target.attachedToTarget',
          params: {
            sessionId: target.sessionId,
            targetInfo: { ...target.targetInfo, attached: true },
            waitingForDebugger: false,
          },
        } satisfies CdpEvent),
      );
    } else {
      ws.send(
        JSON.stringify({
          method: 'Target.targetCreated',
          params: { targetInfo: { ...target.targetInfo, attached: true } },
        } satisfies CdpEvent),
      );
    }
  }
}

/**
 * Route a CDP command.
 */
async function routeCdpCommand(state: RelayServerState, cmd: CdpCommand): Promise<unknown> {
  switch (cmd.method) {
    case 'Browser.getVersion':
      return {
        protocolVersion: '1.3',
        product: 'Chrome/OpenClaw-Extension-Relay',
        revision: '0',
        userAgent: 'OpenClaw-Extension-Relay',
        jsVersion: 'V8',
      };
    case 'Browser.setDownloadBehavior':
      return {};
    case 'Target.setAutoAttach':
    case 'Target.setDiscoverTargets':
      return {};
    case 'Target.getTargets':
      return {
        targetInfos: Array.from(state.connectedTargets.values()).map((t) => ({
          ...t.targetInfo,
          attached: true,
        })),
      };
    case 'Target.getTargetInfo': {
      const params = (cmd.params ?? {}) as { targetId?: string };
      const targetId = typeof params.targetId === 'string' ? params.targetId : undefined;
      if (targetId) {
        for (const t of state.connectedTargets.values()) {
          if (t.targetId === targetId) {
            return { targetInfo: t.targetInfo };
          }
        }
      }
      if (cmd.sessionId && state.connectedTargets.has(cmd.sessionId)) {
        const t = state.connectedTargets.get(cmd.sessionId);
        if (t) {
          return { targetInfo: t.targetInfo };
        }
      }
      const first = Array.from(state.connectedTargets.values())[0];
      return { targetInfo: first?.targetInfo };
    }
    case 'Target.attachToTarget': {
      const params = (cmd.params ?? {}) as { targetId?: string };
      const targetId = typeof params.targetId === 'string' ? params.targetId : undefined;
      if (!targetId) {
        throw new Error('targetId required');
      }
      for (const t of state.connectedTargets.values()) {
        if (t.targetId === targetId) {
          return { sessionId: t.sessionId };
        }
      }
      throw new Error('target not found');
    }
    default: {
      const id = state.nextExtensionId++;
      return await sendToExtension(state, {
        id,
        method: 'forwardCDPCommand',
        params: {
          method: cmd.method,
          sessionId: cmd.sessionId,
          params: cmd.params,
        },
      });
    }
  }
}

/**
 * Start a Chrome extension relay server.
 */
export async function startChromeExtensionRelayServer(opts: {
  cdpUrl: string;
}): Promise<ChromeExtensionRelayServer> {
  const info = parseBaseUrl(opts.cdpUrl);

  if (!isLoopbackAddress(info.host)) {
    throw new Error(`extension relay requires loopback cdpUrl host (got ${info.host})`);
  }

  const existing = serversByPort.get(info.port);
  if (existing) {
    return existing;
  }

  const state: RelayServerState = {
    extensionWs: null,
    cdpClients: new Set(),
    connectedTargets: new Map(),
    pendingExtension: new Map(),
    nextExtensionId: 1,
    relayAuthToken: generateRelayAuthToken(),
  };

  const server = createHttpServer(state, info);
  const wssExtension = new WebSocketServer({ noServer: true });
  const wssCdp = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrades
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', info.baseUrl);
    const pathname = url.pathname;
    const remote = req.socket.remoteAddress;

    if (!isLoopbackAddress(remote)) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    const origin = headerValue(req.headers.origin);
    if (origin && !origin.startsWith('chrome-extension://')) {
      rejectUpgrade(socket, 403, 'Forbidden: invalid origin');
      return;
    }

    if (pathname === '/extension') {
      if (state.extensionWs) {
        rejectUpgrade(socket, 409, 'Extension already connected');
        return;
      }
      wssExtension.handleUpgrade(req, socket, head, (ws) => {
        wssExtension.emit('connection', ws, req);
      });
      return;
    }

    if (pathname === '/cdp') {
      const token = getHeader(req, RELAY_AUTH_HEADER);
      if (!token || token !== state.relayAuthToken) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }
      if (!state.extensionWs) {
        rejectUpgrade(socket, 503, 'Extension not connected');
        return;
      }
      wssCdp.handleUpgrade(req, socket, head, (ws) => {
        wssCdp.emit('connection', ws, req);
      });
      return;
    }

    rejectUpgrade(socket, 404, 'Not Found');
  });

  // Handle extension connections
  wssExtension.on('connection', (ws) => {
    state.extensionWs = ws;
    log.info('extension connected');

    const ping = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }
      ws.send(JSON.stringify({ method: 'ping' }));
    }, 5000);

    ws.on('message', (data) => {
      let parsed: ExtensionMessage | null = null;
      try {
        parsed = JSON.parse(data.toString()) as ExtensionMessage;
      } catch {
        return;
      }

      // Handle response with id
      if (parsed && typeof parsed === 'object' && 'id' in parsed && typeof parsed.id === 'number') {
        const pending = state.pendingExtension.get(parsed.id);
        if (!pending) {
          return;
        }
        state.pendingExtension.delete(parsed.id);
        clearTimeout(pending.timer);
        if ('error' in parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
          pending.reject(new Error(parsed.error));
        } else {
          pending.resolve(parsed.result);
        }
        return;
      }

      // Handle events
      if (parsed && typeof parsed === 'object' && 'method' in parsed) {
        if ((parsed as ExtensionPongMessage).method === 'pong') {
          return;
        }
        if ((parsed as ExtensionForwardEventMessage).method !== 'forwardCDPEvent') {
          return;
        }
        const evt = parsed as ExtensionForwardEventMessage;
        const method = evt.params?.method;
        const params = evt.params?.params;
        const sessionId = evt.params?.sessionId;

        if (!method || typeof method !== 'string') {
          return;
        }

        // Handle attachedToTarget
        if (method === 'Target.attachedToTarget') {
          const attached = (params ?? {}) as AttachedToTargetEvent;
          const targetType = attached?.targetInfo?.type ?? 'page';
          if (targetType !== 'page') {
            return;
          }
          if (attached?.sessionId && attached?.targetInfo?.targetId) {
            const prev = state.connectedTargets.get(attached.sessionId);
            const nextTargetId = attached.targetInfo.targetId;
            const prevTargetId = prev?.targetId;
            const changedTarget = Boolean(prev && prevTargetId && prevTargetId !== nextTargetId);

            state.connectedTargets.set(attached.sessionId, {
              sessionId: attached.sessionId,
              targetId: nextTargetId,
              targetInfo: attached.targetInfo,
            });

            if (changedTarget && prevTargetId) {
              broadcastToCdpClients(state, {
                method: 'Target.detachedFromTarget',
                params: { sessionId: attached.sessionId, targetId: prevTargetId },
                sessionId: attached.sessionId,
              });
            }
            if (!prev || changedTarget) {
              broadcastToCdpClients(state, { method, params, sessionId });
            }
            return;
          }
        }

        // Handle detachedFromTarget
        if (method === 'Target.detachedFromTarget') {
          const detached = (params ?? {}) as DetachedFromTargetEvent;
          if (detached?.sessionId) {
            state.connectedTargets.delete(detached.sessionId);
          }
          broadcastToCdpClients(state, { method, params, sessionId });
          return;
        }

        // Handle targetInfoChanged
        if (method === 'Target.targetInfoChanged') {
          const changed = (params ?? {}) as { targetInfo?: { targetId?: string; type?: string } };
          const targetInfo = changed?.targetInfo;
          const targetId = targetInfo?.targetId;
          if (targetId && (targetInfo?.type ?? 'page') === 'page') {
            for (const [sid, target] of state.connectedTargets) {
              if (target.targetId !== targetId) {
                continue;
              }
              state.connectedTargets.set(sid, {
                ...target,
                targetInfo: { ...target.targetInfo, ...(targetInfo as object) },
              });
            }
          }
        }

        broadcastToCdpClients(state, { method, params, sessionId });
      }
    });

    ws.on('close', () => {
      clearInterval(ping);
      state.extensionWs = null;
      log.info('extension disconnected');

      for (const [, pending] of state.pendingExtension) {
        clearTimeout(pending.timer);
        pending.reject(new Error('extension disconnected'));
      }
      state.pendingExtension.clear();
      state.connectedTargets.clear();

      for (const client of state.cdpClients) {
        try {
          client.close(1011, 'extension disconnected');
        } catch {
          // ignore
        }
      }
      state.cdpClients.clear();
    });
  });

  // Handle CDP client connections
  wssCdp.on('connection', (ws) => {
    state.cdpClients.add(ws);
    log.debug('cdp client connected');

    ws.on('message', async (data) => {
      let cmd: CdpCommand | null = null;
      try {
        cmd = JSON.parse(data.toString()) as CdpCommand;
      } catch {
        return;
      }

      if (!cmd || typeof cmd !== 'object') {
        return;
      }
      if (typeof cmd.id !== 'number' || typeof cmd.method !== 'string') {
        return;
      }

      if (!state.extensionWs) {
        sendResponseToCdp(state, ws, {
          id: cmd.id,
          sessionId: cmd.sessionId,
          error: { message: 'Extension not connected' },
        });
        return;
      }

      try {
        const result = await routeCdpCommand(state, cmd);

        if (cmd.method === 'Target.setAutoAttach' && !cmd.sessionId) {
          ensureTargetEventsForClient(state, ws, 'autoAttach');
        }
        if (cmd.method === 'Target.setDiscoverTargets') {
          const discover = (cmd.params ?? {}) as { discover?: boolean };
          if (discover.discover === true) {
            ensureTargetEventsForClient(state, ws, 'discover');
          }
        }
        if (cmd.method === 'Target.attachToTarget') {
          const params = (cmd.params ?? {}) as { targetId?: string };
          const targetId = typeof params.targetId === 'string' ? params.targetId : undefined;
          if (targetId) {
            const target = Array.from(state.connectedTargets.values()).find(
              (t) => t.targetId === targetId,
            );
            if (target) {
              ws.send(
                JSON.stringify({
                  method: 'Target.attachedToTarget',
                  params: {
                    sessionId: target.sessionId,
                    targetInfo: { ...target.targetInfo, attached: true },
                    waitingForDebugger: false,
                  },
                } satisfies CdpEvent),
              );
            }
          }
        }

        sendResponseToCdp(state, ws, { id: cmd.id, sessionId: cmd.sessionId, result });
      } catch (err) {
        sendResponseToCdp(state, ws, {
          id: cmd.id,
          sessionId: cmd.sessionId,
          error: { message: err instanceof Error ? err.message : String(err) },
        });
      }
    });

    ws.on('close', () => {
      state.cdpClients.delete(ws);
      log.debug('cdp client disconnected');
    });
  });

  // Start the server
  await new Promise<void>((resolve, reject) => {
    server.listen(info.port, info.host, () => resolve());
    server.once('error', reject);
  });

  const addr = server.address() as AddressInfo | null;
  const port = addr?.port ?? info.port;
  const host = info.host;
  const baseUrl = `${new URL(info.baseUrl).protocol}//${host}:${port}`;

  const relay: ChromeExtensionRelayServer = {
    host,
    port,
    baseUrl,
    cdpWsUrl: `ws://${host}:${port}/cdp`,
    extensionConnected: () => Boolean(state.extensionWs),
    stop: async () => {
      serversByPort.delete(port);
      relayAuthByPort.delete(port);
      serverStates.delete(port);

      try {
        state.extensionWs?.close(1001, 'server stopping');
      } catch {
        // ignore
      }

      for (const ws of state.cdpClients) {
        try {
          ws.close(1001, 'server stopping');
        } catch {
          // ignore
        }
      }

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });

      wssExtension.close();
      wssCdp.close();
      log.info('relay server stopped', { port });
    },
  };

  relayAuthByPort.set(port, state.relayAuthToken);
  serversByPort.set(port, relay);
  serverStates.set(port, state);

  log.info('relay server started', { port, host });
  return relay;
}

/**
 * Stop a Chrome extension relay server.
 */
export async function stopChromeExtensionRelayServer(opts: {
  cdpUrl: string;
}): Promise<boolean> {
  const info = parseBaseUrl(opts.cdpUrl);
  const existing = serversByPort.get(info.port);

  if (!existing) {
    return false;
  }

  await existing.stop();
  relayAuthByPort.delete(info.port);
  return true;
}

/**
 * Get auth headers for a URL.
 */
export function getChromeExtensionRelayAuthHeaders(url: string): Record<string, string> {
  try {
    const parsed = new URL(url);
    const port =
      parsed.port?.trim() !== ''
        ? Number(parsed.port)
        : parsed.protocol === 'https:' || parsed.protocol === 'wss:'
          ? 443
          : 80;

    const token = relayAuthByPort.get(port);
    if (!token) {
      return {};
    }

    return { [RELAY_AUTH_HEADER]: token };
  } catch {
    return {};
  }
}
