# Screenshot API

## `POST /screenshot`

Captures a page screenshot, a ref-targeted screenshot, or a selector-targeted screenshot.

All media endpoints require a previously created run session and `run_id` in the JSON body.

### Request Body

| Parameter | Type | Description |
|-----------|------|-------------|
| `run_id` | string | required run-session owner |
| `targetId` | string | optional browser tab |
| `fullPage` | boolean | capture the entire page |
| `type` | string | `png` or `jpeg` |
| `quality` | number | JPEG quality `0-100` |
| `ref` | string | element ref |
| `element` | string | selector |

### Valid combinations

- full-page screenshot: no `ref`, no `element`
- element screenshot by `ref`
- element screenshot by `element`

### Validation rules

- `ref` and `element` are mutually exclusive
- `fullPage` cannot be combined with `ref` or `element`
- `quality` is only valid for `jpeg`
- `quality` must be an integer between `0` and `100`

### Full-page example

```json
{
  "run_id": "run-123",
  "fullPage": true,
  "type": "png"
}
```

### Ref example

```json
{
  "run_id": "run-123",
  "ref": "e12",
  "type": "jpeg",
  "quality": 90
}
```

### Success Response

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://example.com",
  "mimeType": "image/png",
  "imageBase64": "..."
}
```

## `POST /screenshot/labeled`

Captures a viewport screenshot with ref labels and bounding boxes overlaid.

### Request Body

| Parameter | Type | Description |
|-----------|------|-------------|
| `run_id` | string | required run-session owner |
| `targetId` | string | optional browser tab |
| `type` | string | `png` or `jpeg` |
| `maxLabels` | number | max overlays to render |
| `refs` | object | required ref metadata object |

Example:

```json
{
  "run_id": "run-123",
  "refs": {
    "e1": { "role": "button", "name": "Submit" },
    "e2": { "role": "textbox", "name": "Email" }
  },
  "maxLabels": 100
}
```

### Response

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "url": "https://example.com",
  "mimeType": "image/png",
  "imageBase64": "...",
  "labels": 2,
  "skipped": 0
}
```

Operational notes:

- off-screen refs may be skipped
- missing bounding boxes may be skipped
- `labels` reports successful overlays
- `skipped` reports refs that were not rendered

## `POST /highlight`

Highlights a ref-backed element in the current page.

### Request Body

```json
{
  "run_id": "run-123",
  "ref": "e12",
  "targetId": "optional"
}
```

### Validation Error

```json
{
  "ok": false,
  "error": "ref is required"
}
```
