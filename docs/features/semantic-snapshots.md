# Semantic Snapshots

Semantic snapshots are the core feature that makes Tailorec Browser Service unique. Instead of raw HTML, pages are represented as structured accessibility trees.

---

## What are Semantic Snapshots?

A semantic snapshot is a text representation of a web page's accessibility tree, showing only meaningful elements with stable references.

### Example Snapshot

```
- heading "Welcome to Tailorec" [ref=e1]
  - link "Home" [ref=e2]
  - link "Products" [ref=e3]
  - link "Contact" [ref=e4]
- heading "Login" [ref=e5]
  - textbox "Email" [ref=e6]
  - textbox "Password" [ref=e7]
  - button "Sign In" [ref=e8]
  - link "Forgot Password?" [ref=e9]
```

---

## Benefits

### 1. Token Efficiency

**Raw HTML:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
  <link rel="stylesheet" href="styles.css">
  <script src="analytics.js"></script>
  ... 50,000+ characters ...
</html>
```

**Semantic Snapshot:**
```
- heading "Welcome" [ref=e1]
- button "Login" [ref=e2]
```

**Reduction:** 99% fewer tokens

### 2. Stable References

HTML selectors break when structure changes:

```javascript
// Brittle CSS selector
document.querySelector('#main > div:nth-child(3) > button.primary')

// Stable semantic reference
click("e2")
```

### 3. Accessibility-Aware

Semantic snapshots include:
- ARIA labels
- Role information
- Accessible names
- State (checked, disabled, etc.)

### 4. LLM-Friendly

Structured text is easier for LLMs to understand:

```
Task: Fill login form

Snapshot:
- textbox "Email" [ref=e6]
- textbox "Password" [ref=e7]
- button "Sign In" [ref=e8]

LLM reasoning:
1. Find email textbox → e6
2. Find password textbox → e7
3. Find submit button → e8
4. Plan: type(e6, email), type(e7, password), click(e8)
```

---

## Snapshot Format

### Structure

Each line represents an element:

```
- [role] "[name]" [ref=e1]
```

**Components:**
- **Dash** (`-`) - Element marker
- **Role** - Element type (button, link, textbox, etc.)
- **Name** - Accessible name/label in quotes
- **Reference** - Stable ID in brackets

### Hierarchy

Indentation shows parent-child relationships:

```
- navigation "Main Menu" [ref=e1]
  - link "Home" [ref=e2]
  - link "About" [ref=e3]
    - link "Team" [ref=e4]
    - link "History" [ref=e5]
  - link "Contact" [ref=e6]
```

### Element Roles

#### Interactive Elements

| Role | Description | Example |
|------|-------------|---------|
| `button` | Clickable button | `button "Submit" [ref=e1]` |
| `link` | Hyperlink | `link "Home" [ref=e2]` |
| `textbox` | Text input | `textbox "Email" [ref=e3]` |
| `checkbox` | Checkbox | `checkbox "Remember me" [ref=e4]` |
| `radiobutton` | Radio button | `radiobutton "Yes" [ref=e5]` |
| `combobox` | Dropdown/autocomplete | `combobox "Country" [ref=e6]` |

#### Structural Elements

| Role | Description | Example |
|------|-------------|---------|
| `heading` | Section heading | `heading "Welcome" [ref=e1]` |
| `image` | Image | `image "Logo" [ref=e2]` |
| `text` | Static text | `text "Copyright 2026" [ref=e3]` |
| `group` | Element group | `group "" [ref=e4]` |

#### Landmarks

| Role | Description | Example |
|------|-------------|---------|
| `banner` | Site header | `banner "Site Header" [ref=e1]` |
| `navigation` | Navigation | `navigation "Main Menu" [ref=e2]` |
| `main` | Main content | `main "Page Content" [ref=e3]` |
| `complementary` | Sidebar | `complementary "Sidebar" [ref=e4]` |
| `contentinfo` | Footer | `contentinfo "Footer" [ref=e5]` |

---

## Snapshot Options

### interactiveOnly

Return only interactive elements:

**Standard:**
```
- heading "Login" [ref=e1]
- textbox "Email" [ref=e2]
- textbox "Password" [ref=e3]
- button "Sign In" [ref=e4]
- text "Copyright 2026" [ref=e5]
```

**Interactive Only:**
```
- textbox "Email" [ref=e2]
- textbox "Password" [ref=e3]
- button "Sign In" [ref=e4]
```

**Token savings:** ~40%

### compact

Remove structural containers:

**Standard:**
```
- group "" [ref=e1]
  - heading "Login" [ref=e2]
  - group "" [ref=e3]
    - textbox "Email" [ref=e4]
    - textbox "Password" [ref=e5]
    - button "Sign In" [ref=e6]
