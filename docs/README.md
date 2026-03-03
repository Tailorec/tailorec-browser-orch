# Tailorec Browser Service Documentation

**Version:** 1.0.0  
**Description:** Industry-grade browser automation service for LLM-powered workflows

---

## 📖 Documentation Overview

Welcome to the comprehensive documentation for Tailorec Browser Service. This documentation is organized into logical sections to help you find what you need quickly.

### Documentation Structure

```
docs/
├── README.md                    # You are here - Documentation index
├── getting-started/             # Quick start and installation
│   ├── installation.md
│   ├── quickstart.md
│   └── configuration.md
├── architecture/                # System design and architecture
│   ├── overview.md
│   ├── components.md
│   └── security.md
├── api-reference/               # Complete API documentation
│   ├── overview.md
│   ├── snapshot.md
│   ├── act.md
│   ├── hooks.md
│   ├── screenshot.md
│   └── control.md
├── features/                    # Feature documentation
│   ├── semantic-snapshots.md
│   ├── dropdown-handling.md
│   ├── form-filling.md
│   ├── file-uploads.md
│   ├── blocking-elements.md
│   └── job-applications.md
├── guides/                      # How-to guides and tutorials
│   ├── basic-automation.md
│   ├── form-automation.md
│   ├── handling-dynamic-content.md
│   └── error-handling.md
├── testing/                     # Testing documentation
│   ├── overview.md
│   ├── unit-tests.md
│   ├── integration-tests.md
│   └── coverage.md
└── skyvern-plan/                # Future improvement plans (unchanged)
    └── ...
```

---

## 🚀 Quick Links

| I want to... | Go to |
|--------------|-------|
| Install and run the service | [Getting Started →](./getting-started/installation.md) |
| See API examples | [API Reference →](./api-reference/overview.md) |
| Understand how it works | [Architecture →](./architecture/overview.md) |
| Automate forms | [Form Filling Guide →](./features/form-filling.md) |
| Handle dropdowns | [Dropdown Handling →](./features/dropdown-handling.md) |
| Write tests | [Testing Guide →](./testing/overview.md) |
| Automate job applications | [Job Applications →](./features/job-applications.md) |

---

## 📚 Documentation Sections

### [Getting Started](./getting-started/)

New to Tailorec Browser Service? Start here.

- **[Installation](./getting-started/installation.md)** - System requirements and installation steps
- **[Quick Start](./getting-started/quickstart.md)** - Your first automation in 5 minutes
- **[Configuration](./getting-started/configuration.md)** - Environment variables and settings

### [Architecture](./architecture/)

Understand how the system works.

- **[Overview](./architecture/overview.md)** - High-level system architecture
- **[Components](./architecture/components.md)** - Detailed component documentation
- **[Security](./architecture/security.md)** - Security model and best practices

### [API Reference](./api-reference/)

Complete API documentation with examples.

- **[Overview](./api-reference/overview.md)** - API conventions and authentication
- **[Snapshot API](./api-reference/snapshot.md)** - Get page as semantic tree
- **[Act API](./api-reference/act.md)** - Perform browser actions
- **[Hooks API](./api-reference/hooks.md)** - Handle file uploads and dialogs
- **[Screenshot API](./api-reference/screenshot.md)** - Capture screenshots
- **[Control API](./api-reference/control.md)** - Browser lifecycle control

### [Features](./features/)

Deep dives into specific features.

- **[Semantic Snapshots](./features/semantic-snapshots.md)** - Accessibility tree representation
- **[Dropdown Handling](./features/dropdown-handling.md)** - Custom and native dropdowns
- **[Form Filling](./features/form-filling.md)** - Smart form automation
- **[File Uploads](./features/file-uploads.md)** - Upload widget handling
- **[Blocking Elements](./features/blocking-elements.md)** - Modal and overlay detection
- **[Job Applications](./features/job-applications.md)** - ATS platform automation

### [Guides](./guides/)

Practical how-to guides.

- **[Basic Automation](./guides/basic-automation.md)** - Simple automation workflows
- **[Form Automation](./guides/form-automation.md)** - Complex form handling
- **[Dynamic Content](./guides/handling-dynamic-content.md)** - Handling AJAX and SPAs
- **[Error Handling](./guides/error-handling.md)** - Robust error recovery

