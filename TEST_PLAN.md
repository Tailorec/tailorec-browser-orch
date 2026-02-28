# 📋 Workstream C: E2E Tests Implementation Plan

**Branch:** `workstream-c-e2e`  
**Worktree:** `openclaw-browser-worktree-c`  
**Priority:** 🔴 CRITICAL  
**Target:** Add 110+ E2E tests for critical user flows  
**Estimated Time:** 8-10 hours with AI agent assistance

---

## 🎯 Objectives

This workstream focuses on implementing comprehensive E2E tests using Playwright Test:

| Category | Target Tests | Current | Gap | Priority |
|----------|-------------|---------|-----|----------|
| Job Application Flows | 18 tests | 2 | -16 | 🔴 Critical |
| Form Filling Accuracy | 8 tests | 0 | -8 | 🔴 Critical |
| Error Recovery | 8 tests | 0 | -8 | 🟡 High |
| Browser Control Flows | 32 tests | 0 | -32 | 🟡 High |
| Edge Cases | 15 tests | 0 | -15 | 🟡 High |
| Concurrency & Stress | 18 tests | 0 | -18 | 🟢 Medium |
| Regression Tests | 20 tests | 0 | -20 | 🟢 Medium |

---

## 📁 Files to Create

```
src/__tests__/e2e/
├── smoke.e2e.spec.ts                        # EXISTS - keep
└── flows/
    ├── job-application-basic.e2e.spec.ts    # EXISTS - extend
    ├── job-application-complex.e2e.spec.ts  # EXISTS - extend
    ├── form-filling-accuracy.e2e.spec.ts    # NEW - 8 tests
    ├── file-upload-flow.e2e.spec.ts         # NEW - 6 tests
    ├── file-download-flow.e2e.spec.ts       # NEW - 5 tests
    ├── dropdown-selection-flow.e2e.spec.ts  # NEW - 6 tests
    ├── multi-step-form-flow.e2e.spec.ts    # NEW - 8 tests
    ├── authentication-flow.e2e.spec.ts      # NEW - 6 tests
    ├── search-and-filter-flow.e2e.spec.ts   # NEW - 6 tests
    └── pagination-flow.e2e.spec.ts          # NEW - 5 tests

src/__tests__/e2e/browser/
├── browser-navigation.e2e.spec.ts           # NEW - 8 tests
├── snapshot-act-loop.e2e.spec.ts            # NEW - 10 tests
├── tab-management.e2e.spec.ts               # NEW - 8 tests
├── profile-switching.e2e.spec.ts            # NEW - 6 tests
└── viewport-resizing.e2e.spec.ts            # NEW - 5 tests

src/__tests__/e2e/error-recovery/
├── timeout-recovery.e2e.spec.ts             # NEW - 6 tests
├── stale-element-recovery.e2e.spec.ts       # NEW - 5 tests
├── network-error-recovery.e2e.spec.ts       # NEW - 6 tests
├── browser-crash-recovery.e2e.spec.ts       # NEW - 5 tests
└── session-recovery.e2e.spec.ts             # NEW - 6 tests

src/__tests__/e2e/edge-cases/
├── long-page-handling.e2e.spec.ts           # NEW - 5 tests
├── infinite-scroll.e2e.spec.ts              # NEW - 5 tests
├── lazy-loading.e2e.spec.ts                 # NEW - 5 tests
├── dynamic-content.e2e.spec.ts              # NEW - 5 tests
├── iframe-handling.e2e.spec.ts              # NEW - 5 tests
├── shadow-dom.e2e.spec.ts                   # NEW - 5 tests
└── slow-network.e2e.spec.ts                 # NEW - 5 tests

src/__tests__/e2e/concurrency/
├── multiple-tabs.e2e.spec.ts                # NEW - 6 tests
├── parallel-requests.e2e.spec.ts            # NEW - 6 tests
├── shared-session.e2e.spec.ts               # NEW - 6 tests
└── resource-contention.e2e.spec.ts          # NEW - 5 tests

src/__tests__/e2e/stress/
├── rapid-snapshot-act.e2e.spec.ts           # NEW - 6 tests
├── large-payload.e2e.spec.ts                # NEW - 5 tests
├── memory-leak.e2e.spec.ts                  # NEW - 5 tests
└── stability.e2e.spec.ts                    # NEW - 5 tests

src/__tests__/e2e/regression/
├── known-issues.e2e.spec.ts                 # NEW - 10 tests
└── past-bugs.e2e.spec.ts                    # NEW - 10 tests
```

