# Changelog

## [1.1.0] - 2026-02-26

### Added
- **Blocking Element Detection**: Implemented new core functionality to detect elements that obscure or block interaction with target form fields (e.g., cookie banners, chat widgets, modals).
  - Added `detectBlockingElementViaPlaywright` in `src/browser/pw-tools-core.interactions.ts`. This function uses `document.elementFromPoint` to identify what is actually on top of a target element and analyzes the blocker to suggest a dismiss strategy.
  - Added `dismissBlockerViaPlaywright` in `src/browser/pw-tools-core.interactions.ts` to attempt various strategies (click close button, press Escape, click outside) to remove the blocking element.
- **New API Actions**:
  - `detect_blocker`: Exposes blocking element detection via the `/act` endpoint.
  - `dismiss_blocker`: Exposes blocker dismissal via the `/act` endpoint.
- Updated `src/browser/routes/agent.act.ts` and `src/browser/routes/agent.act.shared.ts` to support these new actions.

### Benefits
- **Improved Reliability**: The agent can now proactively identify why a click or fill action might fail before it even attempts it, or recover when it fails due to being obscured.
- **Automated Recovery**: By detecting common patterns for close buttons and using standard dismissal techniques (like the Escape key), the agent can handle intrusive popups and overlays that frequently break automated workflows on job application sites.
- **Better Observability**: The detection results provide detailed information about the blocker, including its tag name, role, text, and suggested dismissal strategy, allowing for better debugging and more intelligent decision-making by the LLM orchestrator.
