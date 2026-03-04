# Tailorec Browser Service

**Version:** 1.0.0  
**Description:** Industry-grade browser automation service for LLM-powered workflows

A specialized browser automation service that exposes web pages as **Semantic Accessibility Trees** for reliable, token-efficient LLM-powered automation. Unlike traditional tools that use brittle CSS/XPath selectors, this service provides stable element references and accessibility-aware page representations.

---

## ✨ Key Features

- **Semantic Accessibility Trees** - Pages represented as concise, meaningful structures instead of raw HTML
- **Stable Element References** - Elements receive persistent IDs (`[ref=e12]`) for reliable interaction
- **99% Token Reduction** - Dramatically reduces token consumption vs raw HTML
- **Modern Web Support** - Handles React/Vue/Angular, custom dropdowns, dynamic content
- **Job Application Optimized** - Specialized features for ATS platforms (Greenhouse, Lever, Ashby, etc.)
- **Comprehensive API** - Full browser control via REST endpoints

---

## 🚀 Quick Start

### 1. Install

```bash
npm install
npx playwright install chromium
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 4. Try It

```bash
# Navigate to a page
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com"}'

# Get page structure
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}'

# Click an element
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e1"}'
```

---

## 📚 Documentation

Comprehensive, industry-grade documentation is available in the [`docs/`](./docs/) folder:

### Getting Started

| Guide | Description |
|-------|-------------|
| [Installation](./docs/getting-started/installation.md) | System requirements and setup |
| [Quick Start](./docs/getting-started/quickstart.md) | Your first automation in 5 minutes |
| [Configuration](./docs/getting-started/configuration.md) | Environment variables and settings |

### Architecture

| Document | Description |
|----------|-------------|
| [Overview](./docs/architecture/overview.md) | System architecture and design |
| [Components](./docs/architecture/components.md) | Detailed component documentation |
| [Security](./docs/architecture/security.md) | Security model and best practices |

### API Reference

| Endpoint | Description |
|----------|-------------|
| [Overview](./docs/api-reference/overview.md) | API conventions and patterns |
| [Snapshot API](./docs/api-reference/snapshot.md) | Get page as semantic tree |
| [Act API](./docs/api-reference/act.md) | Perform browser actions |
| [Hooks API](./docs/api-reference/hooks.md) | Handle file uploads and dialogs |
| [Screenshot API](./docs/api-reference/screenshot.md) | Capture screenshots |
| [Control API](./docs/api-reference/control.md) | Browser lifecycle control |

### Features

| Feature | Description |
|---------|-------------|
| [Semantic Snapshots](./docs/features/semantic-snapshots.md) | Accessibility tree representation |
| [Dropdown Handling](./docs/features/dropdown-handling.md) | Native and custom dropdowns |
| [Form Filling](./docs/features/form-filling.md) | Smart form automation |
| [Job Applications](./docs/features/job-applications.md) | ATS platform automation |

### Testing

| Guide | Description |
|-------|-------------|
| [Overview](./docs/testing/overview.md) | Testing strategy and philosophy |
| [Unit Tests](./docs/testing/unit-tests.md) | Unit testing guide |
| [Integration Tests](./docs/testing/integration-tests.md) | Integration testing guide |
| [Coverage](./docs/testing/coverage.md) | Coverage thresholds and reports |

### Guides

| Guide | Description |
|-------|-------------|
| [Basic Automation](./docs/guides/basic-automation.md) | Simple automation workflows |
| [Form Automation](./docs/guides/form-automation.md) | Complex form handling |
| [Dynamic Content](./docs/guides/handling-dynamic-content.md) | Handling AJAX and SPAs |
| [Error Handling](./docs/guides/error-handling.md) | Robust error recovery |

---

## 🏗 Architecture

### System Architecture

```
┌──────────────────────────────────┐
│         LLM / Client             │
│      (open-agent or custom)      │
└────────────┬─────────────────────┘
             │ HTTP REST API
             ▼
