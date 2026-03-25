import { describe, expect, it, vi } from 'vitest';
import { StartSessionUseCase } from '../../core/use-cases/start-session.use-case.js';

describe('StartSessionUseCase', () => {
  it('creates a new session and resizes the viewport', async () => {
    const page = {
      title: vi.fn(async () => 'Example'),
      setViewportSize: vi.fn(async () => undefined),
      url: vi.fn(() => 'https://example.test'),
    };
    const session = { id: 'tab-1', cdpUrl: 'http://127.0.0.1:9222', page };
    const eventBus = { publish: vi.fn() };
    const useCase = new StartSessionUseCase(
      {
        createSession: vi.fn(async () => ({ targetId: 'tab-1', url: 'https://example.test' })),
        getSession: vi.fn(async () => session),
      } as any,
      { navigate: vi.fn(async () => undefined) } as any,
      eventBus as any,
    );

    const result = await useCase.execute({
      cdpUrl: 'http://127.0.0.1:9222',
      url: 'https://example.test',
      width: 1200,
      height: 800,
    });

    expect(result).toMatchObject({
      ok: true,
      targetId: 'tab-1',
      session: { id: 'tab-1', title: 'Example' },
    });
    expect(page.setViewportSize).toHaveBeenCalledWith({ width: 1200, height: 800 });
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('reuses an existing session when targetId is provided', async () => {
    const page = {
      title: vi.fn(async () => 'Existing'),
      url: vi.fn(() => 'https://existing.test'),
    };
    const getSession = vi.fn(async () => ({ id: 'tab-9', cdpUrl: 'http://127.0.0.1:9222', page }));
    const navigate = vi.fn(async () => undefined);
    const useCase = new StartSessionUseCase(
      {
        getSession,
        createSession: vi.fn(),
      } as any,
      { navigate } as any,
    );

    const result = await useCase.execute({
      cdpUrl: 'http://127.0.0.1:9222',
      targetId: 'tab-9',
      url: 'https://new.example.test',
    });

    expect(result.ok).toBe(true);
    expect(getSession).toHaveBeenCalledWith('tab-9', 'http://127.0.0.1:9222');
    expect(navigate).toHaveBeenCalledWith(page, 'https://new.example.test');
  });
});
