# Changelog

## [Unreleased]

### Added
- Dynamic element state query endpoint:
    - Added `queryElementStateViaPlaywright` and `queryElementStatesViaPlaywright` in `pw-tools-core.interactions.ts`.
    - These functions allow checking the live state of elements (visible, enabled, editable, checked, obscured, etc.) at interaction time.
    - This helps in detecting if an element has become interactable or is blocked by an overlay before attempting an action.
- New action kind `query_state` in `agent.act.ts` and `agent.act.shared.ts` to expose the element state query functionality via the API.
- Pre-interaction validation in `fillFormViaPlaywright` and `typeViaPlaywright`:
    - Before filling fields, it now checks if the element exists, is visible, enabled, and not obscured by an overlay.
    - This provides better error messages and prevents interacting with stale or hidden elements.
    - Added read-back verification to ensure the value was actually set.

### Improved
- `fillFormViaPlaywright` and `typeViaPlaywright` now include pre-checks for element state to ensure more reliable interactions.
- Refactored `fillFormViaPlaywright` to use a more robust fill-and-verify pattern, providing detailed feedback on which fields failed to fill correctly.
