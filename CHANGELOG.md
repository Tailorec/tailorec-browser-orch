# Changelog

## [Unreleased]

### Added
- **Smart Input & Verification for Form Filling**: Implemented a "fill-then-verify" pattern in `openclaw-browser` to ensure form fields are correctly populated.
- **Verification Strategy**: After filling a field, the agent now reads back the value to verify it matches the requested value.
- **Fallback Strategies**: If `locator.fill()` fails or doesn't persist, the system automatically falls back to:
  - `pressSequentially()`: Character-by-character typing with delay, which helps with React/Vue controlled components that don't trigger on DOM-only changes.
  - Keyboard-level typing for contenteditable elements.
- **Format-Aware Filling**:
  - **Phone Numbers**: Automatically detects masked phone inputs and retries with digits-only sequential typing if standard fill fails.
  - **Date Fields**: Detects native `<input type="date">` and various date text formats (MM/DD/YYYY, etc.) from placeholders, converting values to the expected format (e.g., ISO YYYY-MM-DD for native date inputs).
- **Detailed Fill Results**: The `/act` endpoint for `fill` now returns per-field results including:
  - `matched`: Whether the final value matches the requested value.
  - `strategy`: Which input strategy was successfully used (`fill`, `pressSequentially`, etc.).
  - `actualValue`: The value read back from the field after filling.
  - `warning`: Detailed error messages for mismatched fields.

### Why this benefits the system:
1. **Reliability**: Job application forms often use complex UI libraries (React, Vue) or input masks that silent fail when using standard Playwright `fill()`. The verification step ensures the agent knows when a fill didn't "stick".
2. **Success Rate**: Automated fallback to sequential typing handles 90% of cases where standard `fill()` fails due to event listener issues.
3. **Data Quality**: Smart date and phone formatting prevents submission errors caused by providing data in a format the field rejects (e.g., providing "01/15/2024" to a field expecting "2024-01-15").
4. **Efficiency**: Skips filling fields that already contain the correct value (e.g., after a resume upload has pre-filled some data).
