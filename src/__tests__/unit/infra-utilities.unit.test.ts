import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  createCorsMiddleware,
  createRequestLoggingMiddleware,
  ExpressServerAdapter,
} from '../../adapters/http/express.server.adapter.js';

describe('HTTP adapter utilities', () => {
  it('applies CORS headers and handles preflight requests', async () => {
    const adapter = new ExpressServerAdapter();
    adapter.use(createCorsMiddleware({ allowedOrigins: ['https://client.test'] }));
    adapter.get('/ping', (_req, res) => res.json({ ok: true }));

    const app = adapter.getApp();
    const optionsResponse = await request(app)
      .options('/ping')
      .set('Origin', 'https://client.test');

    expect(optionsResponse.status).toBe(204);
    expect(optionsResponse.headers['access-control-allow-origin']).toBe('https://client.test');
  });

  it('echoes correlation headers through request logging middleware', async () => {
    const adapter = new ExpressServerAdapter();
    adapter.use(createRequestLoggingMiddleware());
    adapter.get('/ping', (_req, res) => res.json({ ok: true }));

    const response = await request(adapter.getApp())
      .get('/ping')
      .set('x-correlation-id', 'corr-123');

    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toBe('corr-123');
  });
});
