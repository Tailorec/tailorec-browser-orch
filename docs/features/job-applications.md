# Job Application Automation

Tailorec Browser Service is optimized for automating job applications on major ATS (Applicant Tracking System) platforms.

---

## Supported ATS Platforms

| Platform | Market Share | Support Level | Key Features |
|----------|--------------|---------------|--------------|
| **Greenhouse** | ~35% | ✅ Full | Multi-step wizard, Select2 dropdowns, resume parsing |
| **Lever** | ~20% | ✅ Full | Single page, hidden file input, simple forms |
| **Ashby** | ~10% | ✅ Full | Custom React elements, all custom UI |
| **SmartRecruiters** | ~8% | ✅ Full | Multi-step, LinkedIn import prompt |
| **BambooHR** | ~5% | ✅ Full | Simple single page, split address fields |

**Total addressable coverage: ~78%** of tech job applications

---

## Common ATS Patterns

### 1. Multi-Step Wizard (Greenhouse, SmartRecruiters)

```
Step 1: Personal Information → Step 2: Experience → Step 3: Education → Step 4: Review → Submit
```

**Handling:**

```bash
# Fill current step
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "fill", "fields": [...]}'

# Click Next
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e10"}'

# Wait for next step
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "loadState": "networkidle"
  }'

# Take snapshot of new step
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}'
```

### 2. Single Page Form (Lever, BambooHR)

```
All fields on one page → Submit
```

**Handling:**

```bash
# Fill all fields
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "fill", "fields": [...]}'

# Handle dropdowns
# ... dropdown handling ...

# Submit
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e50"}'
```

### 3. Custom React UI (Ashby)

```
All custom components, no native elements
```

**Handling:**

```bash
# Use discover_dropdown for all selects
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "discover_dropdown", "ref": "e1"}'

# Use keyboard navigation for complex inputs
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "type", "ref": "e2", "text": "value", "slowly": true}'
```

---

## Resume Upload

### Native File Input

```html
<input type="file" accept=".pdf,.doc,.docx" />
```

**Handling:**

```bash
curl -X POST http://localhost:4000/hooks/file-chooser \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/path/to/resume.pdf"],
    "inputRef": "e1"
  }'
```

### Hidden File Input + Button

```html
<input type="file" hidden />
<button onclick="document.querySelector('input[type=file]').click()">Upload</button>
```

**Handling:**

```bash
curl -X POST http://localhost:4000/hooks/file-chooser \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/path/to/resume.pdf"],
    "ref": "e2"
  }'
```

### Drag & Drop Zone

```html
<div class="dropzone" onclick="document.getElementById('file').click()">
  Drop file here
</div>
```

**Handling:**

```bash
# Click dropzone to trigger file dialog
curl -X POST http://localhost:4000/hooks/file-chooser \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/path/to/resume.pdf"],
    "ref": "e1"
  }'
```

### Verify Upload

```bash
# Wait for upload to complete
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 3000}'

# Check for filename in snapshot
SNAPSHOT=$(curl -s -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$SNAPSHOT" | jq '.snapshot' | grep -i "resume.pdf"
```

---

## Screening Questions

### Work Authorization

**Question:** "Are you authorized to work in the United States?"

**Pattern:** Yes/No radio buttons

```bash
# Find and click "Yes"
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e5"}'
```

### Visa Sponsorship

**Question:** "Will you now or in the future require visa sponsorship?"

**Pattern:** Yes/No radio buttons

```bash
# Find and click appropriate answer
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e6"}'
```

### Experience Questions

**Question:** "How many years of experience do you have with React?"

**Pattern:** Number input or dropdown

```bash
# Dropdown
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e7"}'

curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "discover_dropdown", "ref": "e7"}'

curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "d3"}'  # "3-5 years"
```

### Salary Expectations

**Question:** "What are your salary expectations?"

**Pattern:** Text input or range slider

```bash
# Text input
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e8",
    "text": "120000"
  }'
```

### EEO Questions (Voluntary)

**Pattern:** Checkboxes or "I don't wish to answer"

```bash
# Select "I don't wish to answer"
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e9"}'
```

---

## Location Autocomplete

### Google Places Autocomplete

```html
<input type="text" placeholder="City, State" role="combobox" />
```

**Handling:**

```bash
# Type location
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "type",
    "ref": "e1",
    "text": "San Francisco, CA"
  }'

# Wait for suggestions
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 500}'

# Discover options
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "discover_dropdown", "ref": "e1"}'

# Click first suggestion
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "d1"}'
```

### Split Fields (City, State, Zip)

```bash
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "fill",
    "fields": [
      {"ref": "e1", "type": "textbox", "value": "San Francisco"},
      {"ref": "e2", "type": "textbox", "value": "CA"},
      {"ref": "e3", "type": "textbox", "value": "94105"}
    ]
  }'
```

---

## Repeating Sections

### Work History "Add Another"

```
Work History:
- Job 1 (Current)
- Job 2
[Add Another Position]
```

**Handling:**

```bash
# Fill first job
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "fill",
    "fields": [
      {"ref": "e1", "type": "textbox", "value": "Software Engineer"},
      {"ref": "e2", "type": "textbox", "value": "Company A"},
      {"ref": "e3", "type": "date", "value": "2020-01"},
      {"ref": "e4", "type": "date", "value": "Present"}
    ]
  }'

# Click "Add Another"
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "e10"}'

# Wait for new fields
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 500}'

# Take new snapshot to get fresh refs
curl -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}'

# Fill second job with new refs
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "fill",
    "fields": [
      {"ref": "e11", "type": "textbox", "value": "Senior Engineer"},
      {"ref": "e12", "type": "textbox", "value": "Company B"}
    ]
  }'
```

