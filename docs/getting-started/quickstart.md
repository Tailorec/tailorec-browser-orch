# Quick Start Guide

Get up and running with Tailorec Browser Service in 5 minutes. This guide walks you through your first browser automation.

---

## Prerequisites

- Node.js 20+ installed
- Service installed and running (see [Installation](./installation.md))

---

## Step 1: Start the Service

```bash
npm run dev
```

You should see:

```
info [main] Starting Tailorec Browser Service...
info [main] Service ready on port 4000
```

Keep this terminal open - the service needs to stay running.

---

## Step 2: Navigate to a Web Page

Open a new terminal and navigate to a web page:

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "navigate",
    "url": "https://example.com"
  }'
```

**Response:**

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://example.com"
}
```

The `targetId` identifies this browser tab. Save it for subsequent requests.

---

## Step 3: Take a Snapshot

Get the page structure as a semantic tree:

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "interactiveOnly": true
  }'
```

**Response:**

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://example.com",
  "snapshot": "- heading \"Example Domain\" [ref=e1]\n- link \"More information...\" [ref=e2]",
  "refs": {
    "e1": { "role": "heading", "name": "Example Domain" },
    "e2": { "role": "link", "name": "More information..." }
  }
}
```

### Understanding the Snapshot

The `snapshot` field shows the page structure:

```
- heading "Example Domain" [ref=e1]
  - link "More information..." [ref=e2]
```

Each element has:
- **Role** - What kind of element (heading, link, button, textbox, etc.)
- **Name** - Accessible name/label
- **Reference** - Stable ID for interaction (`[ref=e1]`)

The `refs` object provides metadata about each element.

---

## Step 4: Click a Link

Click the "More information..." link using its reference:

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "e2"
  }'
```

**Response:**

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://iana.org/domains/example"
}
```

The `url` field shows the new page after navigation.

---

## Step 5: Take Another Snapshot

Verify the navigation worked:

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}'
```

You'll see the new page's structure.

---

## Complete Workflow Example

Here's a complete automation script using `jq` for JSON parsing:

```bash
#!/bin/bash

BASE_URL="http://localhost:4000"

# Navigate
echo "Navigating to example.com..."
curl -s -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com"}' | jq .

# Take snapshot
echo "\nTaking snapshot..."
SNAPSHOT=$(curl -s -X POST "$BASE_URL/snapshot" \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}')

echo "$SNAPSHOT" | jq '.snapshot'

# Extract link reference
LINK_REF=$(echo "$SNAPSHOT" | jq -r '.refs | to_entries[] | select(.value.role == "link") | .key')
echo "\nFound link with ref: $LINK_REF"

# Click the link
echo "Clicking link..."
curl -s -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d "{\"kind\": \"click\", \"ref\": \"$LINK_REF\"}" | jq .

# Verify new page
echo "\nNew page snapshot:"
curl -s -X POST "$BASE_URL/snapshot" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.snapshot'
```

---

## Try These Next

### Type Text into a Form

```bash
# Navigate to a form
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "navigate",
    "url": "https://google.com"
  }'

# Take snapshot to find the search box
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}'

# Type into the search box (replace e1 with actual ref)
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "hello world",
    "submit": true
  }'
```

### Wait for Content to Load

```bash
# Wait for page to fully load
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "loadState": "networkidle"
  }'

# Wait for specific text to appear
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "text": "Welcome",
    "timeoutMs": 5000
  }'
```

### Take a Screenshot

```bash
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "fullPage": false
  }'
```

Returns base64-encoded PNG image.

---

## Common Actions Reference

| Action | Description | Example |
|--------|-------------|---------|
| `navigate` | Go to URL | `{"kind": "navigate", "url": "https://..."}` |
| `click` | Click element | `{"kind": "click", "ref": "e1"}` |
| `type` | Type text | `{"kind": "type", "ref": "e1", "text": "hello"}` |
| `press` | Press key | `{"kind": "press", "key": "Enter"}` |
| `hover` | Hover over | `{"kind": "hover", "ref": "e1"}` |
| `wait` | Wait for condition | `{"kind": "wait", "loadState": "networkidle"}` |
| `select` | Select option | `{"kind": "select", "ref": "e1", "values": ["option1"]}` |
| `scrollIntoView` | Scroll element | `{"kind": "scrollIntoView", "ref": "e1"}` |

See [Act API Reference](../api-reference/act.md) for complete documentation.

---

## Snapshot Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `interactiveOnly` | boolean | false | Return only interactive elements |
| `compact` | boolean | false | Remove structural containers |
| `maxChars` | number | - | Truncate snapshot at character limit |
| `maxDepth` | number | 10 | Maximum tree depth |
| `timeoutMs` | number | 5000 | Snapshot timeout |

See [Snapshot API Reference](../api-reference/snapshot.md) for details.

---

## Next Steps

- **[Configuration](./configuration.md)** - Customize service behavior
- **[API Reference](../api-reference/overview.md)** - Complete API documentation
- **[Guides](../guides/basic-automation.md)** - Practical automation examples

---

## Troubleshooting

### "ref not found" Error

**Cause:** The element reference is stale (page changed)

**Solution:** Take a new snapshot to get fresh references:

```bash
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Timeout Errors

**Cause:** Page load or action took too long

**Solution:** Increase timeout:

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "loadState": "networkidle",
    "timeoutMs": 30000
  }'
```

### Empty Snapshot

**Cause:** Page hasn't loaded yet

**Solution:** Wait for navigation to complete:

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "loadState": "load"
  }'
```

---

**Last Updated:** 2026-03-03
