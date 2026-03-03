# Snapshot API

The Snapshot API retrieves the current state of a web page as a semantic accessibility tree.

---

## Endpoint

```
POST /snapshot
```

---

## Request

### Headers

```
Content-Type: application/json
```

### Body Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `targetId` | string | - | Browser tab identifier (optional) |
| `timeoutMs` | number | 5000 | Snapshot timeout in milliseconds |
| `maxChars` | number | - | Maximum characters in snapshot |
| `interactiveOnly` | boolean | false | Return only interactive elements |
| `compact` | boolean | false | Remove structural containers |
| `maxDepth` | number | 10 | Maximum tree depth |

### Example Request

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "interactiveOnly": true,
    "compact": true,
    "maxChars": 5000
  }'
```

---

## Response

### Success Response

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

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Success indicator |
| `targetId` | string | Browser tab identifier |
| `url` | string | Current page URL |
| `snapshot` | string | Text representation of page |
| `refs` | object | Element metadata map |
| `truncated` | boolean | True if snapshot was truncated |

### Refs Object Structure

```json
{
  "e1": {
    "role": "button",
    "name": "Submit",
    "nth": 0
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `role` | string | Element role (button, link, textbox, etc.) |
| `name` | string | Accessible name/label |
| `nth` | number | Index for duplicate elements (optional) |

---

## Snapshot Format

The `snapshot` field is a text representation of the page structure:

```
- heading "Welcome to Example" [ref=e1]
  - link "Home" [ref=e2]
  - link "About" [ref=e3]
  - textbox "Search" [ref=e4]
  - button "Search" [ref=e5]
- heading "Featured Products" [ref=e6]
  - link "Product 1" [ref=e7]
    - image "Product 1 Image" [ref=e8]
    - textbox "Quantity" [ref=e9]
    - button "Add to Cart" [ref=e10]
  - link "Product 2" [ref=e11]
    - image "Product 2 Image" [ref=e12]
    - textbox "Quantity" [ref=e13]
    - button "Add to Cart" [ref=e14]
```

### Format Rules

- **Indentation** represents hierarchy
- **Dash** (`-`) starts each element
- **Role** comes first (heading, link, button, etc.)
- **Name** in quotes (accessible name)
- **Reference** in brackets (`[ref=e1]`)

---

## Element Roles

### Common Roles

| Role | Description | Example |
|------|-------------|---------|
| `heading` | Section heading | `heading "Welcome" [ref=e1]` |
| `link` | Hyperlink | `link "Home" [ref=e2]` |
| `button` | Clickable button | `button "Submit" [ref=e3]` |
| `textbox` | Text input | `textbox "Email" [ref=e4]` |
| `checkbox` | Checkbox | `checkbox "Remember me" [ref=e5]` |
| `radiobutton` | Radio button | `radiobutton "Option 1" [ref=e6]` |
| `combobox` | Dropdown/autocomplete | `combobox "Country" [ref=e7]` |
| `listbox` | List box | `listbox "Select" [ref=e8]` |
| `menu` | Menu | `menu "File" [ref=e9]` |
| `menuitem` | Menu item | `menuitem "Open" [ref=e10]` |
| `tab` | Tab | `tab "Details" [ref=e11]` |
| `tabpanel` | Tab content | `tabpanel "Details Content" [ref=e12]` |
| `tree` | Tree view | `tree "Navigation" [ref=e13]` |
| `treeitem` | Tree item | `treeitem "Folder" [ref=e14]` |
| `grid` | Data grid | `grid "Data Table" [ref=e15]` |
| `gridcell` | Grid cell | `gridcell "Value" [ref=e16]` |
| `image` | Image | `image "Logo" [ref=e17]` |
| `img` | Image (alternative) | `img "Banner" [ref=e18]` |

### Landmark Roles

| Role | Description | Example |
|------|-------------|---------|
| `banner` | Site banner | `banner "Site Header" [ref=e1]` |
| `navigation` | Navigation | `navigation "Main Menu" [ref=e2]` |
| `main` | Main content | `main "Page Content" [ref=e3]` |
| `complementary` | Sidebar | `complementary "Sidebar" [ref=e4]` |
| `contentinfo` | Footer | `contentinfo "Site Footer" [ref=e5]` |
| `form` | Form | `form "Search Form" [ref=e6]` |
| `search` | Search | `search "Site Search" [ref=e7]` |

---

## Options Explained

### interactiveOnly

**Type:** boolean  
**Default:** false

When `true`, returns only interactive elements (buttons, links, inputs):

**Standard Snapshot:**
```
- heading "Welcome" [ref=e1]
- button "Login" [ref=e2]
- textbox "Email" [ref=e3]
- textbox "Password" [ref=e4]
- button "Submit" [ref=e5]
- text "Copyright 2026" [ref=e6]
```

**Interactive Only:**
```
- button "Login" [ref=e2]
- textbox "Email" [ref=e3]
- textbox "Password" [ref=e4]
- button "Submit" [ref=e5]
```

**Benefits:**
- Reduces token usage by 50-80%
- Focuses on actionable elements
- Faster processing

### compact

**Type:** boolean  
**Default:** false

When `true`, removes structural containers (divs, groups):

**Standard Snapshot:**
```
- group "" [ref=e1]
  - heading "Welcome" [ref=e2]
  - group "" [ref=e3]
    - button "Login" [ref=e4]
```

**Compact:**
```
- heading "Welcome" [ref=e2]
  - button "Login" [ref=e4]
```

**Benefits:**
- Removes noise
- Reduces token usage
- Simpler tree structure

### maxChars

**Type:** number  
**Default:** unlimited

Truncates snapshot at character limit:

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "maxChars": 5000
  }'
```

**Response when truncated:**

```json
{
  "ok": true,
  "snapshot": "...[first 5000 chars]...\n\n[...TRUNCATED - page too large]",
  "truncated": true
}
```

**Use case:** Large pages with token limits

### maxDepth

**Type:** number  
**Default:** 10

Limits tree depth:

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "maxDepth": 3
  }'
```

**Use case:** Deep nested structures

### timeoutMs

**Type:** number  
**Default:** 5000

Snapshot timeout:

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "timeoutMs": 10000
  }'
