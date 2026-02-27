# 📋 Production-Ready Test Suite Implementation Plan

**Project:** Tailorec Browser Service  
**Goal:** Transform test suite from C+ (73/100) to A- (90/100) industry-grade  
**Timeline:** 8 weeks  
**Target Coverage:** 70%+ overall, 80%+ critical paths  
**Current Status:** 35.82% coverage, 148 tests

---

## 🎯 Success Criteria

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| **Overall Coverage** | 35.82% | 70%+ | 🔴 Critical |
| **Critical File Coverage** | 16-26% | 80%+ | 🔴 Critical |
| **E2E Tests** | 0 tests | 120+ tests | 🔴 Critical |
| **Integration Tests** | 10 tests | 150+ tests | 🔴 Critical |
| **Unit Tests** | 135 tests | 600+ tests | 🟡 High |
| **Contract Tests** | 3 tests | 100+ tests | 🟡 High |
| **Test Documentation** | None | Complete | 🟡 High |
| **CI/CD Integration** | Partial | Full | 🟡 High |

---

## 📁 Project Structure After Implementation

```
src/__tests__/
├── README.md                          # Test suite documentation
├── unit/                              # Unit tests (600+ tests)
│   ├── pw-tools-interactions.unit.test.ts
│   ├── pw-tools-snapshot.unit.test.ts
│   ├── pw-tools-dom-observer.unit.test.ts
│   ├── pw-tools-downloads.unit.test.ts
│   ├── pw-tools-activity.unit.test.ts
│   ├── pw-session-advanced.unit.test.ts
│   ├── chrome-launcher.unit.test.ts
│   ├── chrome-profile-decoration.unit.test.ts
│   ├── chrome-executables.unit.test.ts
│   ├── extension-relay.unit.test.ts
│   ├── control-live-websocket.unit.test.ts
│   ├── server-context-advanced.unit.test.ts
│   ├── browser-server.unit.test.ts
│   ├── logging-correlation.unit.test.ts
│   ├── logging-subsystem.unit.test.ts
│   └── ... (existing tests)
├── integration/                       # Integration tests (150+ tests)
│   ├── routes/
│   │   ├── snapshot.integration.test.ts
│   │   ├── act-click.integration.test.ts
│   │   ├── act-type.integration.test.ts
│   │   ├── act-fill.integration.test.ts
│   │   ├── act-wait.integration.test.ts
│   │   ├── act-navigate.integration.test.ts
│   │   ├── act-evaluate.integration.test.ts
│   │   ├── act-select.integration.test.ts
│   │   ├── act-drag.integration.test.ts
│   │   ├── act-hover.integration.test.ts
│   │   ├── act-press.integration.test.ts
│   │   ├── act-scroll.integration.test.ts
│   │   ├── act-query-state.integration.test.ts
│   │   ├── act-dropdown.integration.test.ts
│   │   ├── act-blocker.integration.test.ts
│   │   ├── hooks-file-chooser.integration.test.ts
│   │   ├── hooks-dialog.integration.test.ts
│   │   ├── screenshot.integration.test.ts
│   │   ├── screenshot-labeled.integration.test.ts
│   │   ├── download.integration.test.ts
│   │   └── control.integration.test.ts
│   ├── error-scenarios.integration.test.ts
│   ├── browser-lifecycle.integration.test.ts
│   ├── profile-management.integration.test.ts
│   ├── websocket-control.integration.test.ts
│   └── ... (existing tests)
├── contract/                          # Contract tests (100+ tests)
│   ├── schemas/
│   │   ├── request-schemas.contract.test.ts
│   │   ├── response-schemas.contract.test.ts
│   │   └── error-schemas.contract.test.ts
│   ├── status.contract.test.ts
│   ├── control.contract.test.ts
│   ├── act.contract.test.ts
│   ├── snapshot.contract.test.ts
│   ├── screenshot.contract.test.ts
│   ├── hooks.contract.test.ts
│   ├── download.contract.test.ts
│   ├── header-contracts.contract.test.ts
│   ├── error-contracts.contract.test.ts
│   ├── type-safety.contract.test.ts
│   └── api-versioning.contract.test.ts
├── e2e/                               # E2E tests (120+ tests)
│   ├── flows/
│   │   ├── job-application-basic.test.ts
│   │   ├── job-application-complex.test.ts
│   │   ├── form-filling-accuracy.test.ts
│   │   ├── file-upload-flow.test.ts
│   │   ├── file-download-flow.test.ts
│   │   ├── dropdown-selection-flow.test.ts
│   │   ├── multi-step-form-flow.test.ts
│   │   ├── authentication-flow.test.ts
│   │   ├── search-and-filter-flow.test.ts
│   │   └── pagination-flow.test.ts
│   ├── browser/
│   │   ├── browser-navigation.test.ts
│   │   ├── snapshot-act-loop.test.ts
│   │   ├── tab-management.test.ts
│   │   ├── profile-switching.test.ts
│   │   └── viewport-resizing.test.ts
│   ├── error-recovery/
│   │   ├── timeout-recovery.test.ts
│   │   ├── stale-element-recovery.test.ts
│   │   ├── network-error-recovery.test.ts
│   │   ├── browser-crash-recovery.test.ts
│   │   └── session-recovery.test.ts
│   ├── edge-cases/
│   │   ├── long-page-handling.test.ts
│   │   ├── infinite-scroll.test.ts
│   │   ├── lazy-loading.test.ts
│   │   ├── dynamic-content.test.ts
│   │   ├── iframe-handling.test.ts
│   │   ├── shadow-dom.test.ts
│   │   └── slow-network.test.ts
│   ├── concurrency/
│   │   ├── multiple-tabs.test.ts
│   │   ├── parallel-requests.test.ts
│   │   ├── shared-session.test.ts
│   │   └── resource-contention.test.ts
│   ├── stress/
│   │   ├── rapid-snapshot-act.test.ts
│   │   ├── large-payload.test.ts
│   │   ├── memory-leak.test.ts
│   │   └── stability.test.ts
│   └── regression/
│       ├── known-issues.test.ts
│       └── past-bugs.test.ts
├── helpers/                           # Test utilities
│   ├── core-browser.ts
│   ├── pw-session-fixtures.ts
│   ├── pw-fill-fixtures.ts
│   ├── upload-fixtures.ts
│   ├── remote-debug-browser.ts
│   ├── test-server.ts
│   ├── api-client.ts
│   └── assertion-helpers.ts
├── factories/                         # Test data factories
│   ├── page-state.factory.ts
│   ├── test-data.factory.ts
│   ├── request.factory.ts
│   ├── response.factory.ts
│   └── error.factory.ts
├── fixtures/                          # Test fixtures
│   ├── api-responses/
│   │   ├── snapshot-success.json
│   │   ├── snapshot-error.json
│   │   ├── act-success.json
│   │   └── act-error.json
│   ├── pages/
│   │   ├── simple-form.html
│   │   ├── complex-form.html
│   │   ├── dropdown-page.html
│   │   ├── file-upload-page.html
│   │   └── dynamic-content-page.html
│   └── files/
│       ├── test-upload.txt
│       └── test-download.pdf
└── __mocks__/                         # Mock implementations
    ├── playwright.ts
    ├── express.ts
    ├── fs.ts
    ├── net.ts
    └── ws.ts
```

