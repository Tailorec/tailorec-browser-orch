const redactedValue = '***REDACTED***';

export function redactBrowserEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);

    if (url.username) {
      url.username = redactedValue;
    }
    if (url.password) {
      url.password = redactedValue;
    }

    for (const key of Array.from(url.searchParams.keys())) {
      url.searchParams.set(key, redactedValue);
    }

    return url.toString();
  } catch {
    return endpoint;
  }
}