---

## 🤖 AI Agent Tasks

### TASK C1: Job Application Flows (Priority: 🔴 Critical)

**Files:** `src/__tests__/e2e/flows/job-application-*.e2e.spec.ts`  
**Target:** Extend existing to 18 tests total  
**Time:** 90 minutes

**Prompt for AI Agent:**
```
You are extending E2E tests for job application flows.

CONTEXT:
- Existing files to extend:
  - src/__tests__/e2e/flows/job-application-basic.e2e.spec.ts (currently ~8 tests)
  - src/__tests__/e2e/flows/job-application-complex.e2e.spec.ts (currently ~2 tests)
- Framework: Playwright Test (@playwright/test)
- Uses real browser control server

EXTEND job-application-basic.e2e.spec.ts TO 10 TESTS:
1. Navigate to job board - verify page loads
2. Search for jobs - enter keywords and submit
3. Open job detail page - click job listing
4. Click apply button - verify form opens
5. Fill basic info form - name, email, phone
6. Upload resume - attach file and verify
7. Submit application - complete submission
8. Verify submission confirmation - success message
9. Test form validation - submit empty form
10. Test navigation - back/forward during application

EXTEND job-application-complex.e2e.spec.ts TO 8 TESTS:
1. Multi-step application - step 1: personal info
2. Multi-step application - step 2: experience
3. Multi-step application - step 3: education
4. Multi-step application - step 4: questions
5. Multi-step application - step 5: review
6. Save and resume later functionality
7. Progress indicator verification
8. Step validation before proceeding

REQUIREMENTS:
- Use real browser via startBrowserControlServerFromConfig
- Include video recording on failure
- Capture screenshots on failure
- Test with headless: true
- Use proper test isolation (clean state each test)
- Include proper beforeAll/afterAll hooks
- Add descriptive test names

START BY:
1. Read existing E2E test files
2. Understand the test page structure
3. Extend existing tests systematically
4. Run: npm run test:e2e -- job-application
5. Verify all tests pass with video/screenshots
```

---

### TASK C2: Form Filling Accuracy Tests (Priority: 🔴 Critical)

**File:** `src/__tests__/e2e/flows/form-filling-accuracy.e2e.spec.ts`  
**Target:** 8 tests  
**Time:** 60 minutes

**Prompt for AI Agent:**
```
You are implementing E2E tests for form filling accuracy.

CONTEXT:
- Test file: src/__tests__/e2e/flows/form-filling-accuracy.e2e.spec.ts
- Framework: Playwright Test
- Use test HTML pages from src/__tests__/fixtures/pages/

IMPLEMENT THESE TESTS:

1. Text field accuracy:
   - Fill single-line text input
   - Verify exact value match
   - Test with special characters (!@#$%^&*)
   - Test with unicode (émojis, accented chars)

2. Email field validation:
   - Fill valid email
   - Verify email format preserved
   - Test email with plus addressing
   - Test email with subdomain

3. Phone field formatting:
   - Fill phone with various formats
   - Test: (123) 456-7890
   - Test: +1-123-456-7890
   - Test: 1234567890

4. Date field formats:
   - Fill date input
   - Test ISO format (YYYY-MM-DD)
   - Test US format (MM/DD/YYYY)
   - Verify date picker interaction

5. Dropdown selection accuracy:
   - Select option by value
   - Select option by label
   - Verify selection persisted
   - Test with optgroups

6. Radio button selection:
   - Select single radio option
   - Verify only one selected
   - Change selection
   - Verify previous deselected

7. Checkbox handling:
   - Check single checkbox
   - Uncheck checkbox
   - Check multiple checkboxes
   - Verify all states

8. Textarea with special chars:
   - Fill multiline text
   - Include newlines
   - Include tabs
   - Include special characters
   - Verify exact content preserved

REQUIREMENTS:
- Use complex-form.html fixture
- Test with real browser
- Verify values after submission
- Include screenshots for visual verification
- Test edge cases (empty, very long values)

START BY:
1. Read complex-form.html structure
2. Create form-filling-accuracy.e2e.spec.ts
3. Implement all 8 tests
4. Run and verify
```

---

### TASK C3: File Operations Flows (Priority: 🟡 High)

**Files:** `src/__tests__/e2e/flows/file-*.e2e.spec.ts`  
**Target:** 11 tests total  
**Time:** 60 minutes