---

## 🔄 Parallel Work Streams

This plan is designed for **multiple agents to work simultaneously**. There are **4 independent work streams** that can be executed in parallel:

```
Stream A: Unit Tests (Agent 1-2)
Stream B: Integration Tests (Agent 2-3)
Stream C: Contract Tests (Agent 3)
Stream D: E2E Tests (Agent 4-5)
```

---

## 📝 WORK STREAM A: Unit Tests

**Owner:** Agent 1-2  
**Goal:** Add 450+ unit tests  
**Target Coverage:** 80%+ for assigned modules  
**Timeline:** Week 1-4

---

### Task A1: Action Core Tests (pw-tools-core.interactions.ts)

**File:** `src/__tests__/unit/pw-tools-interactions.unit.test.ts`  
**Target:** 180+ tests, 60%+ coverage  
**Priority:** 🔴 Critical  
**Estimated Time:** 2 days

```typescript
// Test Groups to Implement:

// Group 1: clickViaPlaywright (15 tests)
describe("clickViaPlaywright", () => {
  it("successful click with default options", async () => {});
  it("click with custom button (left/right/middle)", async () => {});
  it("click with modifiers (Alt, Control, Shift, Meta)", async () => {});
  it("double-click functionality", async () => {});
  it("timeout handling (min/max boundaries)", async () => {});
  it("ref locator resolution", async () => {});
  it("error: element not found", async () => {});
  it("error: element not visible", async () => {});
  it("error: timeout exceeded", async () => {});
  it("error: strict mode violation", async () => {});
  it("logging: action started/succeeded/failed", async () => {});
  it("frame-aware clicking", async () => {});
  it("aria-ref vs role-ref modes", async () => {});
  it("dynamic ref (d1, d2, etc.) support", async () => {});
  it("correlation ID propagation", async () => {});
});

// Group 2: typeViaPlaywright (12 tests)
describe("typeViaPlaywright", () => {
  it("basic text typing", async () => {});
  it("submit option (presses Enter after typing)", async () => {});
  it("slowly option (character-by-character with delay)", async () => {});
  it("timeout handling", async () => {});
  it("error: element not found", async () => {});
  it("error: element not fillable", async () => {});
  it("empty text handling", async () => {});
  it("special characters handling", async () => {});
  it("ref resolution", async () => {});
  it("frame-aware typing", async () => {});
  it("logging verification", async () => {});
  it("correlation ID propagation", async () => {});
});

// Group 3: fillAndVerifyField (20 tests)
describe("fillAndVerifyField", () => {
  it("skip when values already match", async () => {});
  it("successful fill with verification", async () => {});
  it("fallback to pressSequentially when fill fails", async () => {});
  it("date input format handling (ISO, MM/DD/YYYY, etc.)", async () => {});
  it("tel input digits-only handling", async () => {});
  it("masked input handling", async () => {});
  it("contenteditable fallback", async () => {});
  it("error: fill fails completely", async () => {});
  it("warning: value mismatch after fill", async () => {});
  it("strategy tracking (fill/sequential/pressSequentially)", async () => {});
  it("actual value readback", async () => {});
  it("placeholder detection", async () => {});
  it("input type detection", async () => {});
  it("timeout handling", async () => {});
  it("empty value clearing", async () => {});
  it("whitespace trimming", async () => {});
  it("long text handling (>200 chars)", async () => {});
  it("non-string value conversion", async () => {});
  it("logging verification", async () => {});
  it("correlation ID propagation", async () => {});
});

// Group 4: fillFormViaPlaywright (10 tests)
describe("fillFormViaPlaywright", () => {
  it("multiple fields filling", async () => {});
  it("mixed field types (text, email, password)", async () => {});
  it("checkbox/radio handling", async () => {});
  it("partial fill (some succeed, some fail)", async () => {});
  it("results reporting (matched/mismatched)", async () => {});
  it("warning aggregation", async () => {});
  it("empty fields array handling", async () => {});
  it("invalid field filtering", async () => {});
  it("timeout propagation", async () => {});
  it("logging verification", async () => {});
});

// Group 5-18: Additional action tests (123 tests)
// hoverViaPlaywright (8 tests)
// dragViaPlaywright (10 tests)
// selectOptionViaPlaywright (10 tests)
// pressKeyViaPlaywright (8 tests)
// scrollIntoViewViaPlaywright (8 tests)
// queryElementStateViaPlaywright (15 tests)
// queryElementStatesViaPlaywright (5 tests)
// waitForViaPlaywright (15 tests)
// evaluateViaPlaywright (10 tests)
// navigateViaPlaywright (8 tests)
// discoverDropdownOptionsViaPlaywright (12 tests)
// closeDropdownViaPlaywright (6 tests)
// detectBlockingElementViaPlaywright (8 tests)
// dismissBlockerViaPlaywright (10 tests)
```

