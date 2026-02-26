# Changelog

All notable changes to the `openclaw-browser` project will be documented in this file.

## [Unreleased] - 2026-02-26

### Added
- **Custom Dropdown Engine**: A new infrastructure for handling non-native, dynamic dropdown components (React/Vue/CSS-based) frequently found in job application platforms (Greenhouse, Lever, Ashby, etc.).
- **New Module: `src/browser/pw-tools-core.dom-observer.ts`**:
    - Implements a `MutationObserver` based incremental DOM scraper inspired by Skyvern.
    - Captures newly appeared interactive nodes (buttons, options, menu items) immediately after a trigger action.
    - Includes `injectIncrementalRefs` to dynamically tag discovered elements with `aria-ref` attributes for stable targeting.
- **New Interactions**:
    - `discoverDropdownOptionsViaPlaywright`: An intelligent multi-stage discovery tool that attempts to open dropdowns via Click, ArrowDown, or Typeahead filtering while monitoring for DOM mutations.
    - `closeDropdownViaPlaywright`: A utility to safely dismiss open overlays and clear focus.
- **New API Routes**:
    - `POST /act { kind: "discover_dropdown" }`: Allows agents to trigger the discovery sequence.
    - `POST /act { kind: "close_dropdown" }`: Allows agents to abort a dropdown interaction.
- **Verification Suite**:
    - `src/browser/pw-tools-core.dom-observer.test.ts`: Unit tests for mutation tracking.
    - `src/browser/pw-tools-core.interactions.test.ts`: Integration tests for the full discovery-to-selection lifecycle.

### Changed
- **`src/browser/pw-session.ts`**: Updated `refLocator` to resolve discovered incremental refs (e.g., `d1`, `d2`) by targeting the dynamically injected `aria-ref` attributes.
- **`src/browser/routes/agent.act.shared.ts`**: Expanded `ACT_KINDS` to include dropdown management actions.
- **`src/browser/pw-ai.ts`**: Exported new dropdown discovery functions to the public module interface.

### Feature Summary: Custom Dropdown Engine
The Custom Dropdown Engine solves the "invisible options" problem where modern web components render dropdown menus outside the standard DOM hierarchy or only upon user interaction. 

**Why it benefits the system:**
- **Reliability**: Eliminates failures on common ATS platforms like Greenhouse where `locator.fill()` fails on custom search-based selects.
- **Observability**: Gives the LLM agent visibility into what actually appeared on the screen after it clicked a button, rather than relying on a static snapshot that might have been taken before the menu opened.
- **Versatility**: Handles three distinct interaction patterns (Clicking to open, ArrowDown for focus-triggered menus, and Typeahead for filtered searches) automatically in one call.
- **Stable Interaction**: By injecting temporary `aria-ref` tags into the live DOM, it ensures the agent can click the discovered options with 100% precision, even if the page structure is complex or changing.
