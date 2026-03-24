# Hooks And Downloads API

## `POST /hooks/file-chooser`

Stages files and arms a browser upload flow.

### Request Body

| Parameter | Type | Description |
|-----------|------|-------------|
| `paths` | array | required local paths or URLs |
| `targetId` | string | optional tab |
| `ref` | string | click this ref to trigger chooser |
| `inputRef` | string | direct file input ref |
| `element` | string | direct selector target |
| `timeoutMs` | number | optional timeout |

### Modes

#### Click-triggered chooser

```json
{
  "paths": ["/path/to/resume.pdf"],
  "ref": "e12",
  "timeoutMs": 10000
}
```

#### Direct file input

```json
{
  "paths": ["/path/to/resume.pdf"],
  "inputRef": "e15"
}
```

#### URL-backed upload

```json
{
  "paths": ["https://example.com/resume.pdf"],
  "ref": "e12"
}
```

Behavior:

1. URL inputs are downloaded and staged locally first
2. staged files are uploaded into the browser context
3. staged temporary files are cleaned up unless `BROWSER_KEEP_STAGED_UPLOADS=true`

### Success Response

```json
{ "ok": true }
```

### Validation Errors

- `paths are required`
- `ref cannot be combined with inputRef/element`

## `POST /hooks/dialog`

Arms handling for alert, confirm, and prompt dialogs.

### Request Body

| Parameter | Type | Description |
|-----------|------|-------------|
| `accept` | boolean | required accept or dismiss flag |
| `promptText` | string | optional prompt response |
| `targetId` | string | optional tab |
| `timeoutMs` | number | optional timeout |

### Example

```json
{
  "accept": true,
  "promptText": "John Doe"
}
```

Usage pattern:

1. arm `/hooks/dialog`
2. trigger the UI action that opens the dialog
3. the armed handler resolves the dialog when it appears

## `POST /wait/download`

Waits for an expected browser download.

### Request Body

| Parameter | Type | Description |
|-----------|------|-------------|
| `targetId` | string | optional tab |
| `path` | string | optional output path |
| `timeoutMs` | number | optional timeout |

### Success Response

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

## `POST /download`

Clicks a ref-backed download element and waits for the resulting file.

### Request Body

| Parameter | Type | Description |
|-----------|------|-------------|
| `ref` | string | required download trigger ref |
| `path` | string | required output path |
| `targetId` | string | optional tab |
| `timeoutMs` | number | optional timeout |

### Success Response

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