**Prompt for AI Agent:**
```
You are implementing E2E tests for file upload and download flows.

CONTEXT:
- Test files to create:
  - src/__tests__/e2e/flows/file-upload-flow.e2e.spec.ts (6 tests)
  - src/__tests__/e2e/flows/file-download-flow.e2e.spec.ts (5 tests)
- Framework: Playwright Test
- Use test files from src/__tests__/fixtures/files/

IMPLEMENT FOR FILE UPLOAD (6 tests):
1. Upload text file:
   - Navigate to upload page
   - Attach test-upload.txt
   - Submit form
   - Verify upload success

2. Upload JSON file:
   - Attach test-data.json
   - Verify file type detection
   - Verify content preview

3. Upload CSV file:
   - Attach test-data.csv
   - Verify parsing
   - Verify row count display

4. Multiple file upload:
   - Select multiple files
   - Verify all listed
   - Submit all
   - Verify all uploaded

5. Large file handling:
   - Upload larger file
   - Verify progress indicator
   - Verify completion

6. Upload validation:
   - Try invalid file type
   - Verify error message
   - Try file too large
   - Verify rejection

IMPLEMENT FOR FILE DOWNLOAD (5 tests):
1. Download PDF file:
   - Navigate to download page
   - Click download link
   - Verify download starts
   - Verify file saved

2. Download with confirmation:
   - Click download
   - Wait for confirmation
   - Verify file exists

3. Multiple downloads:
   - Download multiple files
   - Verify all complete
   - Verify file integrity

4. Download cancellation:
   - Start download
   - Cancel mid-download
   - Verify cleanup

5. Download error handling:
   - Trigger download error
   - Verify error message
   - Verify retry option

REQUIREMENTS:
- Use Playwright download handling
- Set download path to temp directory
- Verify file contents after download
- Clean up downloaded files

START BY:
1. Read file-upload-page.html
2. Create test files
3. Implement all tests
4. Run and verify
```

---

### TASK C4: Browser Control Flows (Priority: 🟡 High)

**Files:** `src/__tests__/e2e/browser/*.e2e.spec.ts`  
**Target:** 32 tests total  
**Time:** 120 minutes

**Prompt for AI Agent:**
```
You are implementing E2E tests for browser control flows.

CONTEXT:
- Test files to create in src/__tests__/e2e/browser/:
  - browser-navigation.e2e.spec.ts (8 tests)
  - snapshot-act-loop.e2e.spec.ts (10 tests)
  - tab-management.e2e.spec.ts (8 tests)
  - profile-switching.e2e.spec.ts (6 tests)
  - viewport-resizing.e2e.spec.ts (5 tests)
- Framework: Playwright Test
- Uses browser control server API

IMPLEMENT FOR BROWSER-NAVIGATION (8 tests):
1. Navigate to URL via API
2. Navigate back
3. Navigate forward
4. Refresh page
5. Navigate to invalid URL
6. Navigate with timeout
7. Navigate during loading
8. Navigation history verification

IMPLEMENT FOR SNAPSHOT-ACT-LOOP (10 tests):
1. Basic snapshot-act cycle
2. Multiple sequential actions
3. Snapshot after each action
4. Ref resolution across snapshots
5. Dynamic content handling
6. Error in act recovery
7. Timeout in loop
8. Complex multi-step flow
9. State preservation
10. Logging verification

IMPLEMENT FOR TAB-MANAGEMENT (8 tests):
1. Open new tab
2. Switch between tabs
3. Close tab
4. Multiple tabs open
5. Tab content verification
6. Tab close cleanup
7. Tab crash recovery
8. Tab list verification

IMPLEMENT FOR PROFILE-SWITCHING (6 tests):
1. Switch profile via API
2. Profile state preservation
3. Profile-specific data
4. Switch during operation
5. Invalid profile handling
6. Default profile fallback

IMPLEMENT FOR VIEWPORT-RESIZING (5 tests):
1. Resize viewport via API
2. Verify new dimensions
3. Responsive layout check
4. Multiple resize operations
5. Invalid size handling

REQUIREMENTS:
- Use browser control API
- Test via HTTP requests
- Verify browser state changes
- Include error recovery

START BY:
1. Read browser control API
2. Create test files
3. Implement systematically
4. Run and verify
```

---

### TASK C5: Error Recovery Tests (Priority: 🟡 High)

