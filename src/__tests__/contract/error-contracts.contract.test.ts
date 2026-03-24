import express from 'express';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { errorMiddleware, ValidationError } from '../../api/middlewares/error.middleware.js';

describe('error contracts', () => {
  it('maps middleware errors to the shared error payload', async () => {
    const app = express();
    app.get('/boom', () => {
      throw new ValidationError('invalid payload');
    });
    app.use(errorMiddleware);

    const response = await request(app).get('/boom');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ ok: false, error: 'invalid payload' });
  });
});
