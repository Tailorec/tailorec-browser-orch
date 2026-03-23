import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyControlToken } from "../../browser/routes/control-live.js";
import { createHmac } from "node:crypto";

// Helper to create valid JWT tokens for testing
function createTestToken(payload: Record<string, unknown> = {}): string {
  const secret = "test-secret-key-for-testing-only-12345";
  const header = { alg: "HS256", typ: "JWT" };
  
  const now = Math.floor(Date.now() / 1000);
  const defaultPayload = {
    exp: now + 3600, // 1 hour from now
    iat: now,
    iss: "tailorec-backend",
    aud: "tailorec-agent-runtime",
    scope: ["browser:control"],
    token_type: "agent_browser_control",
    run_id: "test-run-123",
    browser_session_id: "test-session-456",
    ...payload,
  };

  const base64UrlEncode = (obj: Record<string, unknown>): string => {
    return Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(defaultPayload);
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(data).digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

describe("control-live: verifyControlToken", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AGENT_RUNTIME_JWT_SECRET: "test-secret-key-for-testing-only-12345",
      AGENT_RUNTIME_JWT_ISSUER: "tailorec-backend",
      AGENT_RUNTIME_JWT_AUDIENCE: "tailorec-agent-runtime",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should verify valid token and return claims", () => {
    const token = createTestToken();
    const claims = verifyControlToken(token);
    
    expect(claims).toBeDefined();
    expect(claims.run_id).toBe("test-run-123");
    expect(claims.browser_session_id).toBe("test-session-456");
    expect(claims.scope).toContain("browser:control");
  });

  it("should throw error when secret is missing", () => {
    process.env.AGENT_RUNTIME_JWT_SECRET = "";
    process.env.JWT_SECRET_KEY = "";
    
    expect(() => verifyControlToken("any.token.here")).toThrow("missing_jwt_secret");
  });

  it("should throw error for invalid JWT format", () => {
    expect(() => verifyControlToken("invalid")).toThrow("invalid_jwt_format");
    expect(() => verifyControlToken("a.b")).toThrow("invalid_jwt_format");
    expect(() => verifyControlToken("a.b.c.d")).toThrow("invalid_jwt_format");
  });

  it("should throw error for unsupported algorithm", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS512", typ: "JWT" }))
      .toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const payload = Buffer.from(JSON.stringify({ exp: 9999999999 }))
      .toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const sig = "fake-signature";
    
    expect(() => verifyControlToken(`${header}.${payload}.${sig}`))
      .toThrow("unsupported_jwt_alg");
  });

  it("should throw error for expired token", () => {
    const token = createTestToken({ exp: Math.floor(Date.now() / 1000) - 100 });
    expect(() => verifyControlToken(token)).toThrow("jwt_expired");
  });

  it("should throw error for not yet active token", () => {
    const token = createTestToken({ 
      exp: Math.floor(Date.now() / 1000) + 3600,
      nbf: Math.floor(Date.now() / 1000) + 1000 
    });
    expect(() => verifyControlToken(token)).toThrow("jwt_not_active");
  });

  it("should throw error for wrong issuer", () => {
    const token = createTestToken({ iss: "wrong-issuer" });
    expect(() => verifyControlToken(token)).toThrow("jwt_bad_issuer");
  });

  it("should throw error for wrong audience", () => {
    const token = createTestToken({ aud: "wrong-audience" });
    expect(() => verifyControlToken(token)).toThrow("jwt_bad_audience");
  });

  it("should throw error for missing required scope", () => {
    const token = createTestToken({ scope: ["other:scope"] });
    expect(() => verifyControlToken(token)).toThrow("jwt_missing_scope");
  });

  it("should throw error for wrong token type", () => {
    const token = createTestToken({ token_type: "wrong_type" });
    expect(() => verifyControlToken(token)).toThrow("jwt_bad_token_type");
  });

  it("should accept token with audience as array", () => {
    const token = createTestToken({ aud: ["tailorec-agent-runtime", "other-audience"] });
    const claims = verifyControlToken(token);
    expect(claims.aud).toEqual(["tailorec-agent-runtime", "other-audience"]);
  });

  it("should handle optional fields", () => {
    const token = createTestToken({ 
      tenant_id: "tenant-789",
      user_id: "user-012",
    });
    const claims = verifyControlToken(token);
    expect(claims.tenant_id).toBe("tenant-789");
    expect(claims.user_id).toBe("user-012");
  });
});
