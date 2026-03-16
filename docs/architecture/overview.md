# Architecture Overview

This document describes the high-level architecture of Tailorec Browser Service.

---

## System Overview

Tailorec Browser Service is a specialized browser automation service that exposes web pages as **Semantic Accessibility Trees** rather than raw HTML. This approach enables LLM-powered automation with token efficiency and reliable element interaction.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Client / LLM                         │
│              (open-agent or custom client)              │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP REST API (JSON)
                     │ Port 4000
                     ▼
┌─────────────────────────────────────────────────────────┐
│           Tailorec Browser Service                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │            Express HTTP Server                    │ │
│  │                                                   │ │
│  │  Routes:                                          │ │
│  │  • /snapshot  - Get page structure                │ │
│  │  • /act       - Perform actions                   │ │
│  │  • /screenshot - Capture images                   │ │
│  │  • /hooks     - Handle dialogs/uploads            │ │
│  │  • /control   - Browser lifecycle                 │ │
│  └───────────────────┬───────────────────────────────┘ │
│                      │                                  │
│  ┌───────────────────▼───────────────────────────────┐ │
│  │         Playwright Wrapper Layer                  │ │
│  │                                                   │ │
│  │  • pw-tools-core.snapshot.ts  - Snapshots        │ │
│  │  • pw-tools-core.interactions.ts - Actions       │ │
│  │  • pw-role-snapshot.ts        - Element refs     │ │
│  │  • pw-session.ts              - State management │ │
│  │  • pw-tools-core.dom-observer.ts - Delta tracking│ │
│  └───────────────────┬───────────────────────────────┘ │
│                      │                                  │
│  ┌───────────────────▼───────────────────────────────┐ │
│  │         Logging & Infrastructure                  │ │
│  │                                                   │ │
│  │  • logging/subsystem.ts  - Structured logging    │ │
│  │  • infra/errors.ts       - Error handling        │ │
│  │  • infra/ports.ts        - Port management       │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │ Chrome DevTools Protocol (CDP)
                     │ Port 9229
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Chromium Browser                       │
│                                                         │
│  • Renders web pages                                    │
│  • Exposes accessibility tree                           │
│  • Executes user interactions                           │
└─────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Express HTTP Server

**Location:** `src/browser/server.ts`, `src/browser/routes/`

**Responsibilities:**
- HTTP request routing
- Request/response parsing
- Error handling
- Profile management

**Key Routes:**

| Route | Method | Handler |
|-------|--------|---------|
| `/status` | GET | `registerBrowserBasicRoutes` |
| `/snapshot` | POST | `registerBrowserAgentSnapshotRoutes` |
| `/act` | POST | `registerBrowserAgentActRoutes` |
| `/screenshot` | POST | `registerBrowserAgentActRoutes` |
| `/hooks/*` | POST | `registerBrowserAgentActRoutes` |
| `/control` | GET | `registerBrowserControlRoutes` |

---

### 2. Playwright Wrapper Layer

**Location:** `src/browser/pw-*.ts`

**Responsibilities:**
- Browser tab management
- Accessibility tree extraction
- Element interaction
- State synchronization

**Key Modules:**

#### pw-tools-core.snapshot.ts

Generates semantic snapshots:

```typescript
snapshotAiViaPlaywright({
  cdpUrl,
  targetId,
  options: { interactive: true, compact: true }
})
```

Returns:
- `snapshot` - Text representation of page
- `refs` - Element metadata map

#### pw-tools-core.interactions.ts

Performs browser actions:

```typescript
clickViaPlaywright({ cdpUrl, targetId, ref, button: "left" })
typeViaPlaywright({ cdpUrl, targetId, ref, text, submit: true })
```

Supported actions:
- `click`, `type`, `press`, `hover`
- `select`, `fill`, `drag`, `scrollIntoView`
- `navigate`, `wait`, `evaluate`
- `discover_dropdown`, `close_dropdown`
- `detect_blocker`, `dismiss_blocker`

#### pw-role-snapshot.ts

Builds element reference maps:

```typescript
buildRoleSnapshotFromAiSnapshot(snapshot, options)
```

Returns:
- `refs` - Map of `e1` → `{ role: "button", name: "Submit" }`
- `stats` - Snapshot statistics

#### pw-session.ts

Manages browser state:

```typescript
getPageForTargetId({ cdpUrl, targetId })
storeRoleRefsForTarget({ page, cdpUrl, refs })
restoreRoleRefsForTarget({ page, cdpUrl })
```

#### pw-tools-core.dom-observer.ts

Tracks DOM changes:

```typescript
startDomObserver({ page, anchorRef })
snapshotDeltaViaPlaywright({ action: "start", anchorRef: "e1" })
```

Returns:
- `added` - New elements
- `removed` - Removed elements
- `modified` - Changed elements

---

### 3. Logging Subsystem

**Location:** `src/logging/`

**Components:**

#### logging/subsystem.ts

Structured logging with correlation IDs:

```typescript
const log = createSubsystemLogger("browser-act");
log.info("action click started", { ref: "e12" });
log.exception("action click failed", error, { ref: "e12" });
```