**Dependencies:** None  
**Review Checklist:**
- [ ] All tests pass
- [ ] Coverage ≥ 60%
- [ ] No flaky tests
- [ ] Logging verified
- [ ] Error cases covered

---

### Task A2: Session & State Tests (pw-session.ts)

**File:** `src/__tests__/unit/pw-session-advanced.unit.test.ts`  
**Target:** 87+ tests, 80%+ coverage  
**Priority:** 🟡 High  
**Estimated Time:** 1.5 days

```typescript
// Test Groups to Implement:

// Group 1: ensurePageState (14 tests)
describe("ensurePageState", () => {
  it("creates new state for page", () => {});
  it("returns existing state", () => {});
  it("console event observation", () => {});
  it("console message limiting (MAX_CONSOLE_MESSAGES)", () => {});
  it("pageerror event observation", () => {});
  it("error limiting (MAX_PAGE_ERRORS)", () => {});
  it("request event observation", () => {});
  it("request limiting (MAX_NETWORK_REQUESTS)", () => {});
  it("response event handling", () => {});
  it("requestfailed event handling", () => {});
  it("page close cleanup", () => {});
  it("WeakMap state management", () => {});
  it("observedPages tracking", () => {});
  it("logging verification", () => {});
});

// Group 2: connectBrowser (12 tests)
describe("connectBrowser", () => {
  it("cached connection reuse", async () => {});
  it("in-flight connection waiting", async () => {});
  it("successful connection (attempt 1)", async () => {});
  it("retry on failure (attempt 2)", async () => {});
  it("retry on failure (attempt 3)", async () => {});
  it("all retries fail", async () => {});
  it("timeout handling (5000ms + backoff)", async () => {});
  it("WebSocket URL fallback", async () => {});
  it("headers with auth", async () => {});
  it("disconnect handling (cache clear)", async () => {});
  it("observeBrowser on connect", async () => {});
  it("logging verification", async () => {});
});

// Group 3: getPageForTargetId (10 tests)
// Group 4: refLocator (15 tests)
// Group 5: Role refs management (17 tests)
// Group 6: Page operations (19 tests)
// Group 7: Context operations (10 tests)
```

**Dependencies:** None  
**Review Checklist:**
- [ ] All tests pass
- [ ] Coverage ≥ 80%
- [ ] No flaky tests
- [ ] Mock usage appropriate

---

### Task A3: Browser Launcher Tests (chrome.ts)

**File:** `src/__tests__/unit/chrome-launcher.unit.test.ts`  
**Target:** 49+ tests, 50%+ coverage  
**Priority:** 🔴 Critical  
**Estimated Time:** 1 day

```typescript
// Test Groups to Implement:

// Group 1: isChromeReachable (6 tests)
describe("isChromeReachable", () => {
  it("reachable Chrome returns true", async () => {});
  it("unreachable Chrome returns false", async () => {});
  it("timeout handling (500ms default)", async () => {});
  it("custom timeout support", async () => {});
  it("network error handling", async () => {});
  it("invalid URL handling", async () => {});
});

// Group 2: getChromeWebSocketUrl (6 tests)
describe("getChromeWebSocketUrl", () => {
  it("valid WebSocket URL extraction", async () => {});
  it("missing WebSocket URL returns null", async () => {});
  it("timeout handling", async () => {});
  it("network error handling", async () => {});
  it("URL normalization", async () => {});
  it("invalid response handling", async () => {});
});

// Group 3: launchOpenClawChrome (20 tests)
describe("launchOpenClawChrome", () => {
  it("basic launch with default options", async () => {});
  it("headless mode launch", async () => {});
  it("custom viewport launch", async () => {});
  it("custom CDP port launch", async () => {});
  it("profile name handling", async () => {});
  it("user-data-dir creation", async () => {});
  it("bootstrap profile (first launch)", async () => {});
  it("profile decoration (needsDecorate)", async () => {});
  it("profile decoration (already decorated)", async () => {});
  it("Chrome spawn arguments", async () => {});
  it("environment variable handling", async () => {});
  it("CDP readiness check", async () => {});
  it("launch timeout handling", async () => {});
  it("launch failure (CDP not ready)", async () => {});
  it("remote profile rejection (not loopback)", async () => {});
  it("port availability check", async () => {});
  it("browser executable resolution", async () => {});
  it("no-sandbox flag (when enabled)", async () => {});
  it("Linux-specific flags", async () => {});
  it("logging verification", async () => {});
});

// Group 4: stopOpenClawChrome (10 tests)
// Group 5: Helper functions (7 tests)
```

