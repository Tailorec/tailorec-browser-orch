# Dropdown Handling

Tailorec Browser Service provides robust handling for both native `<select>` elements and custom dropdowns built with divs/JavaScript.

---

## Native Select Elements

Standard HTML `<select>` elements are handled with the `select` action.

### Example

```html
<select id="country">
  <option value="us">United States</option>
  <option value="ca">Canada</option>
  <option value="uk">United Kingdom</option>
</select>
```

**Snapshot:**
```
- combobox "Country" [ref=e1]
```

**Action:**
```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "select",
    "ref": "e1",
    "values": ["us"]
  }'
```

### Multiple Selection

```html
<select id="interests" multiple>
  <option value="tech">Technology</option>
  <option value="sports">Sports</option>
  <option value="music">Music</option>
</select>
```

**Action:**
```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "select",
    "ref": "e1",
    "values": ["tech", "music"]
  }'
```

---

## Custom Dropdowns

Modern web applications often use custom dropdowns built with divs, ul/li, or other structures. These require special handling.

### Example Custom Dropdown

```html
<div class="dropdown" role="combobox" aria-expanded="false">
  <div class="dropdown-trigger">Select Country</div>
  <div class="dropdown-menu" hidden>
    <div role="option">United States</div>
    <div role="option">Canada</div>
    <div role="option">United Kingdom</div>
  </div>
</div>
```

### Step-by-Step Handling

#### 1. Click to Open Dropdown

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "e1"
  }'
```

#### 2. Wait for Options to Appear

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "timeMs": 500
  }'
```

#### 3. Discover Available Options

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "discover_dropdown",
    "ref": "e1"
  }'
```

**Response:**
```json
{
  "ok": true,
  "targetId": "ABC123.1",
  "snapshot": "- option \"United States\" [ref=d1]\n- option \"Canada\" [ref=d2]\n- option \"United Kingdom\" [ref=d3]",
  "refs": {
    "d1": { "role": "option", "name": "United States" },
    "d2": { "role": "option", "name": "Canada" },
    "d3": { "role": "option", "name": "United Kingdom" }
  },
  "incremental": true
}
```

**Note:** Discovered options use temporary refs (`d1`, `d2`, etc.) that are only valid until the dropdown closes.

#### 4. Click Desired Option

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "click",
    "ref": "d1"
  }'
```

#### 5. Close Dropdown

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "close_dropdown",
    "ref": "e1"
  }'
```

---

## Searchable Dropdowns

Some dropdowns allow filtering options by typing.

### Example with Search

```bash
# Click to open
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e1"}'

# Wait for options
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 300}'

# Discover with search filter
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "discover_dropdown",
    "ref": "e1",
    "searchText": "United"
  }'
```

**Response (filtered):**
```json
{
  "ok": true,
  "snapshot": "- option \"United States\" [ref=d1]\n- option \"United Kingdom\" [ref=d2]",
  "refs": {
    "d1": { "role": "option", "name": "United States" },
    "d2": { "role": "option", "name": "United Kingdom" }
  }
}
```

---

## Autocomplete Comboboxes

Comboboxes that show suggestions as you type.

### Example

```html
<input type="text" role="combobox" aria-autocomplete="list" />
<ul role="listbox" hidden>
  <li role="option">Apple</li>
  <li role="option">Banana</li>
  <li role="option">Cherry</li>
</ul>
```

### Handling Pattern

```bash
# Type to trigger suggestions
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "Ap"
  }'

# Wait for suggestions
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 300}'

# Discover options
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "discover_dropdown",
    "ref": "e1"
  }'

# Click option
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "d1"}'
```

---

## Select2 / React Select

Popular dropdown libraries require specific handling.

### Select2 Pattern

```html
<select class="select2" id="country">
  <option value="us">United States</option>
  <option value="ca">Canada</option>
</select>
```

Select2 creates a custom dropdown overlay.

**Handling:**

```bash
# Click Select2 container
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e1"}'

# Wait for dropdown
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 500}'

# Discover options (Select2 renders them dynamically)
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "discover_dropdown",
    "ref": "e1"
  }'

# Click option
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "d1"}'
```

---

## Complete Example: Job Application Form

```bash
# Navigate to form
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://example.com/apply"}'

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
# - combobox "Country" [ref=e3]
# - combobox "State" [ref=e4]
# - button "Submit" [ref=e5]

# Fill text fields
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "fill",
    "fields": [
      {"ref": "e1", "type": "textbox", "value": "John"},
      {"ref": "e2", "type": "textbox", "value": "Doe"}
    ]
  }'

# Handle Country dropdown (custom)
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e3"}'

curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 300}'

DISCOVER=$(curl -s -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "discover_dropdown", "ref": "e3"}')

# Find "United States" option
US_REF=$(echo "$DISCOVER" | jq -r '.refs | to_entries[] | select(.value.name == "United States") | .key')

curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d "{\"kind\": \"click\", \"ref\": \"$US_REF\"}"

curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "close_dropdown", "ref": "e3"}'

# Handle State dropdown (native select)
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "select",
    "ref": "e4",
    "values": ["CA"]
  }'

# Submit
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e5"}'
```

---

## Troubleshooting

### Dropdown Doesn't Open

**Problem:** Click doesn't open dropdown

**Solutions:**
1. Check element is correct (might be wrapper, not trigger)
2. Try scrolling into view first:
   ```bash
   curl -X POST http://localhost:4000/act \
     -H "Content-Type: application/json" \
     -d '{"kind": "scrollIntoView", "ref": "e1"}'
   ```

### Options Not Discovered

**Problem:** `discover_dropdown` returns empty

**Solutions:**
1. Wait longer for dynamic content
2. Check dropdown is actually open
3. Try different approach (keyboard navigation)

### Option Click Fails

**Problem:** Clicking option doesn't select

**Solutions:**
1. Use keyboard navigation instead:
   ```bash
   # Open dropdown
   curl -X POST http://localhost:4000/act \
     -H "Content-Type: application/json" \
     -d '{"kind": "click", "ref": "e1"}'
   
   # Navigate with arrows
   curl -X POST http://localhost:4000/act \
     -H "Content-Type: application/json" \
     -d '{"kind": "press", "key": "ArrowDown"}'
   curl -X POST http://localhost:4000/act \
     -H "Content-Type: application/json" \
     -d '{"kind": "press", "key": "ArrowDown"}'
   
   # Select with Enter
   curl -X POST http://localhost:4000/act \
     -H "Content-Type: application/json" \
     -d '{"kind": "press", "key": "Enter"}'
   ```

### Dropdown Closes Too Fast

**Problem:** Options disappear before clicking

**Solution:** Increase speed, reduce waits:
```bash
# Minimize delay between discover and click
DISCOVER=$(curl -s -X POST ...)
OPTION_REF=$(echo "$DISCOVER" | jq -r '.refs | to_entries[0].key')
curl -X POST http://localhost:4000/act -d "{\"kind\": \"click\", \"ref\": \"$OPTION_REF\"}"
```

---

**Last Updated:** 2026-03-03
