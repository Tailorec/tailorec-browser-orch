# Hooks API

The Hooks API handles special browser events like file uploads and JavaScript dialogs.

---

## File Chooser Hook

Handle file upload dialogs.

### Endpoint

```
POST /hooks/file-chooser
```

### Request

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `paths` | array | **Required.** File paths to upload |
| `targetId` | string | Browser tab identifier |
| `ref` | string | Element to click to trigger dialog |
| `inputRef` | string | Direct file input reference |
| `element` | string | CSS selector for file input |
| `timeoutMs` | number | Timeout in milliseconds |

### Example: Upload File by Clicking Button

```bash
curl -X POST http://localhost:4000/hooks/file-chooser \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/path/to/resume.pdf"],
    "ref": "e12",
    "timeoutMs": 10000
  }'
```

**Flow:**
1. Clicks element `e12` (triggers file dialog)
2. Selects file `/path/to/resume.pdf`
3. Confirms upload

### Example: Upload File to Direct Input

```bash
curl -X POST http://localhost:4000/hooks/file-chooser \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/path/to/resume.pdf"],
    "inputRef": "e15"
  }'
```

**Flow:**
1. Directly sets file on input element `e15`
2. No dialog triggered

### Example: Upload from URL

```bash
curl -X POST http://localhost:4000/hooks/file-chooser \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["https://example.com/resume.pdf"],
    "ref": "e12"
  }'
```

**Flow:**
1. Downloads file from URL
2. Stages in `upload-resume/` directory
3. Uploads to browser
4. Cleans up staged file

### Example: Multiple Files

```bash
curl -X POST http://localhost:4000/hooks/file-chooser \
  -H "Content-Type: application/json" \
  -d '{
    "paths": [
      "/path/to/resume.pdf",
      "/path/to/cover-letter.pdf"
    ],
    "ref": "e12"
  }'
```

### Response

```json
{
  "ok": true
}
```

### Error Responses

**File Not Found:**

```json
{
  "ok": false,
  "error": "File not found: /path/to/missing.pdf",
  "code": "FILE_NOT_FOUND"
}
```

**Download Failed:**

```json
{
  "ok": false,
  "error": "file_download_failed:404",
  "code": "DOWNLOAD_FAILED"
}
```

---

## Dialog Hook

Handle JavaScript alerts, confirms, and prompts.

### Endpoint

```
POST /hooks/dialog
```

### Request

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `accept` | boolean | **Required.** Accept or dismiss dialog |
| `promptText` | string | Text for prompt dialogs |
| `targetId` | string | Browser tab identifier |
| `timeoutMs` | number | Timeout in milliseconds |

### Example: Accept Alert

```bash
curl -X POST http://localhost:4000/hooks/dialog \
  -H "Content-Type: application/json" \
  -d '{
    "accept": true
  }'
```

### Example: Accept Confirm

```bash
curl -X POST http://localhost:4000/hooks/dialog \
  -H "Content-Type: application/json" \
  -d '{
    "accept": true
  }'
```

### Example: Dismiss Confirm

```bash
curl -X POST http://localhost:4000/hooks/dialog \
  -H "Content-Type: application/json" \
  -d '{
    "accept": false
  }'
```

### Example: Respond to Prompt

```bash
curl -X POST http://localhost:4000/hooks/dialog \
  -H "Content-Type: application/json" \
  -d '{
    "accept": true,
    "promptText": "John Doe"
  }'
```

### Response

```json
{
  "ok": true
}
```

### Usage Pattern

```bash
# 1. Arm dialog handler
curl -X POST http://localhost:4000/hooks/dialog \
  -H "Content-Type: application/json" \
  -d '{"accept": true}'

# 2. Trigger dialog (e.g., click button that shows alert)
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e12"}'

# Dialog is automatically handled
```

---

## Wait Download

Wait for file download to complete.

### Endpoint

```
POST /wait/download
```

### Request

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | string | Output file path |
| `targetId` | string | Browser tab identifier |
| `timeoutMs` | number | Timeout in milliseconds |

### Example

```bash
curl -X POST http://localhost:4000/wait/download \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/downloads/file.pdf",
    "timeoutMs": 60000
  }'
```

### Response

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "download": {
    "path": "/downloads/file.pdf",
    "suggestedFilename": "report.pdf",
    "mimeType": "application/pdf",
    "totalBytes": 102400
  }
}
```

---

## Download

Download file by clicking element.

### Endpoint

```
POST /download
```

### Request

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ref` | string | **Required.** Download link/button |
| `path` | string | **Required.** Output file path |
| `targetId` | string | Browser tab identifier |
| `timeoutMs` | number | Timeout in milliseconds |

### Example

```bash
curl -X POST http://localhost:4000/download \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "e12",
    "path": "/downloads/file.pdf",
    "timeoutMs": 60000
  }'
```

### Response

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "download": {
    "path": "/downloads/file.pdf",
    "suggestedFilename": "report.pdf"
  }
}
```

---

## Configuration

### Upload Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `BROWSER_UPLOAD_MAX_BYTES` | 15728640 | Max file size (15MB) |
| `BROWSER_UPLOAD_DOWNLOAD_TIMEOUT_MS` | 45000 | Download timeout |
| `BROWSER_KEEP_STAGED_UPLOADS` | false | Keep temp files |

### Keep Staged Files for Debugging

```env
BROWSER_KEEP_STAGED_UPLOADS=true
```

Staged files are stored in `upload-resume/` directory.

---

## Best Practices

### 1. Upload Resume to Job Application

```bash
# Find upload button in snapshot
# Click upload button and handle file chooser
curl -X POST http://localhost:4000/hooks/file-chooser \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/path/to/resume.pdf"],
    "ref": "e12"
  }'

# Wait for upload to complete
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 3000}'

# Verify upload succeeded (check for filename)
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2. Handle Alert on Form Submit

```bash
# Arm dialog handler
curl -X POST http://localhost:4000/hooks/dialog \
  -H "Content-Type: application/json" \
  -d '{"accept": true}'

# Submit form (triggers alert)
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e20"}'
```

### 3. Download File from Link

```bash
# Click download link and wait
curl -X POST http://localhost:4000/download \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "e15",
    "path": "./downloads/report.pdf",
    "timeoutMs": 60000
  }'
```

---

## Troubleshooting

### File Not Found

**Problem:** Upload file doesn't exist

**Solution:** Verify file path is correct and accessible

### Download Timeout

**Problem:** Download times out

**Solutions:**
1. Increase timeout: `"timeoutMs": 120000`
2. Check network connection
3. Verify download link is valid

### Dialog Not Handled

**Problem:** Dialog appears but isn't handled

**Solution:** Arm dialog handler BEFORE triggering action:

```bash
# ✅ Correct order
curl -X POST http://localhost:4000/hooks/dialog -d '{"accept": true}'
curl -X POST http://localhost:4000/act -d '{"kind": "click", "ref": "e12"}'

# ❌ Wrong order (dialog appears before handler is armed)
curl -X POST http://localhost:4000/act -d '{"kind": "click", "ref": "e12"}'
curl -X POST http://localhost:4000/hooks/dialog -d '{"accept": true}'
```

---

**Last Updated:** 2026-03-03
