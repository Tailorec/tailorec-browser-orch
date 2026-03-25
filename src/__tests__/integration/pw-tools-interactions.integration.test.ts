import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { MediaController } from '../../api/controllers/media.controller.js';
import { registerMediaRoutes } from '../../api/routes/media.routes.js';
import { createBrowserContextMock, createTestApp } from '../helpers/test-helpers.js';

describe('media routes integration', () => {
  it('validates screenshot request combinations through the route stack', async () => {
    const { browserContext } = createBrowserContextMock();
    const controller = new MediaController({} as any, {} as any, browserContext as any);
    const app = createTestApp((router, middleware) => {
      registerMediaRoutes(router, controller, middleware);
    });

    const bothRefAndElement = await request(app).post('/screenshot').send({
      ref: 'e1',
      element: '#upload',
    });
    expect(bothRefAndElement.status).toBe(400);
    expect(bothRefAndElement.body).toEqual({
      ok: false,
      error: 'ref and element are mutually exclusive',
    });

    const badQuality = await request(app).post('/screenshot').send({
      type: 'png',
      quality: 80,
    });
    expect(badQuality.status).toBe(400);
    expect(badQuality.body).toEqual({
      ok: false,
      error: 'quality is only allowed for jpeg screenshots',
    });
  });
});
