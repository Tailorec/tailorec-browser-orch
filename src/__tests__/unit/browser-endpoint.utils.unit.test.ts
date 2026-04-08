import { describe, expect, it } from 'vitest';
import { redactBrowserEndpoint } from '../../shared/utils/browser-endpoint.utils.js';

describe('redactBrowserEndpoint', () => {
  it('redacts query parameter values', () => {
    expect(
      redactBrowserEndpoint('wss://browser.example.com?token=test-token&session=abc'),
    ).toBe('wss://browser.example.com/?token=***REDACTED***&session=***REDACTED***');
  });

  it('redacts embedded credentials', () => {
    expect(
      redactBrowserEndpoint('https://user:pass@browser.example.com/devtools/browser/abc'),
    ).toBe('https://***REDACTED***:***REDACTED***@browser.example.com/devtools/browser/abc');
  });

  it('returns invalid endpoints unchanged', () => {
    expect(redactBrowserEndpoint('not-a-url')).toBe('not-a-url');
  });
});
