# 📋 Workstream B: Integration Tests Implementation Plan

**Branch:** `workstream-b-integration`  
**Worktree:** `openclaw-browser-worktree-b`  
**Priority:** 🔴 CRITICAL  
**Target:** Add 220+ integration tests for all API routes  
**Estimated Time:** 6-8 hours with AI agent assistance

---

## 🎯 Objectives

This workstream focuses on implementing missing integration tests for all API routes:

| Route/Module | Target Tests | Current | Gap | Priority |
|--------------|-------------|---------|-----|----------|
| `/act` - Click/Type/Press | 42 tests | 0 | -42 | 🔴 Critical |
| `/act` - Fill/Wait/Navigate | 48 tests | 0 | -48 | 🔴 Critical |
| `/act` - Dropdown/Blocker | 36 tests | 0 | -36 | 🟡 High |
| `/hooks` & `/screenshot` | 42 tests | 0 | -42 | 🟡 High |
| Error Scenarios | 45 tests | 0 | -45 | 🔴 Critical |
| Browser Lifecycle | 30 tests | 0 | -30 | 🟡 High |
| Profile Management | 20 tests | 0 | -20 | 🟡 High |

---

## 📁 Files to Create

```
src/__tests__/integration/routes/
├── act-click.integration.test.ts           # NEW - 15 tests
├── act-type.integration.test.ts            # NEW - 12 tests
├── act-press.integration.test.ts           # NEW - 5 tests
├── act-fill.integration.test.ts            # NEW - 18 tests
├── act-wait.integration.test.ts            # NEW - 20 tests
├── act-navigate.integration.test.ts        # NEW - 6 tests
├── act-evaluate.integration.test.ts        # NEW - 6 tests
├── act-select.integration.test.ts          # NEW - 10 tests
├── act-drag.integration.test.ts            # NEW - 8 tests
├── act-hover.integration.test.ts           # NEW - 7 tests
├── act-scroll.integration.test.ts          # NEW - 7 tests
├── act-query-state.integration.test.ts     # NEW - 8 tests
├── act-dropdown.integration.test.ts        # NEW - 6 tests
├── act-blocker.integration.test.ts         # NEW - 12 tests
├── hooks-file-chooser.integration.test.ts  # NEW - 15 tests
├── hooks-dialog.integration.test.ts        # NEW - 12 tests
├── screenshot.integration.test.ts          # NEW - 15 tests
└── screenshot-labeled.integration.test.ts  # NEW - 12 tests

src/__tests__/integration/
├── error-scenarios.integration.test.ts     # NEW - 45 tests
├── browser-lifecycle.integration.test.ts   # NEW - 30 tests
└── profile-management.integration.test.ts  # NEW - 20 tests
```

---

## 🤖 AI Agent Tasks

### TASK B1: Act Route Tests - Basic Actions (Priority: 🔴 Critical)

**Files:** `src/__tests__/integration/routes/act-*.integration.test.ts`  
**Target:** 42 tests total  
**Time:** 90 minutes

**Prompt for AI Agent:**
```
You are implementing integration tests for basic act routes (click, type, press).

CONTEXT:
- Routes to test: POST /act with kind: click, type, press
- Test files to create:
  - src/__tests__/integration/routes/act-click.integration.test.ts (15 tests)
  - src/__tests__/integration/routes/act-type.integration.test.ts (12 tests)
  - src/__tests__/integration/routes/act-press.integration.test.ts (5 tests)
- Framework: Vitest with supertest
- Use mocked browser via vi.mock()

IMPLEMENT FOR CLICK (15 tests):
1. Basic functionality (5 tests):
   - basic click with ref
   - click with button option (left/right/middle)
   - click with modifiers (Alt, Control, Shift, Meta)
   - doubleClick functionality
   - response structure verification

2. Error handling (5 tests):
   - error: missing ref
   - error: invalid button option
   - error: invalid modifiers
   - error: element not found
   - error: timeout exceeded

3. Edge cases (5 tests):
   - timeout handling
   - browser unavailable scenario
   - logging verification
   - correlation ID propagation
   - targetId handling

IMPLEMENT FOR TYPE (12 tests):
1. Basic functionality (5 tests):
   - basic text typing
   - submit option (presses Enter)
   - slowly option (character-by-character)
   - timeout option
   - response structure

2. Error handling (4 tests):
   - error: missing ref
   - error: missing text
   - error: element not found
   - error: element not fillable

3. Edge cases (3 tests):
   - special characters handling
   - empty text handling
   - long text handling (>200 chars)

IMPLEMENT FOR PRESS (5 tests):
1. Basic functionality (3 tests):
   - basic key press
   - key combinations (Ctrl+C, Alt+Tab)
   - response structure

2. Error handling (2 tests):
   - error: missing key
   - error: invalid key format

REQUIREMENTS:
- Use test server helpers from src/__tests__/helpers/test-server.ts
- Mock browser module appropriately
- Verify response structure matches contract
- Test error response formats
- Include logging verification
- Test correlation ID headers

START BY:
1. Read existing snapshot.integration.test.ts for patterns
2. Read route implementation in src/browser/routes/
3. Create test files with proper structure
4. Run: npm run test:integration -- act-click.integration.test.ts
5. Verify all tests pass before proceeding
```