**Dependencies:** None  
**Review Checklist:**
- [ ] All tests pass
- [ ] Coverage ≥ 50%
- [ ] No flaky tests
- [ ] Process cleanup verified

---

### Task A4: DOM Observer Tests (pw-tools-core.dom-observer.ts)

**File:** `src/__tests__/unit/pw-tools-dom-observer.unit.test.ts`  
**Target:** 45+ tests, 70%+ coverage  
**Priority:** 🟡 High  
**Estimated Time:** 1 day

```typescript
// Test Groups to Implement:

// Group 1: injectIncrementalRefs (8 tests)
describe("injectIncrementalRefs", () => {
  it("inject refs into container", () => {});
  it("incremental ref assignment (d1, d2, d3)", () => {});
  it("existing aria-ref skipping", () => {});
  it("role-based filtering", () => {});
  it("searchText filtering", () => {});
  it("maxRefs limiting", () => {});
  it("returned elements tracking", () => {});
  it("frame support", () => {});
});

// Group 2: startDomObserver (12 tests)
describe("startDomObserver", () => {
  it("observer creation", () => {});
  it("MutationObserver initialization", () => {});
  it("childList observation", () => {});
  it("attributes observation", () => {});
  it("subtree observation", () => {});
  it("callback registration", () => {});
  it("existing elements discovery", () => {});
  it("anchorRef exclusion", () => {});
  it("frame support", () => {});
  it("observing state tracking", () => {});
  it("error handling", () => {});
  it("logging verification", () => {});
});

// Group 3: stopDomObserver (5 tests)
// Group 4: snapshotDeltaViaPlaywright (15 tests)
// Group 5: IncrementalElement (5 tests)
```

**Dependencies:** None  
**Review Checklist:**
- [ ] All tests pass
- [ ] Coverage ≥ 70%
- [ ] No flaky tests

---

### Task A5: WebSocket Control Tests (control-live.ts)

**File:** `src/__tests__/unit/control-live-websocket.unit.test.ts`  
**Target:** 81+ tests, 60%+ coverage  
**Priority:** 🟡 High  
**Estimated Time:** 1.5 days

```typescript
// Test Groups to Implement:

// Group 1: JWT Token Utilities (11 tests)
describe("base64UrlDecode", () => {
  it("standard base64url decoding", () => {});
  it("padding handling", () => {});
  it("special characters (-, _)", () => {});
  it("empty string handling", () => {});
  it("invalid input handling", () => {});
});

describe("toJsonObject", () => {
  it("valid JSON object parsing", () => {});
  it("null rejection", () => {});
  it("array rejection", () => {});
  it("string rejection", () => {});
  it("number rejection", () => {});
  it("invalid JSON rejection", () => {});
});

// Group 2: verifyControlToken (17 tests - extend existing)
// Group 3: parseClientMessage (18 tests)
// Group 4: installControlLiveWebSocketServer (20 tests)
// Group 5: WebSocket helpers (15 tests)
```

**Dependencies:** None  
**Review Checklist:**
- [ ] All tests pass
- [ ] Coverage ≥ 60%
- [ ] No flaky tests
- [ ] Security validation covered

---

### Task A6: Additional Unit Tests

**Files:** Multiple  
**Target:** 100+ tests  
**Priority:** 🟢 Medium  
**Estimated Time:** 2 days

```typescript
// Task A6.1: pw-tools-core.snapshot.ts (30 tests)
// Task A6.2: pw-tools-core.activity.ts (15 tests)
// Task A6.3: pw-tools-core.downloads.ts (25 tests)
// Task A6.4: extension-relay.ts (30 tests)
```

**Dependencies:** None

---

## 📝 WORK STREAM B: Integration Tests

**Owner:** Agent 2-3  
**Goal:** Add 150+ integration tests  
**Target Coverage:** All routes covered  
**Timeline:** Week 2-5

---

### Task B1: Snapshot Route Tests

**File:** `src/__tests__/integration/routes/snapshot.integration.test.ts`  
**Target:** 20 tests  
**Priority:** 🔴 Critical  
**Estimated Time:** 0.5 days

