import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSubsystemLogger,
  flushLogs,
  initializeLogging,
  shutdownLogger,
} from '../../adapters/logging/logger.adapter.js';

describe('logger adapter production policy', () => {
  afterEach(async () => {
    await shutdownLogger();
    vi.restoreAllMocks();
  });

  it('clamps debug/info logs in production to warn+', async () => {
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    initializeLogging({
      level: 'debug',
      environment: 'production',
      format: 'json',
      logToFile: false,
    });

    const logger = createSubsystemLogger('main');
    logger.info('info should not emit');
    logger.warn('warn should emit');
    await flushLogs();

    const output = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('warn should emit');
    expect(output).not.toContain('info should not emit');
  });

  it('suppresses third-party warnings in production', async () => {
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    initializeLogging({
      level: 'warn',
      environment: 'production',
      format: 'json',
      logToFile: false,
    });

    const thirdPartyLogger = createSubsystemLogger('playwright.transport');
    const appLogger = createSubsystemLogger('main');
    thirdPartyLogger.warn('third-party warn should be suppressed');
    appLogger.warn('app warn should emit');
    await flushLogs();

    const output = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('app warn should emit');
    expect(output).not.toContain('third-party warn should be suppressed');
  });
});
