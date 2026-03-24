import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createControlToken, verifyControlToken } from '../../shared/utils/control-token.js';

describe('control token utilities', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AGENT_RUNTIME_JWT_SECRET = 'top-secret';
    process.env.AGENT_RUNTIME_JWT_ISSUER = 'issuer';
    process.env.AGENT_RUNTIME_JWT_AUDIENCE = 'audience';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('creates and verifies a valid token', () => {
    const { token, expiresIn } = createControlToken({
      runId: 'run-1',
      browserSessionId: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(expiresIn).toBeGreaterThanOrEqual(30);
    expect(verifyControlToken(token)).toMatchObject({
      run_id: 'run-1',
      browser_session_id: 'session-1',
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      token_type: 'agent_browser_control',
    });
  });

  it('rejects tokens when the secret is missing', () => {
    delete process.env.AGENT_RUNTIME_JWT_SECRET;
    delete process.env.JWT_SECRET_KEY;

    expect(() => verifyControlToken('bad.token.value')).toThrow('missing_jwt_secret');
  });
});