Features:
- JSON or console formatting
- Log rotation
- Correlation ID tracking
- Subsystem tagging

#### logging/correlation.ts

Request correlation:

```typescript
const correlationId = generateCorrelationId();
```

Ensures logs can be traced across requests.

---

### 4. Infrastructure Layer

**Location:** `src/infra/`

**Components:**

#### infra/errors.ts

Error types and handling:

```typescript
class BrowserError extends Error {
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}
```

#### infra/ports.ts

Port management:

```typescript
const port = await findAvailablePort(4000);
```

#### infra/ws.ts

WebSocket utilities (for future use).

---

## Data Flow

### Snapshot Request Flow

```
Client
  │
  │ POST /snapshot
  │ { interactiveOnly: true }
  ▼
Express Server
  │
  │ Route to handler
  ▼
registerBrowserAgentSnapshotRoutes
  │
  │ Extract profile context
  ▼
getPwAiModule()
  │
  │ Get Playwright instance
  ▼
snapshotAiViaPlaywright()
  │
  │ Connect via CDP
  │ Extract accessibility tree
  │ Build role snapshot
  │ Store refs
  ▼
{ snapshot, refs, truncated }
  │
  │ JSON response
  ▼
Client
```

### Action Request Flow

```
Client
  │
  │ POST /act
  │ { kind: "click", ref: "e12" }
  ▼
Express Server
  │
  │ Route to handler
  ▼
registerBrowserAgentActRoutes
  │
  │ Validate request
  │ Extract profile context
  ▼
getPwAiModule()
  │
  │ Get Playwright instance
  ▼
clickViaPlaywright()
  │
  │ Find element by ref
  │ Perform click
  │ Wait for completion
  ▼
{ ok: true, targetId, url }
  │
  │ JSON response
  ▼
Client
```

---

## State Management

### Browser State

Browser state is managed per-profile:

```typescript
interface BrowserState {
  profiles: Map<string, ProfileConfig>;
  resolved: ResolvedConfig;
}
```

### Tab State

Each tab has a target ID:

```typescript
interface TabState {
  targetId: string;
  url: string;
  title: string;
}
```

### Reference State

Element references are stored per-tab:

```typescript
interface RefState {
  refs: RoleRefMap;
  mode: "role" | "aria";
  timestamp: number;
}
```

Refs are:
- **Stored** after snapshot
- **Restored** before action
- **Cleared** on navigation

---

## Security Model

### Isolation

- Each profile has isolated browser context
- Tabs are isolated by target ID
- No cross-tab data sharing

### Access Control

- Control token required for `/control` endpoint
- File uploads restricted to temp directory
- Evaluate action can be disabled

### Data Protection

- Upload files deleted after use (configurable)
- Logs rotated and limited
- No persistent storage of credentials

---

## Performance Considerations

### Token Efficiency

Semantic snapshots reduce token usage:

**Raw HTML:** ~50,000 characters  
**Semantic Snapshot:** ~500 characters  
**Reduction:** 99%

### Memory Management

- Headless mode reduces memory by ~50%
- Viewport size affects memory usage
- Tabs should be closed when not needed

### CDP Connection

- Single CDP session per tab
- Session reused across requests
- Detached on tab close

---

## Extensibility

### Adding New Actions

1. Add action kind to `agent.act.shared.ts`
2. Implement in `pw-tools-core.interactions.ts`
3. Add route handler in `agent.act.ts`
4. Update documentation

### Adding New Snapshot Modes

1. Implement in `pw-tools-core.snapshot.ts`
2. Add options to `pw-role-snapshot.ts`
3. Update route handler in `agent.snapshot.ts`
4. Update documentation

### Adding New Hooks

1. Add route in `agent.act.ts`
2. Implement in `pw-tools-core.*.ts`
3. Update documentation

---

## Deployment Architecture

### Single Instance

```
┌─────────────────────┐
│  Tailorec Browser   │
│      Service        │
│  ┌───────────────┐  │
│  │   Chromium    │  │
│  └───────────────┘  │
└─────────────────────┘
```

### Multi-Instance (Future)

```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ Inst 1│ │ Inst 2│
│ ┌───┐ │ │ ┌───┐ │
│ │Cr │ │ │ │Cr │ │
│ └───┘ │ │ └───┘ │
└───────┘ └───────┘
```

---

## Monitoring

### Health Checks

```bash
curl http://localhost:4000/status
```

Returns:

```json
{
  "ok": true,
  "profiles": []
}
```

### Logging

Logs written to:
- Console (stdout)
- File (configurable)

Log format:

```json
{
  "level": "info",
  "subsystem": "browser-act",
  "message": "action click succeeded",
  "ref": "e12",
  "duration_ms": 45,
  "timestamp": "2026-03-03T12:00:00.000Z"
}
```

### Metrics (Future)

- Request count
- Action latency
- Error rate
- Memory usage

---

## Next Steps

- **[Components](./components.md)** - Detailed component documentation
- **[Security](./security.md)** - Security model and best practices
- **[API Reference](../api-reference/overview.md)** - Complete API docs

---

**Last Updated:** 2026-03-03
