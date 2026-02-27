/**
 * Test mocks index.
 * Central export point for all mock implementations.
 * 
 * Note: Playwright and Express mocks have overlapping names (MockRequest, MockResponse).
 * Import directly from specific modules to avoid conflicts.
 */

// Export only unique mocks from each module
export * from "./fs.js";
export * from "./net.js";
export * from "./ws.js";

// Re-export playwright with prefix to avoid conflicts
export {
  MockLocator as PlaywrightMockLocator,
  MockFrameLocator as PlaywrightMockFrameLocator,
  MockElementHandle as PlaywrightMockElementHandle,
  MockFrame as PlaywrightMockFrame,
  MockResponse as PlaywrightMockResponse,
  MockRequest as PlaywrightMockRequest,
  createMockLocator,
} from "./playwright.js";

// Re-export express with prefix to avoid conflicts
export {
  MockRequest as ExpressMockRequest,
  MockResponse as ExpressMockResponse,
  MockApplication as ExpressMockApplication,
  MockRouter as ExpressMockRouter,
  createMockApplication,
  createMockRouter,
} from "./express.js";
