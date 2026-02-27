type Handler = (arg?: unknown) => void;

function makeRoleLocator(role: string, opts?: { name?: string; exact?: boolean }, frame?: string) {
  return {
    kind: "role",
    role,
    opts,
    frame,
    nth(index: number) {
      return { kind: "role-nth", role, opts, frame, index };
    },
  };
}

export function createMockPage() {
  const handlers = new Map<string, Handler[]>();

  const page = {
    _url: "https://example.test",
    on(event: string, handler: Handler) {
      const existing = handlers.get(event) ?? [];
      existing.push(handler);
      handlers.set(event, existing);
    },
    emit(event: string, payload?: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload);
      }
    },
    url() {
      return this._url;
    },
    locator(selector: string) {
      return { kind: "locator", selector };
    },
    frameLocator(frame: string) {
      return {
        locator(selector: string) {
          return { kind: "frame-locator", frame, selector };
        },
        getByRole(role: string, opts?: { name?: string; exact?: boolean }) {
          return makeRoleLocator(role, opts, frame);
        },
      };
    },
    getByRole(role: string, opts?: { name?: string; exact?: boolean }) {
      return makeRoleLocator(role, opts);
    },
  };

  return page as any;
}