```typescript
// Test Groups to Implement:

describe("POST /snapshot", () => {
  // Basic functionality (5 tests)
  it("basic request", async () => {});
  it("with targetId", async () => {});
  it("response structure", async () => {});
  it("refs in response", async () => {});
  it("logging verification", async () => {});
  
  // Options (5 tests)
  it("timeoutMs option", async () => {});
  it("maxChars option", async () => {});
  it("interactiveOnly option", async () => {});
  it("compact option", async () => {});
  it("maxDepth option", async () => {});
  
  // Edge cases (5 tests)
  it("truncated response", async () => {});
  it("empty page", async () => {});
  it("large page", async () => {});
  it("dynamic content", async () => {});
  it("iframe content", async () => {});
  
  // Error handling (5 tests)
  it("error: browser unavailable", async () => {});
  it("error: timeout exceeded", async () => {});
  it("error: invalid options", async () => {});
  it("error: invalid targetId", async () => {});
  it("error: correlation ID propagation", async () => {});
});

describe("POST /snapshot/delta", () => {
  // Start/stop observation (5 tests)
  it("start action", async () => {});
  it("stop action", async () => {});
  it("invalid action", async () => {});
  it("anchorRef support", async () => {});
  it("error handling", async () => {});
});
```

**Dependencies:** None  
**Review Checklist:**
- [ ] All tests pass
- [ ] All options covered
- [ ] Error cases covered

---

### Task B2: Act Route Tests (Click, Type, Press)

**File:** `src/__tests__/integration/routes/act-basic.integration.test.ts`  
**Target:** 42 tests  
**Priority:** 🔴 Critical  
**Estimated Time:** 1 day

```typescript
// Test Groups to Implement:

describe("POST /act - click", () => {
  // Basic functionality (5 tests)
  it("basic click", async () => {});
  it("with button option", async () => {});
  it("with modifiers", async () => {});
  it("doubleClick", async () => {});
  it("response structure", async () => {});
  
  // Error handling (5 tests)
  it("error: missing ref", async () => {});
  it("error: invalid button", async () => {});
  it("error: invalid modifiers", async () => {});
  it("error: element not found", async () => {});
  it("error: timeout", async () => {});
  
  // Edge cases (5 tests)
  it("timeout handling", async () => {});
  it("browser unavailable", async () => {});
  it("logging verification", async () => {});
  it("correlation ID", async () => {});
  it("targetId handling", async () => {});
});

describe("POST /act - type", () => {
  // 12 tests (similar structure)
});

describe("POST /act - press", () => {
  // 5 tests (similar structure)
});
```

**Dependencies:** None

---

### Task B3: Act Route Tests (Fill, Wait, Navigate)

**File:** `src/__tests__/integration/routes/act-complex.integration.test.ts`  
**Target:** 48 tests  
**Priority:** 🔴 Critical  
**Estimated Time:** 1.5 days

```typescript
// Test Groups to Implement:

describe("POST /act - fill", () => {
  // 18 tests
});

describe("POST /act - wait", () => {
  // 20 tests
});

describe("POST /act - navigate", () => {
  // 6 tests
});

describe("POST /act - evaluate", () => {
  // 6 tests
});
```

**Dependencies:** None

---

### Task B4: Act Route Tests (Dropdown, Blocker, Query State)

**File:** `src/__tests__/integration/routes/act-advanced.integration.test.ts`  
**Target:** 36 tests  
**Priority:** 🟡 High  
**Estimated Time:** 1 day

```typescript
// Test Groups to Implement:

describe("POST /act - discover_dropdown", () => {
  // 6 tests
});

describe("POST /act - close_dropdown", () => {
  // 5 tests
});

describe("POST /act - query_state", () => {
  // 8 tests
});

describe("POST /act - detect_blocker", () => {
  // 5 tests
});

describe("POST /act - dismiss_blocker", () => {
  // 7 tests
});

describe("POST /act - drag, hover, scroll, select", () => {
  // 25 tests combined
});
```

**Dependencies:** None

---

### Task B5: Hooks & Screenshot Tests

**File:** `src/__tests__/integration/routes/hooks-screenshot.integration.test.ts`  
**Target:** 42 tests  
**Priority:** 🟡 High  
**Estimated Time:** 1 day

```typescript
// Test Groups to Implement:

describe("POST /hooks/file-chooser", () => {
  // 15 tests
});

describe("POST /hooks/dialog", () => {
  // 12 tests
});

describe("POST /screenshot", () => {
  // 15 tests
});

describe("POST /screenshot/labeled", () => {
  // 12 tests
});
```

**Dependencies:** None

---

### Task B6: Error Scenario Tests

**File:** `src/__tests__/integration/error-scenarios.integration.test.ts`  
**Target:** 45 tests  
**Priority:** 🔴 Critical  
**Estimated Time:** 1 day

```typescript
// Test Groups to Implement:

describe("Browser unavailable scenarios", () => {
  // 10 tests
});

describe("Element not found scenarios", () => {
  // 10 tests
});

describe("Timeout scenarios", () => {
  // 10 tests
});

describe("Validation error scenarios", () => {
  // 10 tests
});

describe("Configuration error scenarios", () => {
  // 5 tests
});
```

**Dependencies:** None

---

### Task B7: Browser Lifecycle Tests

**File:** `src/__tests__/integration/browser-lifecycle.integration.test.ts`  
**Target:** 30 tests  
**Priority:** 🟡 High  
**Estimated Time:** 1 day

```typescript
// Test Groups to Implement:

describe("Browser launch lifecycle", () => {
  // 10 tests
});

describe("Profile management", () => {
  // 10 tests
});

describe("Tab management", () => {
  // 10 tests
});
```

