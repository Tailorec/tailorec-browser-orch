export type UploadActionCounters = {
  ensureTab: number;
  armUpload: number;
  click: number;
  setInputFiles: number;
};

export function createUploadActionCounters(): UploadActionCounters {
  return {
    ensureTab: 0,
    armUpload: 0,
    click: 0,
    setInputFiles: 0,
  };
}

export function createProfileCtx(counter: { ensureTab: number }) {
  return {
    profile: { cdpUrl: "http://127.0.0.1:9222" },
    ensureTabAvailable: async (_targetId?: string) => {
      counter.ensureTab += 1;
      return { targetId: "tab-1", url: "about:blank" };
    },
    stopRunningBrowser: async () => undefined,
  };
}