**Files:** `src/__tests__/e2e/error-recovery/*.e2e.spec.ts`  
**Target:** 28 tests total  
**Time:** 90 minutes

**Prompt for AI Agent:**
```
You are implementing E2E tests for error recovery scenarios.

CONTEXT:
- Test files to create in src/__tests__/e2e/error-recovery/:
  - timeout-recovery.e2e.spec.ts (6 tests)
  - stale-element-recovery.e2e.spec.ts (5 tests)
  - network-error-recovery.e2e.spec.ts (6 tests)
  - browser-crash-recovery.e2e.spec.ts (5 tests)
  - session-recovery.e2e.spec.ts (6 tests)
- Framework: Playwright Test

IMPLEMENT FOR TIMEOUT-RECOVERY (6 tests):
1. Action timeout and retry
2. Navigation timeout recovery
3. Snapshot timeout handling
4. Custom timeout configuration
5. Timeout with fallback action
6. Timeout error reporting

IMPLEMENT FOR STALE-ELEMENT-RECOVERY (5 tests):
1. Element becomes stale during action
2. Auto-retry with new ref
3. Re-snapshot before retry
4. Stale element error handling
5. Multiple stale attempts

IMPLEMENT FOR NETWORK-ERROR-RECOVERY (6 tests):
1. Network request failure
2. Auto-retry on failure
3. Exponential backoff
4. Network recovery notification
5. Persistent failure handling
6. Offline mode handling

IMPLEMENT FOR BROWSER-CRASH-RECOVERY (5 tests):
1. Browser process crash
2. Auto-restart browser
3. Session restoration
4. State recovery
5. Crash reporting

IMPLEMENT FOR SESSION-RECOVERY (6 tests):
1. Session timeout
2. Session restoration
3. State preservation
4. Cross-session continuity
5. Session migration
6. Session cleanup

REQUIREMENTS:
- Simulate error conditions
- Verify recovery mechanisms
- Test auto-retry logic
- Include error reporting

START BY:
1. Understand error recovery code
2. Create test files
3. Implement error simulation
4. Verify recovery
```

---

### TASK C6: Edge Cases Tests (Priority: 🟡 High)

**Files:** `src/__tests__/e2e/edge-cases/*.e2e.spec.ts`  
**Target:** 35 tests total  
**Time:** 120 minutes

**Prompt for AI Agent:**
```
You are implementing E2E tests for edge cases.

CONTEXT:
- Test files to create in src/__tests__/e2e/edge-cases/:
  - long-page-handling.e2e.spec.ts (5 tests)
  - infinite-scroll.e2e.spec.ts (5 tests)
  - lazy-loading.e2e.spec.ts (5 tests)
  - dynamic-content.e2e.spec.ts (5 tests)
  - iframe-handling.e2e.spec.ts (5 tests)
  - shadow-dom.e2e.spec.ts (5 tests)
  - slow-network.e2e.spec.ts (5 tests)
- Framework: Playwright Test

IMPLEMENT FOR LONG-PAGE-HANDLING (5 tests):
1. Scroll to bottom of long page
2. Snapshot entire page
3. Act on elements at bottom
4. Memory usage verification
5. Performance on long pages

IMPLEMENT FOR INFINITE-SCROLL (5 tests):
1. Trigger infinite scroll
2. Load multiple pages of content
3. Stop scrolling
4. Act on loaded content
5. Memory cleanup

IMPLEMENT FOR LAZY-LOADING (5 tests):
1. Wait for lazy-loaded images
2. Scroll to trigger loading
3. Verify loaded content
4. Act on loaded elements
5. Timeout handling

IMPLEMENT FOR DYNAMIC-CONTENT (5 tests):
1. Content changes during test
2. Real-time updates
3. WebSocket updates
4. Polling for changes
5. Content stability wait

IMPLEMENT FOR IFRAME-HANDLING (5 tests):
1. Access iframe content
2. Act within iframe
3. Nested iframes
4. Cross-origin iframe
5. Iframe timeout

IMPLEMENT FOR SHADOW-DOM (5 tests):
1. Access shadow DOM
2. Query shadow elements
3. Act on shadow elements
4. Nested shadow DOM
5. Shadow DOM timeout

IMPLEMENT FOR SLOW-NETWORK (5 tests):
1. Simulate slow network
2. Timeout configuration
3. Retry on slow response
4. Progress indication
5. Cancel slow operation

REQUIREMENTS:
- Use dynamic-content-page.html
- Simulate edge conditions
- Test timeout handling
- Verify graceful degradation

START BY:
1. Read test page structures
2. Create test files
3. Implement edge case simulation
4. Run and verify
```