**Dependencies:** None

---

## 📝 WORK STREAM C: Contract Tests

**Owner:** Agent 3  
**Goal:** Add 100+ contract tests  
**Target:** All API contracts validated  
**Timeline:** Week 3-5

---

### Task C1: Request Schema Tests

**File:** `src/__tests__/contract/schemas/request-schemas.contract.test.ts`  
**Target:** 25 tests  
**Priority:** 🔴 Critical  
**Estimated Time:** 0.5 days

```typescript
// Test Groups to Implement:

describe("ActRequest schema", () => {
  // 8 tests for each action kind
  it("click request structure", () => {});
  it("type request structure", () => {});
  it("press request structure", () => {});
  it("hover request structure", () => {});
  it("fill request structure", () => {});
  it("wait request structure", () => {});
  it("evaluate request structure", () => {});
  it("navigate request structure", () => {});
  // ... all 18 action kinds
});

describe("SnapshotRequest schema", () => {
  // 2 tests
});

describe("ScreenshotRequest schema", () => {
  // 2 tests
});

describe("Invalid requests", () => {
  // 6 tests
});
```

**Dependencies:** None

---

### Task C2: Response Schema Tests

**File:** `src/__tests__/contract/schemas/response-schemas.contract.test.ts`  
**Target:** 20 tests  
**Priority:** 🔴 Critical  
**Estimated Time:** 0.5 days

```typescript
// Test Groups to Implement:

describe("ActResponse schema", () => {
  // 3 tests
});

describe("SnapshotResponse schema", () => {
  // 3 tests
});

describe("ScreenshotResponse schema", () => {
  // 2 tests
});

describe("ErrorResponse schema", () => {
  // 3 tests
});

describe("StatusResponse schema", () => {
  // 2 tests
});

// ... more response schemas
```

**Dependencies:** None

---

### Task C3: Error Contract Tests

**File:** `src/__tests__/contract/error-contracts.contract.test.ts`  
**Target:** 15 tests  
**Priority:** 🔴 Critical  
**Estimated Time:** 0.5 days

```typescript
// Test Groups to Implement:

describe("HTTP error response structure", () => {
  it("400 Bad Request structure", async () => {});
  it("403 Forbidden structure", async () => {});
  it("404 Not Found structure", async () => {});
  it("408 Request Timeout structure", async () => {});
  it("409 Conflict structure", async () => {});
  it("500 Internal Error structure", async () => {});
  it("503 Service Unavailable structure", async () => {});
  // ... 8 more tests
});
```

**Dependencies:** None

---

### Task C4: Header & API Contracts

**File:** `src/__tests__/contract/header-contracts.contract.test.ts`  
**Target:** 15 tests  
**Priority:** 🟡 High  
**Estimated Time:** 0.5 days

```typescript
// Test Groups to Implement:

describe("Request headers", () => {
  // 5 tests
});

describe("Response headers", () => {
  // 5 tests
});

describe("Correlation ID propagation", () => {
  // 5 tests
});
```

**Dependencies:** None

---

### Task C5: Type Safety Tests

**File:** `src/__tests__/contract/type-safety.contract.test.ts`  
**Target:** 25 tests  
**Priority:** 🟡 High  
**Estimated Time:** 0.5 days

```typescript
// Test Groups to Implement:

describe("TypeScript type validation", () => {
  // 15 tests
});

describe("Runtime type validation", () => {
  // 10 tests
});
```

**Dependencies:** None

---

## 📝 WORK STREAM D: E2E Tests

**Owner:** Agent 4-5  
**Goal:** Add 120+ E2E tests  
**Target:** All critical user flows covered  
**Timeline:** Week 4-8

---

### Task D1: Job Application Flows

**File:** `src/__tests__/e2e/flows/job-application-*.test.ts`  
**Target:** 18 tests  
**Priority:** 🔴 Critical  
**Estimated Time:** 1 day

```typescript
// File: job-application-basic.test.ts (8 tests)
describe("E2E: Basic Job Application", () => {
  it("navigate to job board", async () => {});
  it("search for jobs", async () => {});
  it("open job detail page", async () => {});
  it("click apply button", async () => {});
  it("fill basic info form", async () => {});
  it("upload resume", async () => {});
  it("submit application", async () => {});
  it("verify submission confirmation", async () => {});
});

// File: job-application-complex.test.ts (10 tests)
describe("E2E: Complex Job Application", () => {
  // 10 tests for multi-step applications
});
```

**Dependencies:** None  
**Review Checklist:**
- [ ] All tests pass
- [ ] Video recording on failure
- [ ] Screenshot capture
- [ ] Real browser testing

---

### Task D2: Form Filling Flows

**File:** `src/__tests__/e2e/flows/form-filling-accuracy.test.ts`  
**Target:** 8 tests  
**Priority:** 🔴 Critical  
**Estimated Time:** 0.5 days

```typescript
describe("E2E: Form Filling Accuracy", () => {
  it("text field accuracy", async () => {});
  it("email field validation", async () => {});
  it("phone field formatting", async () => {});
  it("date field formats", async () => {});
  it("dropdown selection accuracy", async () => {});
  it("radio button selection", async () => {});
  it("checkbox handling", async () => {});
  it("textarea with special chars", async () => {});
});
```