### [Testing](./testing/)

Testing the browser service.

- **[Overview](./testing/overview.md)** - Testing strategy and philosophy
- **[Unit Tests](./testing/unit-tests.md)** - Unit testing guide
- **[Integration Tests](./testing/integration-tests.md)** - Integration testing guide
- **[Coverage](./testing/coverage.md)** - Coverage thresholds and reports

---

## 🎯 Key Features

### Semantic Accessibility Tree

Instead of raw HTML, receive a concise, token-efficient representation:

```
- heading "Welcome" [ref=e1]
  - link "Home" [ref=e2]
  - button "Login" [ref=e3]
  - textbox "Email" [ref=e4]
  - textbox "Password" [ref=e5]
  - button "Sign Up" [ref=e6]
```

### Stable Element References

Elements receive stable Reference IDs (`[ref=e12]`) that persist across actions, enabling reliable automation without brittle CSS/XPath selectors.

### Modern Web Support

- ✅ React/Vue/Angular applications
- ✅ Custom dropdowns and comboboxes
- ✅ Dynamic content and SPAs
- ✅ File upload widgets
- ✅ Modal dialogs and overlays

### Job Application Optimized

Specialized features for ATS platforms:

| Platform | Support | Features |
|----------|---------|----------|
| Greenhouse | ✅ Full | Multi-step wizard, Select2 dropdowns |
| Lever | ✅ Full | Single page, hidden file input |
| Ashby | ✅ Full | Custom React elements |
| SmartRecruiters | ✅ Full | Multi-step, LinkedIn import |
| BambooHR | ✅ Full | Simple single page |

---

## 📞 API Overview

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

### Example: Take a Snapshot

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "interactiveOnly": true,
    "compact": true
  }'
```

**Response:**
```json
{
  "ok": true,
  "targetId": "1234.1",
  "url": "https://example.com",
  "snapshot": "- button \"Login\" [ref=e12]\n- textbox \"Username\" [ref=e13]",
  "refs": {
    "e12": { "role": "button", "name": "Login" },
    "e13": { "role": "textbox", "name": "Username" }
  }
}
```

### Example: Click an Element

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "e12"
  }'
```

**Response:**
```json
{
  "ok": true,
  "targetId": "1234.1",
  "url": "https://example.com/login"
}
```

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
├── docs/                 # This documentation
├── logs/                 # Log files
└── upload-resume/        # Staged file uploads
```

---

## 📊 Test Coverage

| Phase | Lines | Statements | Functions | Branches |
|-------|-------|------------|-----------|----------|
| Phase 1 | 35% | 35% | 60% | 65% |
| Phase 2 | 50% | 50% | 65% | 70% |
| Phase 3 | 70% | 70% | 70% | 70% |

Run tests with coverage:

```bash
npm run test:coverage
```

See [Testing Overview](./testing/overview.md) for details.

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Control server port |
| `BROWSER_HEADLESS` | `false` | Headless browser mode |
| `BROWSER_VIEWPORT` | `1280x720` | Browser viewport size (WIDTHxHEIGHT) |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `LOG_FORMAT` | `json` | Log format (json, pretty) |
| `LOG_TO_FILE` | `true` | Enable file logging |
| `LOG_FILE_PATH` | `logs/app.log` | Log file location |
| `LOG_MAX_BYTES` | `10485760` | Max log file size before rotation |
| `LOG_BACKUP_COUNT` | `5` | Number of backup log files |

See [Configuration Guide](./getting-started/configuration.md) for complete details.

---

## 🆘 Support

### Troubleshooting

- **[Error Handling Guide](./guides/error-handling.md)** - Common errors and solutions
- **[Debug Techniques](./testing/overview.md#debugging)** - Debug tools and techniques

### Getting Help

1. Check the relevant documentation section above
2. Review error messages in `logs/app.log`
3. See [API Reference](./api-reference/overview.md) for endpoint details

---

## 📄 License

[Add your license information here]

---

**Last Updated:** 2026-03-03  
**Documentation Version:** 1.0.0