---

### TASK B2: Act Route Tests - Complex Actions (Priority: 🔴 Critical)

**Files:** `src/__tests__/integration/routes/act-complex.integration.test.ts`  
**Target:** 48 tests total  
**Time:** 120 minutes

**Prompt for AI Agent:**
```
You are implementing integration tests for complex act routes (fill, wait, navigate, evaluate).

CONTEXT:
- Routes to test: POST /act with kind: fill, wait, navigate, evaluate
- Test file to create: src/__tests__/integration/routes/act-complex.integration.test.ts
- Framework: Vitest with supertest

IMPLEMENT FOR FILL (18 tests):
1. Basic functionality (6 tests):
   - single field fill
   - multiple fields fill
   - skip when value matches
   - fallback to pressSequentially
   - date input handling
   - tel input digits-only

2. Error handling (6 tests):
   - error: missing ref
   - error: missing value
   - error: element not found
   - error: element not fillable
   - error: fill fails completely
   - warning: value mismatch

3. Edge cases (6 tests):
   - masked input handling
   - contenteditable fallback
   - empty value clearing
   - whitespace trimming
   - long text handling
   - strategy tracking in response

IMPLEMENT FOR WAIT (20 tests):
1. Basic functionality (8 tests):
   - wait for element visible
   - wait for element hidden
   - wait for text
   - wait for navigation
   - timeout option
   - polling interval
   - response structure
   - early resolution

2. Error handling (6 tests):
   - error: missing condition
   - error: invalid condition
   - error: timeout exceeded
   - error: element never appears
   - error: element never disappears
   - error: text never appears

3. Edge cases (6 tests):
   - wait with custom timeout
   - wait with polling
   - wait for dynamic content
   - wait for SPA navigation
   - wait cancellation
   - logging verification

IMPLEMENT FOR NAVIGATE (6 tests):
1. Basic functionality (4 tests):
   - navigate to URL
   - navigate with timeout
   - response structure
   - waitUntil option

2. Error handling (2 tests):
   - error: missing URL
   - error: invalid URL

IMPLEMENT FOR EVALUATE (6 tests):
1. Basic functionality (4 tests):
   - evaluate JavaScript
   - evaluate with arguments
   - response structure
   - return value handling

2. Error handling (2 tests):
   - error: missing expression
   - error: evaluation fails

REQUIREMENTS:
- Mock browser appropriately
- Test all error paths
- Verify response structures
- Include logging tests
- Test correlation ID propagation

START BY:
1. Read route implementations
2. Create act-complex.integration.test.ts
3. Implement tests group by group
4. Run and verify all pass
```

---

### TASK B3: Act Route Tests - Advanced Actions (Priority: 🟡 High)

**Files:** `src/__tests__/integration/routes/act-advanced.integration.test.ts`  
**Target:** 36 tests total  
**Time:** 90 minutes

**Prompt for AI Agent:**
```
You are implementing integration tests for advanced act routes.

CONTEXT:
- Routes: discover_dropdown, close_dropdown, query_state, detect_blocker, dismiss_blocker
- Test file: src/__tests__/integration/routes/act-advanced.integration.test.ts
- Framework: Vitest with supertest

IMPLEMENT THESE TEST GROUPS:

1. discover_dropdown (6 tests):
   - discover dropdown options
   - dropdown with many options
   - empty dropdown
   - error: element not dropdown
   - error: element not found
   - response structure

2. close_dropdown (5 tests):
   - close open dropdown
   - close with no dropdown
   - error: element not found
   - response structure
   - logging verification

3. query_state (8 tests):
   - query element visible
   - query element hidden
   - query element disabled
   - query element text
   - query element value
   - query multiple states
   - error: element not found
   - response structure

4. detect_blocker (5 tests):
   - detect cookie banner
   - detect popup
   - no blocker detected
   - error: detection fails
   - response structure

5. dismiss_blocker (7 tests):
   - dismiss cookie banner
   - dismiss popup
   - dismiss with custom selector
   - no blocker to dismiss
   - error: dismiss fails
   - response structure
   - logging verification

6. Additional actions (25 tests combined):
   - drag (8 tests)
   - hover (6 tests)
   - scroll (6 tests)
   - select (5 tests)

REQUIREMENTS:
- Mock browser module
- Test all error paths
- Verify response structures
- Include logging tests

START BY:
1. Read route implementations
2. Create test file
3. Implement systematically
4. Run and verify
```