---

## Already Applied Detection

### Check Application State

```bash
# Take snapshot
SNAPSHOT=$(curl -s -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}')

# Check for "already applied" signals
if echo "$SNAPSHOT" | jq -r '.snapshot' | grep -qi "already applied\|you have applied\|application submitted"; then
  echo "Already applied - exiting"
  exit 0
fi

# Check for "position closed" signals
if echo "$SNAPSHOT" | jq -r '.snapshot' | grep -qi "position closed\|no longer accepting\|job filled"; then
  echo "Position closed - exiting"
  exit 0
fi

# Continue with application
# ...
```

---

## Confirmation Extraction

### Post-Submit Analysis

```bash
# Wait for confirmation page
curl -X POST http://localhost:4000/act \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "text": "Application submitted",
    "timeoutMs": 10000
  }'

# Take snapshot
SNAPSHOT=$(curl -s -X POST http://localhost:4000/snapshot \
  -H "Content-Type: application/json" \
  -d '{}')

# Extract confirmation number
CONFIRMATION=$(echo "$SNAPSHOT" | jq -r '.snapshot' | grep -oP 'Confirmation: \K[A-Z0-9]+')

echo "Application submitted! Confirmation: $CONFIRMATION"
```

### Success Signals

- "Application submitted"
- "Thank you for applying"
- "Confirmation number"
- "We've received your application"

### Error Signals

- "Please correct the errors below"
- "Required field missing"
- "Invalid format"
- "Submission failed"

---

## Complete Example: Greenhouse Application

```bash
#!/bin/bash

BASE_URL="http://localhost:4000"

# Navigate to job
curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d '{"kind": "navigate", "url": "https://boards.greenhouse.io/company/jobs/123"}'

curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "loadState": "load"}'

# Check if already applied
SNAPSHOT=$(curl -s -X POST "$BASE_URL/snapshot" \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}')

if echo "$SNAPSHOT" | jq -r '.snapshot' | grep -qi "already applied"; then
  echo "Already applied"
  exit 0
fi

# Click "Apply for this job"
APPLY_BTN=$(echo "$SNAPSHOT" | jq -r '.refs | to_entries[] | select(.value.role == "button" and (.value.name | contains("Apply"))) | .key')

curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d "{\"kind\": \"click\", \"ref\": \"$APPLY_BTN\"}"

curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "loadState": "networkidle"}'

# Take snapshot of form
SNAPSHOT=$(curl -s -X POST "$BASE_URL/snapshot" \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}')

# Upload resume
RESUME_BTN=$(echo "$SNAPSHOT" | jq -r '.refs | to_entries[] | select(.value.name | contains("Resume") or contains("CV")) | .key')

curl -X POST "$BASE_URL/hooks/file-chooser" \
  -H "Content-Type: application/json" \
  -d "{
    \"paths\": [\"/path/to/resume.pdf\"],
    \"ref\": \"$RESUME_BTN\"
  }"

curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d '{"kind": "wait", "timeMs": 3000}'

# Fill personal info
SNAPSHOT=$(curl -s -X POST "$BASE_URL/snapshot" \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}')

curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "fill",
    "fields": [
      {"ref": "e1", "type": "textbox", "value": "John"},
      {"ref": "e2", "type": "textbox", "value": "Doe"},
      {"ref": "e3", "type": "email", "value": "john@example.com"},
      {"ref": "e4", "type": "tel", "value": "555-123-4567"}
    ]
  }'

# Handle dropdowns
COUNTRY_REF=$(echo "$SNAPSHOT" | jq -r '.refs | to_entries[] | select(.value.role == "combobox" and (.value.name | contains("Country"))) | .key')

curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d "{\"kind\": \"click\", \"ref\": \"$COUNTRY_REF\"}"

curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d '{"kind": "discover_dropdown", "ref": "'$COUNTRY_REF'"}'

curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d '{"kind": "click", "ref": "d1"}'

curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d '{"kind": "close_dropdown", "ref": "'$COUNTRY_REF'"}'

# Answer screening questions
# ... screening question handling ...

# Submit
SNAPSHOT=$(curl -s -X POST "$BASE_URL/snapshot" \
  -H "Content-Type: application/json" \
  -d '{"interactiveOnly": true}')

SUBMIT_BTN=$(echo "$SNAPSHOT" | jq -r '.refs | to_entries[] | select(.value.role == "button" and (.value.name | contains("Submit") or contains("Apply"))) | .key')

curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d "{\"kind\": \"click\", \"ref\": \"$SUBMIT_BTN\"}"

# Wait for confirmation
curl -X POST "$BASE_URL/act" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "wait",
    "text": "Application submitted",
    "timeoutMs": 10000
  }'

# Get confirmation
SNAPSHOT=$(curl -s -X POST "$BASE_URL/snapshot" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$SNAPSHOT" | jq '.snapshot'
```

---

## Best Practices

### 1. Take Snapshots Frequently

Page state changes - always get fresh refs after navigation or actions.

### 2. Handle Errors Gracefully

Check for validation errors and fix before submitting.

### 3. Verify Uploads

Wait and check that files uploaded successfully.

### 4. Save Confirmation

Extract and store confirmation numbers for tracking.

### 5. Respect Rate Limits

Add delays between applications to avoid triggering anti-bot measures.

---

**Last Updated:** 2026-03-03