```

**Compact:**
```
- heading "Login" [ref=e2]
  - textbox "Email" [ref=e4]
  - textbox "Password" [ref=e5]
  - button "Sign In" [ref=e6]
```

**Token savings:** ~20%

---

## Reference System

### How References Work

1. **Snapshot creates refs:** Each element gets unique ID (`e1`, `e2`, etc.)
2. **Refs stored server-side:** Mapped to actual DOM elements
3. **Actions use refs:** `click("e1")` finds element by ref
4. **Refs invalidated on change:** Navigation or DOM change clears refs

### Reference Lifecycle

```
┌─────────────┐
│  Snapshot   │
│  Request    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Extract A11y    │
│ Tree from Page  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Assign Refs     │
│ (e1, e2, e3...) │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Store Ref Map   │
│ in Memory       │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Return Snapshot │
│ with Refs       │
└─────────────────┘

Later...

┌─────────────┐
│  Action     │
│  click(e2)  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Look Up e2      │
│ in Ref Map      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Find DOM        │
│ Element         │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Perform Click   │
└─────────────────┘
```

### Reference Validity

**Refs are valid until:**
- Page navigation
- DOM structure change
- Tab close
- New snapshot (refs refreshed)

**Check ref validity:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "query_state",
    "ref": "e12"
  }'
```

---

## Use Cases

### 1. LLM-Powered Automation

```python
# Send snapshot to LLM
snapshot = get_snapshot(interactive_only=True)
prompt = f"""
Page structure:
{snapshot}

Task: Login with test@example.com

What actions should I take?
"""

# LLM returns action plan
# 1. type(e6, "test@example.com")
# 2. type(e7, "password123")
# 3. click(e8)
```

### 2. Form Filling

```
Snapshot:
- heading "Registration" [ref=e1]
  - textbox "First Name" [ref=e2]
  - textbox "Last Name" [ref=e3]
  - textbox "Email" [ref=e4]
  - combobox "Country" [ref=e5]
  - checkbox "Accept Terms" [ref=e6]
  - button "Register" [ref=e7]

Actions:
1. type(e2, "John")
2. type(e3, "Doe")
3. type(e4, "john@example.com")
4. click(e5) → discover_dropdown → click option
5. click(e6)
6. click(e7)
```

### 3. Navigation

```
Snapshot:
- navigation "Main" [ref=e1]
  - link "Home" [ref=e2]
  - link "Products" [ref=e3]
    - link "Software" [ref=e4]
    - link "Hardware" [ref=e5]
  - link "About" [ref=e6]
  - link "Contact" [ref=e7]

Task: Go to Software page
Action: click(e4)
```

---

## Best Practices

### 1. Use interactiveOnly for LLM

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}'
```

Reduces tokens, focuses on actionable elements.

### 2. Take Snapshot After Each Page Change

```bash
# Navigate
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com"}'

# Wait for load
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "loadState": "load"}'

# Take new snapshot (refs refreshed)
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}'
```

### 3. Parse Refs Programmatically

```javascript
const snapshot = await getSnapshot();

// Find all buttons
const buttons = Object.entries(snapshot.refs)
  .filter(([_, ref]) => ref.role === 'button');

// Find by name
const submitButton = Object.entries(snapshot.refs)
  .find(([_, ref]) => ref.role === 'button' && ref.name === 'Submit');
```

### 4. Handle Large Pages

```bash
# Use maxChars to limit token usage
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "interactiveOnly": true,
    "maxChars": 5000
  }'
```

---

## Troubleshooting

### Empty Snapshot

**Problem:** Snapshot is empty

**Solutions:**
1. Wait for page load
2. Check page has content
3. Increase timeout

### Stale References

**Problem:** "Element not found" error

**Cause:** Page changed, refs are stale

**Solution:** Take new snapshot

### Missing Elements

**Problem:** Expected element not in snapshot

**Causes:**
1. Element not interactive (use standard snapshot)
2. Element in iframe (not yet supported)
3. Element hidden (display: none)

**Solutions:**
1. Use `interactiveOnly: false`
2. Check element visibility
3. Wait for dynamic content

---

**Last Updated:** 2026-03-03
