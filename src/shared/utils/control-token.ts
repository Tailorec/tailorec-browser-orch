import { createHmac, timingSafeEqual } from 'node:crypto';

export type ControlTokenClaims = {
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

const JWT_ISSUER = () => process.env.AGENT_RUNTIME_JWT_ISSUER || 'tailorec-backend';
const JWT_AUDIENCE = () => process.env.AGENT_RUNTIME_JWT_AUDIENCE || 'tailorec-agent-runtime';
const DEFAULT_CONTROL_TOKEN_EXPIRES_IN_SEC = 60 * 15;

function base64UrlEncode(input: Buffer | string): string {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return raw.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
  return Buffer.from(padded, 'base64');
}

function toJsonObject(input: Buffer): Record<string, unknown> {
  const parsed = JSON.parse(input.toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_token_payload');
  }
  return parsed as Record<string, unknown>;
}

export function verifyControlToken(token: string): ControlTokenClaims {
  const secret = process.env.AGENT_RUNTIME_JWT_SECRET || process.env.JWT_SECRET_KEY;
  if (!secret) {
    throw new Error('missing_jwt_secret');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('invalid_jwt_format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = toJsonObject(base64UrlDecode(encodedHeader));
  const payload = toJsonObject(base64UrlDecode(encodedPayload));

  if (header.alg !== 'HS256') {
    throw new Error('unsupported_jwt_alg');
  }

  const data = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmac('sha256', secret).update(data).digest();
  const provided = base64UrlDecode(encodedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error('invalid_jwt_signature');
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : undefined;

  if (!exp || exp <= now) {
    throw new Error('jwt_expired');
  }
  if (nbf && nbf > now) {
    throw new Error('jwt_not_active');
  }

  if (typeof payload.iss === 'string' && payload.iss !== JWT_ISSUER()) {
    throw new Error('jwt_bad_issuer');
  }

  const audClaim = payload.aud;
  if (typeof audClaim === 'string' && audClaim !== JWT_AUDIENCE()) {
    throw new Error('jwt_bad_audience');
  }
  if (Array.isArray(audClaim) && !audClaim.includes(JWT_AUDIENCE())) {
    throw new Error('jwt_bad_audience');
  }

  const scope = Array.isArray(payload.scope)
    ? payload.scope.filter((v): v is string => typeof v === 'string')
    : [];
  if (!scope.includes('browser:control')) {
    throw new Error('jwt_missing_scope');
  }

  if (payload.token_type !== 'agent_browser_control') {
    throw new Error('jwt_bad_token_type');
  }

  return payload as ControlTokenClaims;
}

export type CreateControlTokenInput = {
  runId: string;
  browserSessionId?: string;
  tenantId?: string;
  userId?: string;
  expiresInSec?: number;
};

export function createControlToken(input: CreateControlTokenInput): {
  token: string;
  expiresIn: number;
} {
  const secret = process.env.AGENT_RUNTIME_JWT_SECRET || process.env.JWT_SECRET_KEY;
  if (!secret) {
    throw new Error('missing_jwt_secret');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = Math.max(30, Math.floor(input.expiresInSec ?? DEFAULT_CONTROL_TOKEN_EXPIRES_IN_SEC));
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  } as const;
  const payload: ControlTokenClaims = {
    iat: now,
    nbf: now,
    exp: now + expiresIn,
    iss: JWT_ISSUER(),
    aud: JWT_AUDIENCE(),
    scope: ['browser:control'],
    token_type: 'agent_browser_control',
    run_id: input.runId,
    browser_session_id: input.browserSessionId,
    tenant_id: input.tenantId,
    user_id: input.userId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(data).digest();
  const encodedSignature = base64UrlEncode(signature);

  return {
    token: `${data}.${encodedSignature}`,
    expiresIn,
  };
}
