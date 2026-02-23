import { createHmac, timingSafeEqual } from "node:crypto";
import type { Server } from "node:http";
import { URL } from "node:url";
import WebSocket, { WebSocketServer } from "ws";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { BrowserRouteContext } from "../server-context.js";
import { getPageForTargetId } from "../pw-session.js";

type ControlTokenClaims = {
  exp?: number;
  nbf?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
  scope?: string[];
  token_type?: string;
  run_id?: string;
  browser_session_id?: string;
  tenant_id?: string;
  user_id?: string;
};

type ControlClientMessage =
  | { type: "init"; targetId?: string }
  | { type: "click"; x: number; y: number; button?: "left" | "middle" | "right"; clickCount?: number }
  | { type: "wheel"; deltaX: number; deltaY: number }
  | { type: "key"; key: string }
  | { type: "type"; text: string }
  | { type: "ping" };

const log = createSubsystemLogger("browser-control-live");

const FRAME_INTERVAL_MS = Math.max(200, Number(process.env.CONTROL_FRAME_INTERVAL_MS || 350));
const JWT_ISSUER = process.env.AGENT_RUNTIME_JWT_ISSUER || "tailorec-backend";
const JWT_AUDIENCE = process.env.AGENT_RUNTIME_JWT_AUDIENCE || "tailorec-agent-runtime";

function base64UrlDecode(input: string): Buffer {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  return Buffer.from(padded, "base64");
}

function toJsonObject(input: Buffer): Record<string, unknown> {
  const parsed = JSON.parse(input.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_token_payload");
  }
  return parsed as Record<string, unknown>;
}

