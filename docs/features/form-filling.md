# Form Filling

Comprehensive guide to automating form filling with Tailorec Browser Service.

---

## Basic Form Filling

### Single Field

```bash
# Type into a textbox
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "john@example.com"
  }'
```

### Multiple Fields

```bash
# Fill multiple fields at once
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "fill",
    "fields": [
      {"ref": "e1", "type": "textbox", "value": "John"},
      {"ref": "e2", "type": "textbox", "value": "Doe"},
      {"ref": "e3", "type": "email", "value": "john@example.com"}
    ]
  }'
```

**Response:**

```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "results": [
    {"ref": "e1", "matched": true, "requestedValue": "John", "actualValue": "John"},
    {"ref": "e2", "matched": true, "requestedValue": "Doe", "actualValue": "Doe"},
    {"ref": "e3", "matched": true, "requestedValue": "john@example.com", "actualValue": "john@example.com"}
  ],
  "allMatched": true
}
```

---

## Field Types

### Text Input

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "Hello World"
  }'
```

### Email

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "type": "email",
    "value": "test@example.com"
  }'
```

### Password

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "type": "password",
    "value": "secret123"
  }'
```

### Number

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "type": "number",
    "value": "42"
  }'
```

### Telephone

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "type": "tel",
    "value": "555-1234"
  }'
```

### Date

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "type": "date",
    "value": "2026-03-03"
  }'
```

### Checkbox

```bash
# Toggle checkbox
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "e1"
  }'
```

### Radio Button

```bash
# Select radio button
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "e1"
  }'
```

### Textarea

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "This is a long message..."
  }'
```

---

## Smart Input Handling

### Format-Aware Filling

The service automatically handles format-specific inputs:

**Phone Number:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "5551234567",
    "slowly": true
  }'
```

Service handles:
- Digit-only input for phone fields
- Automatic formatting `555-123-4567`
- Masked input support

**Date Fields:**

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "03/03/2026"
  }'
```

Service adapts to:
- MM/DD/YYYY format
- DD/MM/YYYY format
- YYYY-MM-DD format

---

## Controlled Inputs

Some React/Vue inputs require special handling.

### Type Slowly

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "controlled input",
    "slowly": true
  }'
```

### Keyboard Fallback

```bash
# Focus field
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e1"}'

# Type character by character
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "press",
    "key": "h"
  }'
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "press",
    "key": "e"
  }'
# ... continue for each character
```

### Fill-Verify Pattern

```bash
# Fill field
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "test@example.com"
  }'

# Verify value
RESPONSE=$(curl -s -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "evaluate",
    "fn": "(el) => el.value",
    "ref": "e1"
  }')

ACTUAL_VALUE=$(echo "$RESPONSE" | jq -r '.result')

if [ "$ACTUAL_VALUE" != "test@example.com" ]; then
  # Retry with keyboard fallback
  curl -X POST http://localhost:4000/act \
    -H "Content-Type: application/json" \
    -d '{"kind": "click", "ref": "e1"}'
  
  # Clear and retype
  curl -X POST http://localhost:4000/act \
    -H "Content-Type: application/json" \
    -d '{"kind": "press", "key": "Control+a"}'
  curl -X POST http://localhost:4000/act \
    -H "Content-Type: application/json" \
    -d '{"kind": "press", "key": "Backspace"}'
  
  # Type slowly
  curl -X POST http://localhost:4000/act \
    -H "Content-Type: application/json" \
    -d '{
      "kind": "type",
      "ref": "e1",
      "text": "test@example.com",
      "slowly": true
    }'
fi
```

---

## Complete Example: Registration Form

```bash
# Navigate to form
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com/register"}'

# Wait for load
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "loadState": "load"}'

# Take snapshot
SNAPSHOT=$(curl -s -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}')

echo "$SNAPSHOT" | jq '.snapshot'

# Output:
# - textbox "First Name" [ref=e1]
# - textbox "Last Name" [ref=e2]
# - textbox "Email" [ref=e3]
# - textbox "Password" [ref=e4]
# - textbox "Confirm Password" [ref=e5]
# - combobox "Country" [ref=e6]
# - checkbox "Accept Terms" [ref=e7]
# - button "Register" [ref=e8]

# Fill text fields
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "fill",
    "fields": [
      {"ref": "e1", "type": "textbox", "value": "John"},
      {"ref": "e2", "type": "textbox", "value": "Doe"},
      {"ref": "e3", "type": "email", "value": "john@example.com"},
      {"ref": "e4", "type": "password", "value": "SecurePass123!"},
      {"ref": "e5", "type": "password", "value": "SecurePass123!"}
    ]
  }'

# Handle Country dropdown
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e6"}'

curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 300}'

DISCOVER=$(curl -s -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "discover_dropdown", "ref": "e6"}')

US_REF=$(echo "$DISCOVER" | jq -r '.refs | to_entries[] | select(.value.name == "United States") | .key')

curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d "{\"kind\": \"click\", \"ref\": \"$US_REF\"}"

curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "close_dropdown", "ref": "e6"}'

# Check terms
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e7"}'

# Submit
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e8"}'

# Wait for success
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "text": "Registration successful",
    "timeoutMs": 10000
  }'
```

---

## Error Handling

### Field Not Found

```bash
# Query element state first
STATE=$(curl -s -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "query_state",
    "ref": "e1"
  }')

VISIBLE=$(echo "$STATE" | jq -r '.state.visible')

if [ "$VISIBLE" != "true" ]; then
  # Scroll into view
  curl -X POST http://localhost:4000/act \
    -H "Content-Type: application/json" \
    -d '{"kind": "scrollIntoView", "ref": "e1"}'
fi
```

### Validation Errors

```bash
# Submit form
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e8"}'

# Wait for validation
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 1000}'

# Check for errors
SNAPSHOT=$(curl -s -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}')

# Look for error messages
ERROR=$(echo "$SNAPSHOT" | jq -r '.snapshot' | grep -i "error\|invalid\|required")

if [ -n "$ERROR" ]; then
  echo "Validation error detected: $ERROR"
  # Fix the error...
fi
```

---

## Best Practices

### 1. Use Fill for Multiple Fields

```bash
# ✅ Better: Single request
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "fill",
    "fields": [
      {"ref": "e1", "type": "textbox", "value": "John"},
      {"ref": "e2", "type": "textbox", "value": "Doe"}
    ]
  }'

# ❌ Slower: Multiple requests
curl -X POST http://localhost:4000/act -d '{"kind": "type", "ref": "e1", "text": "John"}'
curl -X POST http://localhost:4000/act -d '{"kind": "type", "ref": "e2", "text": "Doe"}'
```

### 2. Verify Critical Fields

```bash
# Fill email
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "test@example.com"
  }'

# Verify
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "evaluate",
    "fn": "(el) => el.value",
    "ref": "e1"
  }'
```

### 3. Handle Dynamic Validation

```bash
# Fill field
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "type", "ref": "e1", "text": "invalid"}'

# Wait for validation message
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "text": "Invalid",
    "timeoutMs": 3000
  }'

# Fix
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "type", "ref": "e1", "text": "valid"}'
```

---

**Last Updated:** 2026-03-03