---

### TASK B4: Hooks & Screenshot Tests (Priority: 🟡 High)

**Files:** `src/__tests__/integration/routes/hooks-screenshot.integration.test.ts`  
**Target:** 42 tests total  
**Time:** 90 minutes

**Prompt for AI Agent:**
```
You are implementing integration tests for hooks and screenshot routes.

CONTEXT:
- Routes: POST /hooks/file-chooser, POST /hooks/dialog, POST /screenshot, POST /screenshot/labeled
- Test file: src/__tests__/integration/routes/hooks-screenshot.integration.test.ts
- Framework: Vitest with supertest

IMPLEMENT FOR FILE-CHOOSER (15 tests):
1. Basic functionality (6 tests):
   - accept file chooser
   - accept with multiple files
   - cancel file chooser
   - wait for file chooser
   - timeout handling
   - response structure

2. Error handling (5 tests):
   - error: no file chooser
   - error: timeout exceeded
   - error: invalid file path
   - error: file not found
   - error: browser unavailable

3. Edge cases (4 tests):
   - file chooser auto-accept
   - file chooser with filter
   - logging verification
   - correlation ID propagation

IMPLEMENT FOR DIALOG (12 tests):
1. Basic functionality (5 tests):
   - accept alert
   - accept confirm
   - dismiss confirm
   - accept prompt with value
   - response structure

2. Error handling (4 tests):
   - error: no dialog
   - error: timeout exceeded
   - error: invalid dialog type
   - error: browser unavailable

3. Edge cases (3 tests):
   - dialog auto-accept
   - multiple dialogs
   - logging verification

IMPLEMENT FOR SCREENSHOT (15 tests):
1. Basic functionality (6 tests):
   - full page screenshot
   - viewport screenshot
   - element screenshot (with ref)
   - quality option
   - format option (png/jpeg)
   - response with base64

2. Error handling (5 tests):
   - error: element not found
   - error: invalid format
   - error: invalid quality
   - error: browser unavailable
   - error: timeout exceeded

3. Edge cases (4 tests):
   - large page screenshot
   - screenshot with loading
   - logging verification
   - correlation ID propagation

IMPLEMENT FOR LABELED SCREENSHOT (12 tests):
1. Basic functionality (5 tests):
   - labeled viewport
   - labeled element
   - label customization
   - response structure
   - image with labels

2. Error handling (4 tests):
   - error: element not found
   - error: invalid labels
   - error: browser unavailable
   - error: timeout exceeded

3. Edge cases (3 tests):
   - many labels
   - overlapping labels
   - logging verification

REQUIREMENTS:
- Mock browser and file system
- Test binary response handling
- Verify base64 encoding
- Include error tests

START BY:
1. Read route implementations
2. Create test file
3. Implement all groups
4. Run and verify
```

---

### TASK B5: Error Scenario Tests (Priority: 🔴 Critical)

**File:** `src/__tests__/integration/error-scenarios.integration.test.ts`  
**Target:** 45 tests  
**Time:** 90 minutes

**Prompt for AI Agent:**
```
You are implementing comprehensive error scenario tests.

CONTEXT:
- Test file: src/__tests__/integration/error-scenarios.integration.test.ts
- Framework: Vitest with supertest
- Goal: Test all error paths across all routes

IMPLEMENT THESE TEST GROUPS:

1. Browser unavailable scenarios (10 tests):
   - /snapshot when browser unavailable
   - /act when browser unavailable
   - /screenshot when browser unavailable
   - /hooks/file-chooser when browser unavailable
   - /hooks/dialog when browser unavailable
   - /status when browser unavailable
   - /control when browser unavailable
   - Response: 503 Service Unavailable
   - Response: 500 Internal Error
   - Error message format verification

2. Element not found scenarios (10 tests):
   - click with invalid ref
   - type with invalid ref
   - fill with invalid ref
   - screenshot with invalid ref
   - wait for non-existent element
   - query_state for missing element
   - discover_dropdown on missing element
   - Error: 400 Bad Request
   - Error message includes ref
   - Suggestion to run new snapshot

3. Timeout scenarios (10 tests):
   - snapshot timeout
   - act timeout
   - wait timeout
   - file-chooser timeout
   - dialog timeout
   - screenshot timeout
   - navigate timeout
   - Custom timeout values
   - Timeout error format
   - Logging timeout events

4. Validation error scenarios (10 tests):
   - missing required fields
   - invalid field types
   - invalid enum values
   - invalid ref format
   - invalid URL format
   - invalid timeout value
   - invalid quality value
   - invalid format value
   - Extra unknown fields
   - Empty request body

5. Configuration error scenarios (5 tests):
   - evaluate disabled by config
   - feature disabled by config
   - profile not configured
   - port already in use
   - invalid configuration

REQUIREMENTS:
- Test error response format consistency
- Verify HTTP status codes
- Check error message clarity
- Include correlation ID in errors
- Test logging of errors

START BY:
1. Review error handling in routes
2. Create error-scenarios.integration.test.ts
3. Implement all groups
4. Verify consistent error formats
```