**Dependencies:** None

---

### Task D3: Error Recovery Flows

**File:** `src/__tests__/e2e/error-recovery.test.ts`  
**Target:** 8 tests  
**Priority:** 🟡 High  
**Estimated Time:** 0.5 days

```typescript
describe("E2E: Error Recovery", () => {
  it("handle form validation errors", async () => {});
  it("retry failed submission", async () => {});
  it("recover from timeout", async () => {});
  it("handle stale element reference", async () => {});
  it("recover from navigation failure", async () => {});
  it("handle popup interference", async () => {});
  it("recover from network error", async () => {});
  it("session recovery", async () => {});
});
```

**Dependencies:** None

---

### Task D4: Browser Control Flows

**File:** `src/__tests__/e2e/browser/*.test.ts`  
**Target:** 32 tests  
**Priority:** 🟡 High  
**Estimated Time:** 1.5 days

```typescript
// browser-navigation.test.ts (8 tests)
// snapshot-act-loop.test.ts (10 tests)
// file-operations.test.ts (8 tests)
// dialog-handling.test.ts (6 tests)
```

**Dependencies:** None

---

### Task D5: Edge Case Tests

**File:** `src/__tests__/e2e/edge-cases.test.ts`  
**Target:** 15 tests  
**Priority:** 🟡 High  
**Estimated Time:** 1 day

```typescript
describe("E2E: Edge Cases", () => {
  it("handle very long page", async () => {});
  it("handle infinite scroll", async () => {});
  it("handle lazy loading", async () => {});
  it("handle dynamic content", async () => {});
  it("handle SPA navigation", async () => {});
  it("handle iframe content", async () => {});
  it("handle shadow DOM", async () => {});
  it("handle very slow network", async () => {});
  it("handle large forms (50+ fields)", async () => {});
  it("handle complex dropdowns", async () => {});
  it("handle date/time pickers", async () => {});
  it("handle file drag-drop", async () => {});
  it("handle keyboard shortcuts", async () => {});
  it("handle right-click menus", async () => {});
  it("handle browser back/forward", async () => {});
});
```

**Dependencies:** None

---

### Task D6: Concurrency & Stress Tests

**File:** `src/__tests__/e2e/concurrency.test.ts`  
**Target:** 18 tests  
**Priority:** 🟢 Medium  
**Estimated Time:** 1 day

```typescript
// Concurrency tests (8 tests)
// Stress tests (10 tests)
```

**Dependencies:** None

---

### Task D7: Regression Tests

**File:** `src/__tests__/e2e/regression/*.test.ts`  
**Target:** 20 tests  
**Priority:** 🟡 High  
**Estimated Time:** 1 day

```typescript
// known-issues.test.ts (10 tests)
// past-bugs.test.ts (10 tests)
```

**Dependencies:** Historical bug data

---

## 📝 WORK STREAM E: Infrastructure & Documentation

**Owner:** Agent 5-6  
**Goal:** Complete test infrastructure and documentation  
**Timeline:** Week 6-8

---

### Task E1: Test Documentation

**Files:** `src/__tests__/README.md`, `docs/TESTING.md`, `docs/TEST-CONTRIBUTING.md`  
**Priority:** 🟡 High  
**Estimated Time:** 1 day

**Content to Create:**
- Test suite overview
- Running tests guide
- Writing tests guide
- Best practices
- Troubleshooting
- Contribution guidelines

---

### Task E2: Test Helpers & Fixtures

**Files:** `src/__tests__/helpers/*.ts`, `src/__tests__/fixtures/**/*`  
**Priority:** 🟡 High  
**Estimated Time:** 1.5 days

**Files to Create:**
- test-server.ts
- api-client.ts
- assertion-helpers.ts
- API response fixtures
- HTML page fixtures

---

### Task E3: Test Factories

**Files:** `src/__tests__/factories/*.ts`  
**Priority:** 🟢 Medium  
**Estimated Time:** 1 day

**Files to Create:**
- page-state.factory.ts
- test-data.factory.ts
- request.factory.ts
- response.factory.ts
- error.factory.ts

---

### Task E4: Mock Implementations

**Files:** `src/__tests__/__mocks__/*.ts`  
**Priority:** 🟢 Medium  
**Estimated Time:** 1 day

**Files to Create:**
- playwright.ts
- express.ts
- fs.ts
- net.ts
- ws.ts

---

### Task E5: CI/CD Configuration

**Files:** `.github/workflows/*.yml`  
**Priority:** 🔴 Critical  
**Estimated Time:** 0.5 days

**Files to Create:**
- test.yml (unit + integration on PR)
- coverage.yml (coverage enforcement)
- e2e.yml (nightly E2E runs)

---

## 📊 Task Dependency Matrix

| Task | Dependencies | Can Run Parallel With |
|------|-------------|----------------------|
| A1-A6 | None | All B, C, D, E tasks |
| B1-B7 | None | All A, C, D, E tasks |
| C1-C5 | None | All A, B, D, E tasks |
| D1-D7 | None | All A, B, C, E tasks |
| E1 | None | A, B, C, D tasks |
| E2-E4 | None | A, B, C, D tasks |
| E5 | E1-E4 complete | None (final task) |

---

