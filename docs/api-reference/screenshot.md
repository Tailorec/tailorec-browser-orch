# Screenshot API

The Screenshot API captures screenshots of the current page or specific elements.

---

## Standard Screenshot

Capture a screenshot of the page.

### Endpoint

```
POST /screenshot
```

### Request

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `targetId` | string | Browser tab identifier |
| `fullPage` | boolean | Capture entire page (default: `false`) |
| `type` | string | Image format: `png` or `jpeg` (default: `png`) |
| `quality` | number | JPEG quality 0-100 (default: `80`) |

### Example: Basic Screenshot

```bash
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Example: Full Page Screenshot

```bash
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "fullPage": true
  }'
```

### Example: JPEG Format

```bash
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "type": "jpeg",
    "quality": 90
  }'
```

### Response

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
}
```

The `imageBase64` field contains base64-encoded PNG/JPEG data.

### Decode and Save

```bash
# Capture and save to file
RESPONSE=$(curl -s -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$RESPONSE" | jq -r '.imageBase64' | base64 --decode > screenshot.png
```

---

## Element Screenshot

Capture screenshot of specific element.

### Endpoint

```
POST /screenshot
```

### Request

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ref` | string | **Required.** Element reference |
| `targetId` | string | Browser tab identifier |
| `type` | string | Image format: `png` or `jpeg` |

### Example

```bash
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "e12"
  }'
```

### Response

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
}
```

---

## Labeled Screenshot

Capture screenshot with element labels overlaid.

### Endpoint

```
POST /screenshot/labeled
```

### Request

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `refs` | object | Element refs to label |
| `maxLabels` | number | Maximum labels to show |
| `targetId` | string | Browser tab identifier |

### Example

```bash
curl -X POST http://localhost:4000/screenshot/labeled \
  -H "Content-Type: application/json" \
  -d '{
    "refs": {
      "e1": { "role": "button", "name": "Submit" },
      "e2": { "role": "textbox", "name": "Email" }
    },
    "maxLabels": 100
  }'
```

### Response

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
}
```

The returned image has:
- Bounding boxes around labeled elements
- Reference IDs overlaid (e1, e2, etc.)
- Useful for visual debugging and VLM (Vision Language Model) workflows

---

## Use Cases

### 1. Debug Automation

```bash
# Take screenshot before action
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.imageBase64' | base64 --decode > before.png

# Perform action
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e12"}'

# Take screenshot after action
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.imageBase64' | base64 --decode > after.png
```

### 2. Visual Regression Testing

```bash
# Capture baseline
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{"fullPage": true}' | jq -r '.imageBase64' | base64 --decode > baseline.png

# ... perform actions ...

# Capture current state
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{"fullPage": true}' | jq -r '.imageBase64' | base64 --decode > current.png

# Compare (using external tool like ImageMagick)
compare baseline.png current.png diff.png
```

### 3. Element Verification

```bash
# Get snapshot to find element
SNAPSHOT=$(curl -s -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}')

# Extract button ref
BUTTON_REF=$(echo "$SNAPSHOT" | jq -r '.refs | to_entries[] | select(.value.role == "button") | .key')

# Take screenshot of button
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d "{\"ref\": \"$BUTTON_REF\"}" | jq -r '.imageBase64' | base64 --decode > button.png
```

### 4. Labeled Screenshot for VLM

```bash
# Get snapshot
SNAPSHOT=$(curl -s -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}')

# Extract refs
REFS=$(echo "$SNAPSHOT" | jq '.refs')

# Take labeled screenshot
curl -X POST http://localhost:4000/screenshot/labeled \
  -H "Content-Type: application/json" \
  -d "{\"refs\": $REFS}" | jq -r '.imageBase64' | base64 --decode > labeled.png
```

---

## Best Practices

### 1. Use PNG for Quality

```bash
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{"type": "png"}'
```

### 2. Use JPEG for Size

```bash
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "type": "jpeg",
    "quality": 75
  }'
```

### 3. Full Page for Complete View

```bash
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{"fullPage": true}'
```

### 4. Element Screenshot for Focus

```bash
curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{"ref": "e12"}'
```

---

## Troubleshooting

### Screenshot is Blank

**Problem:** Screenshot shows empty/blank page

**Solutions:**
1. Wait for page to load:
   ```bash
   curl -X POST http://localhost:4000/act \
     -H "Content-Type: application/json" \
     -d '{"kind": "wait", "loadState": "load"}'
   ```

2. Check page URL:
   ```bash
   curl -X POST http://localhost:4000/snapshot \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

### Large File Size

**Problem:** PNG file is too large

**Solutions:**
1. Use JPEG format:
   ```bash
   curl -X POST http://localhost:4000/screenshot \
     -H "Content-Type: application/json" \
     -d '{"type": "jpeg", "quality": 75}'
   ```

2. Reduce viewport:
   ```bash
   curl -X POST http://localhost:4000/act \
     -H "Content-Type: application/json" \
     -d '{"kind": "resize", "width": 1024, "height": 768}'
   ```

### Element Not in Viewport

**Problem:** Element screenshot doesn't show element

**Solution:** Scroll element into view first:
```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "scrollIntoView", "ref": "e12"}'

curl -X POST http://localhost:4000/screenshot \
  -H "Content-Type: application/json" \
  -d '{"ref": "e12"}'
```

---

**Last Updated:** 2026-03-03
