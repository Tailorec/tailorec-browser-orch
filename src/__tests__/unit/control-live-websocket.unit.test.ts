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

describe("control-live-websocket", () => {
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

    it("rejects token with bad issuer", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      process.env.AGENT_RUNTIME_JWT_ISSUER = "expected-issuer";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          iss: "wrong-issuer",
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      expect(() => verifyControlToken(token)).toThrow("jwt_bad_issuer");
    });

    it("rejects token with bad audience", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      process.env.AGENT_RUNTIME_JWT_AUDIENCE = "expected-audience";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          aud: "wrong-audience",
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      expect(() => verifyControlToken(token)).toThrow("jwt_bad_audience");
    });

    it("accepts token with audience array", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      process.env.AGENT_RUNTIME_JWT_AUDIENCE = "tailorec-agent-runtime";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          aud: ["other-audience", "tailorec-agent-runtime"],
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      const claims = verifyControlToken(token);
      expect(claims.aud).toEqual(["other-audience", "tailorec-agent-runtime"]);
    });

    it("rejects token with bad token_type", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          scope: ["browser:control"],
          token_type: "wrong_type",
        },
        "secret",
      );

      expect(() => verifyControlToken(token)).toThrow("jwt_bad_token_type");
    });

    it("rejects token with invalid signature", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      // Tamper with the signature
      const parts = token.split(".");
      parts[2] = "invalid_signature";
      const tamperedToken = parts.join(".");

      expect(() => verifyControlToken(tamperedToken)).toThrow("invalid_jwt_signature");
    });

    it("rejects token with wrong algorithm", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const header = { alg: "HS512", typ: "JWT" };
      const payload = { exp: Math.floor(Date.now() / 1000) + 600 };
      const encodedHeader = b64url(JSON.stringify(header));
      const encodedPayload = b64url(JSON.stringify(payload));
      const body = `${encodedHeader}.${encodedPayload}`;
      const sig = createHmac("sha256", "secret").update(body).digest("base64url");
      const token = `${body}.${sig}`;

      expect(() => verifyControlToken(token)).toThrow("unsupported_jwt_alg");
    });

    it("rejects malformed token", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";

      expect(() => verifyControlToken("invalid")).toThrow();
      expect(() => verifyControlToken("")).toThrow();
    });

    it("rejects token not yet active (nbf)", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          nbf: now + 100,
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      expect(() => verifyControlToken(token)).toThrow("jwt_not_active");
    });

    it("rejects when JWT secret is missing", () => {
      delete process.env.AGENT_RUNTIME_JWT_SECRET;
      delete process.env.JWT_SECRET_KEY;

      expect(() => verifyControlToken("any.token.here")).toThrow("missing_jwt_secret");
    });

    it("uses fallback JWT secret", () => {
      delete process.env.AGENT_RUNTIME_JWT_SECRET;
      process.env.JWT_SECRET_KEY = "fallback-secret";

      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "fallback-secret",
      );

      const claims = verifyControlToken(token);
      expect(claims.exp).toBeGreaterThan(now);
    });

    it("extracts run_id from token", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          run_id: "test-run-123",
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      const claims = verifyControlToken(token);
      expect(claims.run_id).toBe("test-run-123");
    });

    it("extracts browser_session_id from token", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          browser_session_id: "session-456",
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      const claims = verifyControlToken(token);
      expect(claims.browser_session_id).toBe("session-456");
    });

    it("extracts tenant_id from token", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          tenant_id: "tenant-789",
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      const claims = verifyControlToken(token);
      expect(claims.tenant_id).toBe("tenant-789");
    });

    it("extracts user_id from token", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          user_id: "user-001",
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      const claims = verifyControlToken(token);
      expect(claims.user_id).toBe("user-001");
    });

    it("handles array scope with browser:control", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          scope: ["other:scope", "browser:control", "another:scope"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      const claims = verifyControlToken(token);
      expect(claims.scope).toContain("browser:control");
    });

    it("rejects non-array scope", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          scope: "browser:control",
          token_type: "agent_browser_control",
        },
        "secret",
      );

      expect(() => verifyControlToken(token)).toThrow("jwt_missing_scope");
    });

    it("rejects empty scope array", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          scope: [],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      expect(() => verifyControlToken(token)).toThrow("jwt_missing_scope");
    });

    it("handles missing exp claim", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const token = signJwt(
        {
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      expect(() => verifyControlToken(token)).toThrow("jwt_expired");
    });

    it("handles non-number exp claim", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const token = signJwt(
        {
          exp: "not-a-number",
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      expect(() => verifyControlToken(token)).toThrow("jwt_expired");
    });

    it("handles non-number nbf claim", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt(
        {
          exp: now + 600,
          nbf: "not-a-number",
          scope: ["browser:control"],
          token_type: "agent_browser_control",
        },
        "secret",
      );

      // nbf is ignored if not a number, so token should be valid
      const claims = verifyControlToken(token);
      expect(claims.exp).toBeGreaterThan(now);
    });

    it("rejects token with null payload", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const header = { alg: "HS256", typ: "JWT" };
      const encodedHeader = b64url(JSON.stringify(header));
      const encodedPayload = b64url(JSON.stringify(null));
      const body = `${encodedHeader}.${encodedPayload}`;
      const sig = createHmac("sha256", "secret").update(body).digest("base64url");
      const token = `${body}.${sig}`;

      expect(() => verifyControlToken(token)).toThrow("invalid_token_payload");
    });

    it("rejects token with array payload", () => {
      process.env.AGENT_RUNTIME_JWT_SECRET = "secret";
      const header = { alg: "HS256", typ: "JWT" };
      const encodedHeader = b64url(JSON.stringify(header));
      const encodedPayload = b64url(JSON.stringify([{ exp: 9999999999 }]));
      const body = `${encodedHeader}.${encodedPayload}`;
      const sig = createHmac("sha256", "secret").update(body).digest("base64url");
      const token = `${body}.${sig}`;

      expect(() => verifyControlToken(token)).toThrow("invalid_token_payload");
    });
  });
});