```

**Use case:** Slow-loading pages

---

## Incremental Snapshots (Delta)

Track DOM changes between snapshots:

### Start Observation

```bash
curl -X POST http://localhost:4000/snapshot/delta \
  -H "Content-Type: application/json" \
  -d '{
    "action": "start",
    "anchorRef": "e1"
  }'
```

### Stop Observation

```bash
curl -X POST http://localhost:4000/snapshot/delta \
  -H "Content-Type: application/json" \
  -d '{
    "action": "stop"
  }'
```

### Delta Response

```json
{
  "ok": true,
  "added": [
    { "ref": "d1", "role": "button", "name": "New Option" }
  ],
  "removed": [
    { "ref": "e5", "role": "text", "name": "Loading..." }
  ],
  "modified": [
    { "ref": "e3", "changes": ["value", "aria-invalid"] }
  ]
}
```

**Use case:** Dynamic dropdowns, validation messages

See [Dropdown Handling](../features/dropdown-handling.md) for details.

---

## Examples

### Basic Snapshot

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Interactive Elements Only

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "interactiveOnly": true
  }'
```

### Compact Snapshot

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "interactiveOnly": true,
    "compact": true
  }'
```

### With Character Limit

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "maxChars": 3000,
    "interactiveOnly": true
  }'
```

### Specific Tab

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "targetId": "ABC123.1"
  }'
```

---

## Error Responses

### Timeout

```json
{
  "ok": false,
  "error": "Snapshot timed out after 5000ms",
  "code": "TIMEOUT"
}
```

### Invalid Target

```json
{
  "ok": false,
  "error": "Tab not found: ABC123.1",
  "code": "TARGET_NOT_FOUND"
}
```

### Page Not Loaded

```json
{
  "ok": false,
  "error": "Page is not loaded",
  "code": "PAGE_NOT_LOADED"
}
```

---

## Best Practices

### 1. Use interactiveOnly for Token Efficiency

```bash
# Better for LLM consumption
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}'
```

### 2. Take Snapshot After Navigation

```bash
# Navigate
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com"}'

# Wait for load
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "loadState": "load"}'

# Take snapshot
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}'
```

### 3. Parse Refs Programmatically

```javascript
const response = await fetch('/snapshot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ interactiveOnly: true })
});

const data = await response.json();
const buttonRef = Object.entries(data.refs)
  .find(([_, ref]) => ref.role === 'button')[0];

console.log('Button ref:', buttonRef); // e.g., "e12"
```

### 4. Handle Truncation

```javascript
if (data.truncated) {
  console.warn('Snapshot was truncated');
  // Consider using maxChars or taking focused snapshot
}
```

### 5. Use Delta for Dynamic Content

```bash
# Start observing
curl -X POST http://localhost:4000/snapshot/delta \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "anchorRef": "e1"}'

# Perform action that triggers dynamic content
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e1"}'

# Get delta (not full snapshot)
# Response contains only changes
```

---

## Troubleshooting

### Empty Snapshot

**Problem:** Snapshot is empty or minimal

**Solutions:**
1. Wait for page to load:
   ```bash
   curl -X POST http://localhost:4000/act \
     -H "Content-Type: application/json" \
     -d '{"kind": "wait", "loadState": "load"}'
   ```

2. Increase timeout:
   ```bash
   curl -X POST http://localhost:4000/snapshot \
     -H "Content-Type: application/json" \
     -d '{"timeoutMs": 10000}'
   ```

### Stale References

**Problem:** "Element not found" error

**Cause:** Page changed, references are stale

**Solution:** Take new snapshot:
```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Large Snapshot

**Problem:** Snapshot exceeds token limit

**Solutions:**
1. Use `interactiveOnly`:
   ```bash
   curl -X POST http://localhost:4000/snapshot \
     -H "Content-Type: application/json" \
     -d '{"interactiveOnly": true}'
   ```

2. Use `maxChars`:
   ```bash
   curl -X POST http://localhost:4000/snapshot \
     -H "Content-Type: application/json" \
     -d '{"maxChars": 5000}'
   ```

3. Use `compact`:
   ```bash
   curl -X POST http://localhost:4000/snapshot \
     -H "Content-Type: application/json" \
     -d '{"compact": true}'
   ```

---

## Next Steps

- **[Act API](./act.md)** - Perform browser actions
- **[Dropdown Handling](../features/dropdown-handling.md)** - Dynamic dropdown support
- **[Semantic Snapshots](../features/semantic-snapshots.md)** - Feature deep dive

---

**Last Updated:** 2026-03-03
