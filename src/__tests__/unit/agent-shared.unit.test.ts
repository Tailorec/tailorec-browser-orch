import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getProfileContext,
  getProfileName,
  mapRouteError,
  normalizeScreenshotType,
  sendErrorResponse,
} from '../../api/controllers/controller-runtime.utils.js';
import { ActionValidationError } from '../../api/validators/action.validator.js';
import { createBrowserContextMock, createMockReq, createMockRes } from '../helpers/test-helpers.js';

describe('controller-runtime utils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('derives the profile name from the query string', () => {
    expect(getProfileName(createMockReq({ query: { profile: ' team-a ' } }))).toBe('team-a');
    expect(getProfileName(createMockReq())).toBe('default');
  });

  it('wraps missing profiles as a 404', () => {
    const { browserContext } = createBrowserContextMock();
    browserContext.forProfile.mockImplementation(() => {
      throw new Error('Profile missing');
    });

    expect(() => getProfileContext(browserContext as any, createMockReq())).toThrowError('Profile missing');
    try {
      getProfileContext(browserContext as any, createMockReq());
    } catch (error) {
      expect((error as Error & { status?: number }).status).toBe(404);
    }
  });

  it('maps validation and tab errors to HTTP responses', () => {
    const { browserContext } = createBrowserContextMock();
    browserContext.mapTabError.mockReturnValue({ status: 409, message: 'Tab conflict' });

    expect(
      mapRouteError(
        browserContext as any,
        new ActionValidationError([{ field: 'ref', message: 'Required' }]),
        'fallback',
      ),
    ).toEqual({ status: 400, message: 'ref is required' });

    expect(mapRouteError(browserContext as any, new Error('stale tab'), 'fallback')).toEqual({
      status: 409,
      message: 'Tab conflict',
    });
  });

  it('preserves structured route error details', () => {
    const { browserContext } = createBrowserContextMock();
    const err = Object.assign(new Error('local browser capacity exceeded: 5/5'), {
      status: 429,
      code: 'capacity_exceeded',
      active: 5,
      max: 5,
      retryAfterSeconds: 5,
    });

    expect(mapRouteError(browserContext as any, err, 'fallback')).toEqual({
      status: 429,
      message: 'local browser capacity exceeded: 5/5',
      details: {
        code: 'capacity_exceeded',
        active: 5,
        max: 5,
        retryAfterSeconds: 5,
      },
    });
  });

  it('normalizes screenshot type and writes error responses', () => {
    expect(normalizeScreenshotType(undefined, false)).toBe('png');
    expect(normalizeScreenshotType(undefined, true)).toBe('jpeg');
    expect(normalizeScreenshotType('jpg', false)).toBe('jpeg');
    expect(() => normalizeScreenshotType('gif', false)).toThrow('type must be png|jpeg');

    const res = createMockRes();
    sendErrorResponse(res, 422, new Error('bad request'));
    expect(res.statusCode).toBe(422);
    expect(res.payload).toEqual({ ok: false, error: 'bad request' });
  });

  it('writes retry metadata for capacity errors', () => {
    const res = createMockRes();
    sendErrorResponse(res, 429, 'capacity exceeded', {
      code: 'capacity_exceeded',
      active: 5,
      max: 5,
      retryAfterSeconds: 5,
    });

    expect(res.statusCode).toBe(429);
    expect(res.getHeader('retry-after')).toBe('5');
    expect(res.payload).toEqual({
      ok: false,
      error: 'capacity exceeded',
      code: 'capacity_exceeded',
      active: 5,
      max: 5,
      retry_after_seconds: 5,
    });
  });
});