┌──────────────────────────────────┐
│    Tailorec Browser Service      │  Port 4000
│  ┌────────────────────────────┐  │
│  │   Express HTTP Server      │  │
│  │   - /snapshot endpoints    │  │
│  │   - /act endpoints         │  │
│  │   - /hooks endpoints       │  │
│  └────────────┬───────────────┘  │
│               │ CDP              │
│  ┌────────────▼───────────────┐  │
│  │   Playwright Wrapper       │  │
│  │   - Accessibility Tree     │  │
│  │   - Element Interactions   │  │
│  │   - DOM Observer           │  │
│  └────────────┬───────────────┘  │
└───────────────┼──────────────────┘
                │ CDP
                ▼
        ┌───────────────┐
        │   Chromium    │  Port 9229
        │   Browser     │
        └───────────────┘
```

### Clean Architecture Layers

This project follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── core/              # Domain layer (business logic)
│   ├── entities/      # Business entities (BrowserSession, Tab, Profile)
│   ├── services/      # Domain services (Session, Interaction, Snapshot)
│   ├── ports/         # Interface definitions (IBrowserDriver, IEventBus)
│   └── use-cases/     # Application use cases (ExecuteAction, TakeSnapshot)
│
├── adapters/          # Infrastructure layer (external implementations)
│   ├── playwright/    # Playwright browser automation
│   ├── chrome/        # Chrome browser launcher
│   ├── http/          # Express server adapter
│   └── logging/       # Pino logger adapter
│
├── api/               # Interface layer (HTTP API)
│   ├── controllers/   # HTTP request handlers
│   ├── routes/        # Route definitions
│   ├── validators/    # Request validators (Zod schemas)
│   └── middlewares/   # Express middlewares
│
├── config/            # Configuration management
│   ├── config.ts      # Configuration loader
│   └── config.types.ts # Type definitions
│
├── container/         # Dependency injection
│   ├── container.ts   # DI container factory
│   └── container.types.ts # Container types
│
├── shared/            # Cross-cutting utilities
│   ├── errors/        # Error classes
│   ├── types/         # Type utilities
│   └── utils/         # Helper functions
│
└── server.ts          # Application entry point
```

**Key Design Principles:**
- **Dependency Rule:** Dependencies point inward (outer layers depend on inner layers)
- **Separation of Concerns:** Each layer has a single responsibility
- **Testability:** Core logic is isolated and easily testable
- **Replaceability:** Adapters can be swapped without changing business logic

See [Architecture Overview](./docs/architecture/overview.md) for more details.

---

## 📖 API Overview

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/snapshot` | POST | Get page as semantic accessibility tree |
| `/act` | POST | Perform browser action (click, type, navigate, etc.) |
| `/screenshot` | POST | Take a screenshot |
| `/hooks/file-chooser` | POST | Handle file upload dialogs |
| `/hooks/dialog` | POST | Handle JavaScript alerts/confirms |
| `/status` | GET | Service health check |
| `/control` | GET | Browser lifecycle control |

### Example: Snapshot

**Request:**
```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}'
```

**Response:**
```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://example.com",
  "snapshot": "- heading \"Welcome\" [ref=e1]\n- button \"Login\" [ref=e2]",
  "refs": {
    "e1": { "role": "heading", "name": "Welcome" },
    "e2": { "role": "button", "name": "Login" }
  }
}
```

### Example: Action

**Click:**
```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e2"}'
```

**Type:**
```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "type", "ref": "e3", "text": "hello"}'
```

**Navigate:**
```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com"}'
```

See [API Reference](./docs/api-reference/overview.md) for complete documentation.

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP server port |
| `BROWSER_HEADLESS` | `false` | Run browser in headless mode |
| `BROWSER_VIEWPORT` | `1280x720` | Browser viewport size (WIDTHxHEIGHT) |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `LOG_FORMAT` | `json` | Log format (json, pretty) |
| `LOG_TO_FILE` | `true` | Enable file logging |
| `BROWSER_EVALUATE_ENABLED` | `true` | Enable JavaScript evaluation |

### Example `.env`

```env
# Server
PORT=4000

# Browser
BROWSER_HEADLESS=true
BROWSER_VIEWPORT=1280x720

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true
LOG_FILE_PATH=logs/app.log

# Security
BROWSER_EVALUATE_ENABLED=false
```

See [Configuration Guide](./docs/getting-started/configuration.md) for all options.

---

## 🎯 Use Cases

### LLM-Powered Automation

```python
# Get semantic snapshot
snapshot = get_snapshot(interactive_only=True)

# Send to LLM
response = llm.chat(f"""
Page structure:
{snapshot}

Task: Login with test@example.com

What actions should I take?
""")