export function verifyControlToken(token: string): ControlTokenClaims {
  const secret = process.env.AGENT_RUNTIME_JWT_SECRET || process.env.JWT_SECRET_KEY;
  if (!secret) {
    throw new Error("missing_jwt_secret");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_jwt_format");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = toJsonObject(base64UrlDecode(encodedHeader));
  const payload = toJsonObject(base64UrlDecode(encodedPayload));

  if (header.alg !== "HS256") {
    throw new Error("unsupported_jwt_alg");
  }

  const data = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmac("sha256", secret).update(data).digest();
  const provided = base64UrlDecode(encodedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error("invalid_jwt_signature");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : undefined;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : undefined;

  if (!exp || exp <= now) {
    throw new Error("jwt_expired");
  }
  if (nbf && nbf > now) {
    throw new Error("jwt_not_active");
  }

  if (typeof payload.iss === "string" && payload.iss !== JWT_ISSUER) {
    throw new Error("jwt_bad_issuer");
  }

  const audClaim = payload.aud;
  if (typeof audClaim === "string" && audClaim !== JWT_AUDIENCE) {
    throw new Error("jwt_bad_audience");
  }
  if (Array.isArray(audClaim) && !audClaim.includes(JWT_AUDIENCE)) {
    throw new Error("jwt_bad_audience");
  }

  const scope = Array.isArray(payload.scope) ? payload.scope.filter((v): v is string => typeof v === "string") : [];
  if (!scope.includes("browser:control")) {
    throw new Error("jwt_missing_scope");
  }

  if (payload.token_type !== "agent_browser_control") {
    throw new Error("jwt_bad_token_type");
  }

  return payload as ControlTokenClaims;
}

function parseClientMessage(raw: WebSocket.RawData): ControlClientMessage | null {
  try {
    const parsed = JSON.parse(raw.toString());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const type = String((parsed as Record<string, unknown>).type || "");
    switch (type) {
      case "init":
        return {
          type,
          targetId:
            typeof (parsed as Record<string, unknown>).targetId === "string"
              ? String((parsed as Record<string, unknown>).targetId)
              : undefined,
        };
      case "click":
        return {
          type,
          x: Number((parsed as Record<string, unknown>).x),
          y: Number((parsed as Record<string, unknown>).y),
          button: ["left", "middle", "right"].includes(String((parsed as Record<string, unknown>).button))
            ? (String((parsed as Record<string, unknown>).button) as "left" | "middle" | "right")
            : "left",
          clickCount: Number((parsed as Record<string, unknown>).clickCount || 1),
        };
      case "wheel":
        return {
          type,
          deltaX: Number((parsed as Record<string, unknown>).deltaX || 0),
          deltaY: Number((parsed as Record<string, unknown>).deltaY || 0),
        };
      case "key":
        return {
          type,
          key: String((parsed as Record<string, unknown>).key || ""),
        };
      case "type":
        return {
          type,
          text: String((parsed as Record<string, unknown>).text || ""),
        };
      case "ping":
        return { type };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function installControlLiveWebSocketServer(server: Server, ctx: BrowserRouteContext) {
  const wss = new WebSocketServer({ noServer: true });
  const activeByRunId = new Map<string, WebSocket>();
  const claimsBySocket = new WeakMap<WebSocket, ControlTokenClaims>();
  const initialTargetBySocket = new WeakMap<WebSocket, string | undefined>();

  server.on("upgrade", (req, socket, head) => {
    const host = req.headers.host || "127.0.0.1";
    const url = new URL(req.url || "/", `http://${host}`);

    if (url.pathname !== "/control/live") {
      return;
    }

    const token = url.searchParams.get("token") || "";
    let claims: ControlTokenClaims;
    try {
      claims = verifyControlToken(token);
    } catch (error) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      log.warn("control ws auth rejected", {
        reason: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const runId = String(claims.run_id || "");

    wss.handleUpgrade(req, socket, head, (ws) => {
      claimsBySocket.set(ws, claims);
      initialTargetBySocket.set(ws, url.searchParams.get("targetId") || undefined);
      wss.emit("connection", ws, req);

      if (runId) {
        const prev = activeByRunId.get(runId);
        if (prev && prev !== ws && prev.readyState === WebSocket.OPEN) {
          prev.close(4002, "replaced_by_new_controller");
        }
        activeByRunId.set(runId, ws);
      }
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    const claims = claimsBySocket.get(ws);
    if (!claims) {
      ws.close(1008, "missing_claims");
      return;
    }
    const initialTargetId = initialTargetBySocket.get(ws);
    const runId = String(claims.run_id || "");
    const browserSessionId = String(claims.browser_session_id || "");
    const profile = "default";
    const profileCtx = ctx.forProfile(profile);
    let targetId: string | undefined = initialTargetId;
    let frameBusy = false;

    const sendJson = (payload: Record<string, unknown>) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }
      ws.send(JSON.stringify(payload));
    };

    const resolvePage = async () => {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      targetId = tab.targetId;
      const page = await getPageForTargetId({ cdpUrl: profileCtx.profile.cdpUrl, targetId });
      return { page, tab };
    };

    const pushFrame = async () => {
      if (frameBusy || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      frameBusy = true;
      try {
        const { page, tab } = await resolvePage();
        const buffer = await page.screenshot({ type: "jpeg", quality: 60 });
        const viewport = page.viewportSize();
        sendJson({
          type: "frame",
          mime_type: "image/jpeg",
          image_base64: buffer.toString("base64"),
          width: viewport?.width ?? 0,
          height: viewport?.height ?? 0,
          targetId: tab.targetId,
          url: page.url(),
          ts: new Date().toISOString(),
        });
      } catch (error) {
        sendJson({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        frameBusy = false;
      }
    };

    sendJson({
      type: "hello",
      run_id: runId,
      browser_session_id: browserSessionId,
      targetId,
      frame_interval_ms: FRAME_INTERVAL_MS,
    });

    const timer = setInterval(() => {
      void pushFrame();
    }, FRAME_INTERVAL_MS);
    void pushFrame();

    ws.on("message", async (raw) => {
      const msg = parseClientMessage(raw);
      if (!msg) {
        sendJson({ type: "error", error: "invalid_message" });
        return;
      }

      try {
        if (msg.type === "init") {
          targetId = msg.targetId || targetId;
          const { tab, page } = await resolvePage();
          sendJson({
            type: "status",
            ok: true,
            targetId: tab.targetId,
            url: page.url(),
          });
          return;
        }

        if (msg.type === "ping") {
          sendJson({ type: "pong", ts: new Date().toISOString() });
          return;
        }

        const { page } = await resolvePage();

        if (msg.type === "click") {
          await page.mouse.click(msg.x, msg.y, {
            button: msg.button ?? "left",
            clickCount: Math.max(1, msg.clickCount || 1),
          });
          sendJson({ type: "ack", action: "click" });
          return;
        }

        if (msg.type === "wheel") {
          await page.mouse.wheel(msg.deltaX, msg.deltaY);
          sendJson({ type: "ack", action: "wheel" });
          return;
        }

        if (msg.type === "key") {
          await page.keyboard.press(msg.key);
          sendJson({ type: "ack", action: "key", key: msg.key });
          return;
        }

        if (msg.type === "type") {
          if (msg.text.trim().length === 0) {
            sendJson({ type: "error", error: "type_text_required" });
            return;
          }
          await page.keyboard.type(msg.text);
          sendJson({ type: "ack", action: "type", size: msg.text.length });
          return;
        }
      } catch (error) {
        sendJson({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    ws.on("close", () => {
      clearInterval(timer);
      if (runId && activeByRunId.get(runId) === ws) {
        activeByRunId.delete(runId);
      }
    });
  });

  log.info("control live websocket installed", {
    path: "/control/live",
    frame_interval_ms: FRAME_INTERVAL_MS,
  });
}
