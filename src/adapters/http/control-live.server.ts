import type { Server } from 'node:http';
import { URL } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import { createSubsystemLogger } from '../logging/logger.adapter.js';
import type { BrowserRouteContext } from '../../api/context/browser.context.js';
import { verifyControlToken, type ControlTokenClaims } from '../../shared/utils/control-token.js';
import type { IBrowserDriver } from '../../core/ports/browser-driver.port.js';

const log = createSubsystemLogger('control-live-server');
const FRAME_INTERVAL_MS = Math.max(200, Number(process.env.CONTROL_FRAME_INTERVAL_MS || 350));

type ControlClientMessage =
  | { type: 'init'; targetId?: string }
  | { type: 'click'; x: number; y: number; button?: 'left' | 'middle' | 'right'; clickCount?: number }
  | { type: 'wheel'; deltaX: number; deltaY: number }
  | { type: 'key'; key: string }
  | { type: 'type'; text: string }
  | { type: 'ping' };

function parseClientMessage(raw: WebSocket.RawData): ControlClientMessage | null {
  try {
    const parsed = JSON.parse(raw.toString()) as Record<string, unknown>;
    switch (parsed.type) {
      case 'init':
        return { type: 'init', targetId: typeof parsed.targetId === 'string' ? parsed.targetId : undefined };
      case 'click':
        return {
          type: 'click',
          x: Number(parsed.x),
          y: Number(parsed.y),
          button: ['left', 'middle', 'right'].includes(String(parsed.button))
            ? (parsed.button as 'left' | 'middle' | 'right')
            : 'left',
          clickCount: Number(parsed.clickCount || 1),
        };
      case 'wheel':
        return { type: 'wheel', deltaX: Number(parsed.deltaX || 0), deltaY: Number(parsed.deltaY || 0) };
      case 'key':
        return { type: 'key', key: String(parsed.key || '') };
      case 'type':
        return { type: 'type', text: String(parsed.text || '') };
      case 'ping':
        return { type: 'ping' };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function installControlLiveWebSocketServer(
  server: Server,
  ctx: BrowserRouteContext,
  browserDriver: IBrowserDriver,
): void {
  const wss = new WebSocketServer({ noServer: true });
  const activeByRunId = new Map<string, WebSocket>();
  const claimsBySocket = new WeakMap<WebSocket, ControlTokenClaims>();
  const initialTargetBySocket = new WeakMap<WebSocket, string | undefined>();

  server.on('upgrade', (req, socket, head) => {
    const host = req.headers.host || '127.0.0.1';
    const url = new URL(req.url || '/', `http://${host}`);
    if (url.pathname !== '/control/live') {
      return;
    }

    const token = url.searchParams.get('token') || '';
    let claims: ControlTokenClaims;
    try {
      claims = verifyControlToken(token);
    } catch (error) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      log.warn('control ws auth rejected', { reason: error instanceof Error ? error.message : String(error) });
      return;
    }

    const runId = String(claims.run_id || '');
    wss.handleUpgrade(req, socket, head, (ws) => {
      claimsBySocket.set(ws, claims);
      initialTargetBySocket.set(ws, url.searchParams.get('targetId') || undefined);
      wss.emit('connection', ws);
      if (runId) {
        const previous = activeByRunId.get(runId);
        if (previous && previous !== ws && previous.readyState === WebSocket.OPEN) {
          previous.close(4002, 'replaced_by_new_controller');
        }
        activeByRunId.set(runId, ws);
      }
    });
  });

  wss.on('connection', (ws) => {
    const claims = claimsBySocket.get(ws);
    if (!claims) {
      ws.close(1008, 'missing_claims');
      return;
    }

    const profileCtx = ctx.forProfile('default');
    let targetId = initialTargetBySocket.get(ws);
    let frameBusy = false;

    const sendJson = (payload: Record<string, unknown>) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    const resolvePage = async () => {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      targetId = tab.targetId;
      const browser = await browserDriver.connect(profileCtx.profile.cdpUrl);
      const page = await browserDriver.getPage(browser, tab.targetId);
      return { page, tab };
    };

    const pushFrame = async () => {
      if (frameBusy || ws.readyState !== WebSocket.OPEN) return;
      frameBusy = true;
      try {
        const { page, tab } = await resolvePage();
        const buffer = await page.screenshot({ type: 'jpeg', quality: 60 });
        const viewport = page.viewportSize();
        sendJson({
          type: 'frame',
          mime_type: 'image/jpeg',
          image_base64: buffer.toString('base64'),
          width: viewport?.width ?? 0,
          height: viewport?.height ?? 0,
          targetId: tab.targetId,
          url: page.url(),
          ts: new Date().toISOString(),
        });
      } catch (error) {
        sendJson({ type: 'error', error: error instanceof Error ? error.message : String(error) });
      } finally {
        frameBusy = false;
      }
    };

    const interval = setInterval(() => void pushFrame(), FRAME_INTERVAL_MS);
    void pushFrame();

    ws.on('message', async (raw) => {
      const message = parseClientMessage(raw);
      if (!message) {
        sendJson({ type: 'error', error: 'invalid_message' });
        return;
      }

      try {
        if (message.type === 'ping') {
          sendJson({ type: 'pong', ts: new Date().toISOString() });
          return;
        }

        if (message.type === 'init' && message.targetId) {
          targetId = message.targetId;
          await pushFrame();
          return;
        }

        const { page, tab } = await resolvePage();
        switch (message.type) {
          case 'click':
            await page.mouse.click(message.x, message.y, {
              button: message.button || 'left',
              clickCount: message.clickCount || 1,
            });
            break;
          case 'wheel':
            await page.mouse.wheel(message.deltaX, message.deltaY);
            break;
          case 'key':
            await page.keyboard.press(message.key);
            break;
          case 'type':
            await page.keyboard.type(message.text);
            break;
        }

        sendJson({
          type: 'status',
          ok: true,
          targetId: tab.targetId,
          url: page.url(),
          run_id: claims.run_id ?? null,
        });
        await pushFrame();
      } catch (error) {
        sendJson({ type: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    });

    ws.on('close', () => {
      clearInterval(interval);
      const runId = String(claims.run_id || '');
      if (runId && activeByRunId.get(runId) === ws) {
        activeByRunId.delete(runId);
      }
    });
  });
}