# Execute LLM's plan
for action in response.actions:
    execute_action(action)
```

### Form Filling

```bash
# Fill multiple fields
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "fill",
    "fields": [
      {"ref": "e1", "type": "textbox", "value": "John"},
      {"ref": "e2", "type": "email", "value": "john@example.com"}
    ]
  }'
```

### Job Application Automation

Specialized support for ATS platforms:

| Platform | Support | Features |
|----------|---------|----------|
| Greenhouse | ✅ Full | Multi-step wizard, Select2 dropdowns |
| Lever | ✅ Full | Single page, hidden file input |
| Ashby | ✅ Full | Custom React elements |
| SmartRecruiters | ✅ Full | Multi-step, LinkedIn import |
| BambooHR | ✅ Full | Simple single page |

See [Job Applications Guide](./docs/features/job-applications.md) for details.

---

## 🧪 Testing

### Run Tests

```bash
# All tests
npm run test

# By category
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e

# With coverage
npm run test:coverage
```

### Coverage Status

| Phase | Lines | Statements | Functions | Branches |
|-------|-------|------------|-----------|----------|
| Phase 1 | 35% | 35% | 60% | 65% |
| Phase 2 | 50% | 50% | 65% | 70% |
| Phase 3 | 70% | 70% | 70% | 70% |

See [Testing Guide](./docs/testing/overview.md) for details.

---

## 🛠 Development

### Available Commands

```bash
# Build
npm run build        # Compile TypeScript
npm run check        # Type check only

# Run
npm start           # Start production server
npm run dev         # Development with hot reload

# Test
npm run test        # Run all tests
npm run test:unit   # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage     # With coverage
```

### Project Structure

```
openclaw-browser/
├── src/
│   ├── browser/           # Browser automation core
│   │   ├── routes/       # API route handlers
│   │   ├── pw-*.ts       # Playwright wrappers
│   │   └── *.ts          # Browser control modules
│   ├── infra/            # Infrastructure utilities
│   ├── logging/          # Logging subsystem
│   ├── __tests__/        # Test suite
│   └── server.ts         # Entry point
├── docs/                 # Documentation
│   ├── getting-started/
│   ├── architecture/
│   ├── api-reference/
│   ├── features/
│   ├── guides/
│   ├── testing/
│   └── skyvern-plan/    # Future improvement plans
├── logs/                 # Log files
├── upload-resume/        # Staged file uploads
└── package.json
```

---

## 🔒 Security

- **Evaluate Action Control** - JavaScript evaluation can be disabled
- **Isolated Browser Contexts** - Each profile has isolated browser
- **No Persistent Storage** - Upload files deleted after use
- **Local-Only CDP** - Chrome DevTools Protocol connection is local

See [Security Documentation](./docs/architecture/security.md) for details.

---

## 🐛 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Element not found" | Take new snapshot to refresh refs |
| Timeout errors | Increase `timeoutMs` parameter |
| Empty snapshot | Wait for page load with `loadState` |
| Port in use | Change `PORT` in `.env` |

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# View logs
tail -f logs/app.log
```

See [Error Handling Guide](./docs/guides/error-handling.md) for more solutions.

---

## 📊 Performance

### Token Efficiency

| Format | Characters | Reduction |
|--------|------------|-----------|
| Raw HTML | ~50,000 | - |
| Semantic Snapshot | ~500 | 99% |

### Memory Usage

- **Headless mode:** ~500MB
- **Headed mode:** ~1GB
- **Per additional tab:** ~100MB

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Read the [Testing Guide](./docs/testing/overview.md)
2. Ensure all tests pass: `npm run test`
3. Maintain coverage thresholds
4. Update documentation as needed

---

## 📄 License

[Add your license information here]

---

## 🔗 Related Projects

- **open-agent** - LLM orchestrator using this browser service
- **Skyvern** - Inspiration for form-filling architecture

---

## 📞 Support

- **Documentation:** [Complete docs](./docs/)
- **API Reference:** [API docs](./docs/api-reference/overview.md)
- **Guides:** [How-to guides](./docs/guides/basic-automation.md)
- **Testing:** [Testing guide](./docs/testing/overview.md)

---

**Built with** ❤️ **by Tailorec Team**

**Last Updated:** 2026-03-03  
**Documentation Version:** 1.0.0