## 🚀 Quick Start for Agents

### For Agent Working on Unit Tests (Stream A):

```bash
# 1. Create test file
touch src/__tests__/unit/pw-tools-interactions.unit.test.ts

# 2. Add test structure
cat > src/__tests__/unit/pw-tools-interactions.unit.test.ts << 'EOF'
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clickViaPlaywright } from "../../browser/pw-tools-core.interactions.js";

describe("clickViaPlaywright", () => {
  // Implement tests here
});
EOF

# 3. Run tests
npm run test:unit -- src/__tests__/unit/pw-tools-interactions.unit.test.ts

# 4. Check coverage
npm run test:coverage -- src/__tests__/unit/pw-tools-interactions.unit.test.ts
```

### For Agent Working on Integration Tests (Stream B):

```bash
# 1. Create test file
touch src/__tests__/integration/routes/snapshot.integration.test.ts

# 2. Add test structure with mocked browser
cat > src/__tests__/integration/routes/snapshot.integration.test.ts << 'EOF'
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { registerBrowserAgentSnapshotRoutes } from "../../browser/routes/agent.snapshot.js";

// Mock browser module
vi.mock("../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => ({
    snapshotAiViaPlaywright: vi.fn().mockResolvedValue({ snapshot: "test", refs: {} }),
  }),
}));

describe("POST /snapshot", () => {
  // Implement tests here
});
EOF

# 3. Run tests
npm run test:integration -- src/__tests__/integration/routes/snapshot.integration.test.ts
```

### For Agent Working on E2E Tests (Stream D):

```bash
# 1. Create test file
touch src/__tests__/e2e/flows/job-application-basic.test.ts

# 2. Add test structure with real browser
cat > src/__tests__/e2e/flows/job-application-basic.test.ts << 'EOF'
import { test, expect } from "@playwright/test";

test.describe("E2E: Basic Job Application", () => {
  test("complete application flow", async ({ page }) => {
    // Navigate to test page
    await page.goto("https://example.com/jobs");
    
    // Implement full flow here
  });
});
EOF

# 3. Run tests
npm run test:e2e -- src/__tests__/e2e/flows/job-application-basic.test.ts
```

---

## ✅ Completion Checklist

### Phase 1 (Week 1-2): Critical Coverage
- [ ] Task A1: Action core tests (180 tests)
- [ ] Task A2: Session tests (87 tests)
- [ ] Task A3: Chrome launcher tests (49 tests)
- [ ] Task A4: DOM observer tests (45 tests)
- [ ] Task A5: WebSocket tests (81 tests)
- [ ] Task A6: Additional unit tests (100 tests)
- [ ] **Phase 1 Total: 542+ tests, 50%+ coverage**

### Phase 2 (Week 3-4): Integration Expansion
- [ ] Task B1: Snapshot route tests (20 tests)
- [ ] Task B2: Act basic tests (42 tests)
- [ ] Task B3: Act complex tests (48 tests)
- [ ] Task B4: Act advanced tests (36 tests)
- [ ] Task B5: Hooks & screenshot tests (42 tests)
- [ ] Task B6: Error scenarios (45 tests)
- [ ] Task B7: Browser lifecycle (30 tests)
- [ ] **Phase 2 Total: 263+ tests, 60%+ coverage**

### Phase 3 (Week 5-6): E2E Suite
- [ ] Task D1: Job application flows (18 tests)
- [ ] Task D2: Form filling flows (8 tests)
- [ ] Task D3: Error recovery (8 tests)
- [ ] Task D4: Browser control (32 tests)
- [ ] Task D5: Edge cases (15 tests)
- [ ] Task D6: Concurrency & stress (18 tests)
- [ ] Task D7: Regression (20 tests)
- [ ] **Phase 3 Total: 119+ tests, 70%+ coverage**

### Phase 4 (Week 7-8): Polish
- [ ] Task C1-C5: Contract tests (100 tests)
- [ ] Task E1: Documentation
- [ ] Task E2: Helpers & fixtures
- [ ] Task E3: Factories
- [ ] Task E4: Mocks
- [ ] Task E5: CI/CD configuration
- [ ] **Phase 4 Total: 100+ tests, infrastructure complete**

---

## 📈 Progress Tracking

Update this section as tasks are completed:

```markdown
### Completed Tasks
- [ ] Task A1: ___ / 180 tests (___%)
- [ ] Task A2: ___ / 87 tests (___%)
...

### Coverage Progress
- Week 1: ___%
- Week 2: ___%
- Week 3: ___%
- Week 4: ___%
- Week 5: ___%
- Week 6: ___%
- Week 7: ___%
- Week 8: ___%
```

---

## 🎯 Final Deliverables

| Deliverable | Target | Owner |
|-------------|--------|-------|
| Unit Tests | 600+ | Agent 1-2 |
| Integration Tests | 150+ | Agent 2-3 |
| Contract Tests | 100+ | Agent 3 |
| E2E Tests | 120+ | Agent 4-5 |
| Documentation | 100% | Agent 5-6 |
| Infrastructure | Complete | Agent 5-6 |
| CI/CD | Complete | Agent 5-6 |
| **Overall Coverage** | **70%+** | **All** |

---

**Last Updated:** 2026-02-28  
**Version:** 1.0  
**Status:** Ready for Implementation