---

### TASK C7: Concurrency & Stress Tests (Priority: 🟢 Medium)

**Files:** `src/__tests__/e2e/concurrency/*.e2e.spec.ts`, `src/__tests__/e2e/stress/*.e2e.spec.ts`  
**Target:** 38 tests total  
**Time:** 90 minutes

**Prompt for AI Agent:**
```
You are implementing concurrency and stress E2E tests.

CONTEXT:
- Test files for concurrency in src/__tests__/e2e/concurrency/:
  - multiple-tabs.e2e.spec.ts (6 tests)
  - parallel-requests.e2e.spec.ts (6 tests)
  - shared-session.e2e.spec.ts (6 tests)
  - resource-contention.e2e.spec.ts (5 tests)
- Test files for stress in src/__tests__/e2e/stress/:
  - rapid-snapshot-act.e2e.spec.ts (6 tests)
  - large-payload.e2e.spec.ts (5 tests)
  - memory-leak.e2e.spec.ts (5 tests)
  - stability.e2e.spec.ts (5 tests)
- Framework: Playwright Test

IMPLEMENT CONCURRENCY TESTS:
1. Multiple tabs - open and manage many tabs
2. Parallel requests - concurrent API calls
3. Shared session - session across contexts
4. Resource contention - prevent conflicts

IMPLEMENT STRESS TESTS:
1. Rapid snapshot-act - high frequency operations
2. Large payload - handle big responses
3. Memory leak - long-running operations
4. Stability - extended operation test

REQUIREMENTS:
- Test concurrent operations
- Monitor resource usage
- Verify stability under load
- Include performance metrics

START BY:
1. Create test files
2. Implement concurrency scenarios
3. Implement stress scenarios
4. Run and monitor
```

---

### TASK C8: Regression Tests (Priority: 🟢 Medium)

**Files:** `src/__tests__/e2e/regression/*.e2e.spec.ts`  
**Target:** 20 tests total  
**Time:** 60 minutes

**Prompt for AI Agent:**
```
You are implementing regression E2E tests.

CONTEXT:
- Test files to create in src/__tests__/e2e/regression/:
  - known-issues.e2e.spec.ts (10 tests)
  - past-bugs.e2e.spec.ts (10 tests)
- Framework: Playwright Test
- Document known issues and past bugs

IMPLEMENT KNOWN-ISSUES (10 tests):
- Create tests for each known issue
- Verify issue is resolved
- Include issue tracker reference
- Document expected behavior

IMPLEMENT PAST-BUGS (10 tests):
- Create tests for each past bug
- Verify bug fix
- Include bug tracker reference
- Prevent regression

REQUIREMENTS:
- Link to issue tracker
- Document expected vs actual
- Include reproduction steps
- Verify fix persistence

START BY:
1. Review issue tracker
2. Create test files
3. Implement regression tests
4. Document findings
```

---

## ✅ Verification Checklist

```bash
# 1. Run all E2E tests
npm run test:e2e

# 2. Run specific category
npm run test:e2e -- flows
npm run test:e2e -- browser
npm run test:e2e -- error-recovery

# 3. Check video recordings
# Videos saved in test-results/

# 4. Check screenshots
# Screenshots saved on failure

# 5. Ensure no flaky tests
npm run test:e2e && npm run test:e2e && npm run test:e2e

# 6. Check test count
npm run test:e2e 2>&1 | grep "Tests"
# Should show 100+ E2E tests
```

---

## 📊 Success Metrics

| Metric | Before | Target | After |
|--------|--------|--------|-------|
| E2E test files | 3 | 25 | TBD |
| E2E test count | ~10 | 120+ | TBD |
| Flow coverage | 5% | 80%+ | TBD |
| Video recordings | Yes | Yes | Yes |

---

## 🔄 Merge Strategy

```bash
# In worktree
git add -A
git commit -m "✅ Workstream C: Add 110+ E2E tests for critical user flows

Co-authored-by: Qwen-Coder <qwen-coder@alibabacloud.com>"

# Back in main repo
cd ../openclaw-browser
git merge workstream-c-e2e
```

---

**Last Updated:** 2026-02-28  
**Status:** Ready for AI Agent Execution  
**Agent Instructions:** Start with TASK C1 (highest priority), then proceed sequentially
