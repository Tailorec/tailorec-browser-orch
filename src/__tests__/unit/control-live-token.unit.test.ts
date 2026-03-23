import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyControlToken } from "../../browser/routes/control-live.js";

const backupEnv = { ...process.env };

function b64url(data: string) {
  return Buffer.from(data).toString("base64url");
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const body = `${encodedHeader}.${encodedPayload}`;
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

afterEach(() => {
  process.env = { ...backupEnv };
});

describe("verifyControlToken", () => {
  it("accepts valid token", () => {
    process.env.AGENT_RUNTIME_JWT_SECRET = "secret";

    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      {
        exp: now + 600,
        iat: now,
        iss: "tailorec-backend",
        aud: "tailorec-agent-runtime",
        scope: ["browser:control"],
        token_type: "agent_browser_control",
        run_id: "run-1",
      },
      "secret",
    );

    const claims = verifyControlToken(token);
    expect(claims.run_id).toBe("run-1");
  });

  it("rejects expired token", () => {
    process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      {
        exp: now - 1,
        scope: ["browser:control"],
        token_type: "agent_browser_control",
      },
      "secret",
    );

    expect(() => verifyControlToken(token)).toThrow("jwt_expired");
  });

  it("rejects missing scope", () => {
    process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      {
        exp: now + 10,
        scope: ["other:scope"],
        token_type: "agent_browser_control",
      },
      "secret",
    );

    expect(() => verifyControlToken(token)).toThrow("jwt_missing_scope");
  });
});