---

### TASK B6: Browser Lifecycle Tests (Priority: 🟡 High)

**File:** `src/__tests__/integration/browser-lifecycle.integration.test.ts`  
**Target:** 30 tests  
**Time:** 60 minutes

**Prompt for AI Agent:**
```
You are implementing browser lifecycle integration tests.

CONTEXT:
- Test file: src/__tests__/integration/browser-lifecycle.integration.test.ts
- Framework: Vitest with supertest
- Goal: Test browser launch, management, and cleanup

IMPLEMENT THESE TEST GROUPS:

1. Browser launch lifecycle (10 tests):
   - launch browser with default config
   - launch browser headless
   - launch with custom viewport
   - launch with custom CDP port
   - launch with profile
   - launch timeout handling
   - launch failure handling
   - browser already running
   - port already in use
   - logging verification

2. Browser connection (10 tests):
   - connect to running browser
   - connection retry logic
   - connection timeout
   - WebSocket URL resolution
   - CDP endpoint discovery
   - connection with auth
   - connection failure
   - reconnection after disconnect
   - multiple connection attempts
   - logging verification

3. Browser cleanup (10 tests):
   - graceful browser close
   - force close on timeout
   - profile cleanup
   - context cleanup
   - page cleanup
   - event listener cleanup
   - resource release
   - cleanup on error
   - cleanup on signal
   - logging verification

REQUIREMENTS:
- Mock Chrome launcher
- Test process management
- Verify cleanup on errors
- Include logging tests

START BY:
1. Read browser lifecycle code
2. Create test file
3. Implement all groups
4. Run and verify
```

---

### TASK B7: Profile Management Tests (Priority: 🟡 High)

**File:** `src/__tests__/integration/profile-management.integration.test.ts`  
**Target:** 20 tests  
**Time:** 60 minutes

**Prompt for AI Agent:**
```
You are implementing profile management integration tests.

CONTEXT:
- Test file: src/__tests__/integration/profile-management.integration.test.ts
- Framework: Vitest with supertest
- Goal: Test profile creation, switching, and management

IMPLEMENT THESE TEST GROUPS:

1. Profile creation (7 tests):
   - create new profile
   - create with custom name
   - create with custom path
   - create duplicate profile
   - create with invalid name
   - profile directory creation
   - logging verification

2. Profile switching (7 tests):
   - switch to existing profile
   - switch creates new browser
   - switch preserves state
   - switch to non-existent profile
   - switch during operation
   - switch with active tabs
   - logging verification

3. Profile cleanup (6 tests):
   - profile on close
   - profile data persistence
   - profile lock release
   - profile directory cleanup
   - profile cache clearing
   - logging verification

REQUIREMENTS:
- Mock file system
- Test profile directory handling
- Verify profile isolation
- Include logging tests

START BY:
1. Read profile management code
2. Create test file
3. Implement all groups
4. Run and verify
```

---

## ✅ Verification Checklist

```bash
# 1. Run all integration tests
npm run test:integration

# 2. Check coverage
npm run test:coverage:phase2

# 3. Verify route coverage
# All routes in src/browser/routes/ should have tests

# 4. Ensure no flaky tests
npm run test:integration && npm run test:integration && npm run test:integration

# 5. Check test count
npm run test:integration 2>&1 | grep "Tests"
# Should show 200+ integration tests
```

---

## 📊 Success Metrics

| Metric | Before | Target | After |
|--------|--------|--------|-------|
| Integration test files | 7 | 20 | TBD |
| Integration test count | ~31 | 250+ | TBD |
| Route coverage | 30% | 95%+ | TBD |
| Error scenario coverage | 0% | 100% | TBD |

---

## 🔄 Merge Strategy

```bash
# In worktree
git add -A
git commit -m "✅ Workstream B: Add 220+ integration tests for all API routes

Co-authored-by: Qwen-Coder <qwen-coder@alibabacloud.com>"

# Back in main repo
cd ../openclaw-browser
git merge workstream-b-integration
```

---

**Last Updated:** 2026-02-28  
**Status:** Ready for AI Agent Execution  
**Agent Instructions:** Start with TASK B1 (highest priority), then proceed sequentially
