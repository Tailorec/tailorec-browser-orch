import { type Page } from "playwright-core";
import { ensurePageState, refLocator, restoreRoleRefsForTarget } from "./pw-session.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("pw-dom-observer");

/**
 * Incremental element detected by the MutationObserver.
 */
export type IncrementalElement = {
  tagName: string;
  role: string | null;
  text: string;
  className: string;
  ariaInvalid: string | null;
  isError: boolean;
  ref?: string;
  rect?: { x: number; y: number; width: number; height: number };
  ariaLabel?: string;
  ariaSelected?: string;
  dataValue?: string;
  isInteractable?: boolean;
};

/**
 * DOM delta results after stopping the observer.
 */
export type DomDelta = {
  addedElements: IncrementalElement[];
  removedElements: Array<{ ref?: string; text: string; tagName: string }>;
  modifiedElements: Array<{
    ref: string | null;
    tagName: string;
    attr: string;
    oldValue: string | null;
    newValue: string | null;
    text: string;
  }>;
  urlChanged: boolean;
  previousUrl: string;
  currentUrl: string;
  observationDurationMs: number;
};

/**
 * JS to be injected into the page to track DOM changes.
 */
const OBSERVER_JS = `
(function() {
  window.__skyvernDeltaObserver = {
    added: [],
    removed: [],
    modified: [],
    startUrl: window.location.href,
    startTime: 0,
    observer: null,

    start(anchorElement) {
      this.added = [];
      this.removed = [];
      this.modified = [];
      this.startUrl = window.location.href;
      this.startTime = Date.now();

      if (this.observer) {
        this.observer.disconnect();
      }

      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          // Track added nodes
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            this._processAddedNode(node);
          }
          // Track removed nodes
          for (const node of mutation.removedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            this.removed.push({
              tagName: node.tagName?.toLowerCase() || '',
              text: (node.textContent || '').trim().slice(0, 100),
              ref: node.getAttribute?.('aria-ref') || null,
            });
          }
          // Track attribute changes (value, class, disabled, aria-invalid, etc.)
          if (mutation.type === 'attributes') {
            const target = mutation.target;
            if (target.nodeType !== Node.ELEMENT_NODE) continue;
            const attr = mutation.attributeName;
            const interestingAttrs = [
              'value', 'class', 'disabled', 'readonly', 'aria-invalid',
              'aria-expanded', 'aria-hidden', 'aria-selected', 'style', 'hidden'
            ];
            if (interestingAttrs.includes(attr)) {
              this.modified.push({
                tagName: target.tagName?.toLowerCase() || '',
                attr,
                oldValue: mutation.oldValue,
                newValue: target.getAttribute(attr),
                ref: target.getAttribute('aria-ref') || null,
                text: (target.textContent || '').trim().slice(0, 80),
              });
            }
          }
        }
      });

      this.observer.observe(anchorElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        attributeFilter: [
          'value', 'class', 'disabled', 'readonly', 'aria-invalid',
          'aria-expanded', 'aria-hidden', 'aria-selected', 'style', 'hidden',
        ],
      });
    },

    stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      return {
        addedElements: this.added.slice(0, 200),
        removedElements: this.removed.slice(0, 50),
        modifiedElements: this.modified.slice(0, 100),
        urlChanged: window.location.href !== this.startUrl,
        previousUrl: this.startUrl,
        currentUrl: window.location.href,
        observationDurationMs: Date.now() - (this.startTime || Date.now()),
      };
    },

    _processAddedNode(node) {
      const rect = node.getBoundingClientRect();
      // Even if rect is 0, we might want it if it's a script/style/etc, 
      // but for UI deltas we usually want visible elements.
      // However, some elements might be added and then animated in.
      // Skyvern filters by width/height > 0.
      
      const isVisible = rect.width > 0 && rect.height > 0;
      if (isVisible) {
          this.added.push(this._serializeElement(node, rect));
      }

      // Also process children (for subtree additions like entire form sections)
      for (const child of node.querySelectorAll('*')) {
        const childRect = child.getBoundingClientRect();
        if (childRect.width > 0 && childRect.height > 0) {
          this.added.push(this._serializeElement(child, childRect));
        }
      }
    },
    
    _serializeElement(el, rect) {
      return {
        tagName: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        text: (el.textContent || '').trim().slice(0, 200),
        className: (el.className?.toString?.() || '').slice(0, 80),
        ariaInvalid: el.getAttribute('aria-invalid'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaSelected: el.getAttribute('aria-selected'),
        dataValue: el.getAttribute('data-value') || el.getAttribute('value'),
        ref: el.getAttribute('aria-ref'),
        isError: (
          (el.className?.toString?.() || '').match(/error|invalid|danger|warning/i) !== null ||
          el.getAttribute('role') === 'alert' ||
          el.getAttribute('aria-invalid') === 'true'
        ),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        isInteractable: (
          el.tagName === 'BUTTON' ||
          el.tagName === 'A' ||
          el.tagName === 'INPUT' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'OPTION' ||
          el.getAttribute('role') === 'button' ||
          el.getAttribute('role') === 'link' ||
          el.getAttribute('role') === 'checkbox' ||
          el.getAttribute('role') === 'menuitem' ||
          el.getAttribute('role') === 'option' ||
          el.getAttribute('tabindex') !== null ||
          el.onclick !== null ||
          window.getComputedStyle(el).cursor === 'pointer'
        ),
      };
    }
  };
})();
`;

export async function snapshotDeltaViaPlaywright(opts: {
  page: Page,
  action: "start" | "stop";
  anchorRef?: string;
  cdpUrl: string;
  targetId?: string;
}): Promise<DomDelta | { observing: true }> {
  if (opts.action === "start") {
    await opts.page.evaluate(OBSERVER_JS);
    
    let anchorElement = null;
    if (opts.anchorRef) {
      restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page: opts.page });
      try {
        anchorElement = await refLocator(opts.page, opts.anchorRef).elementHandle();
      } catch (e) {
        // Fallback to body if anchor not found
      }
    }
    
    await opts.page.evaluate(
      (anchor) => {
        (window as any).__skyvernDeltaObserver.start(anchor);
      },
      anchorElement
    );
    return { observing: true };
  }

  // action === "stop"
  const delta = await opts.page.evaluate(() => {
    const observer = (window as any).__skyvernDeltaObserver;
    if (!observer) return null;
    return observer.stop();
  });

  if (!delta) {
    throw new Error("Delta observer not started or lost due to navigation/refresh");
  }

  return delta as DomDelta;
}

// ─── Lightweight Dropdown Observer (Plan 01) ──────────────────────────

/**
 * Lightweight snapshot of newly-discovered elements after a DOM mutation.
 * Used by discoverDropdownOptionsViaPlaywright.
 */
export type IncrementalSnapshot = {
  newElements: IncrementalElement[];
  removedCount: number;
  observationDurationMs: number;
};

/**
 * Start a lightweight DOM observer focused on capturing new elements
 * after triggering a dropdown. Simpler than the full delta observer —
 * only tracks added nodes (no removed/modified).
 *
 * Mirrors Skyvern's startGlobalIncrementalObserver (domUtils.js line 2778)
 * but scoped to childList only for dropdown discovery.
 */
export async function startDomObserver(page: Page, anchorSelector?: string): Promise<void> {
  log.debug("starting DOM observer", { anchorSelector });
  await page.evaluate((selector: string | undefined) => {
    const anchor = selector ? document.querySelector(selector) : document.body;
    if (!anchor) return;

    (window as any).__skyvernIncrementalNodes = [];
    (window as any).__skyvernStartTime = Date.now();

    if ((window as any).__skyvernObserver) {
      (window as any).__skyvernObserver.disconnect();
    }

    (window as any).__skyvernObserver = new MutationObserver((mutations: MutationRecord[]) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as HTMLElement;

          // Walk the subtree of the added node
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
          let current: Element | null = el;
          while (current) {
            const rect = current.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            if (isVisible) {
              const styles = window.getComputedStyle(current);
              (window as any).__skyvernIncrementalNodes.push({
                tagName: current.tagName.toLowerCase(),
                role: current.getAttribute("role"),
                text: (current.textContent || "").trim().slice(0, 200),
                ariaLabel: current.getAttribute("aria-label"),
                ariaSelected: current.getAttribute("aria-selected"),
                dataValue: current.getAttribute("data-value") || current.getAttribute("value"),
                className: current.className?.toString?.()?.slice(0, 100) || "",
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                isInteractable:
                  current.tagName === "BUTTON" ||
                  current.tagName === "A" ||
                  current.tagName === "INPUT" ||
                  current.tagName === "OPTION" ||
                  current.getAttribute("role") === "option" ||
                  current.getAttribute("role") === "menuitem" ||
                  current.getAttribute("role") === "listitem" ||
                  current.getAttribute("tabindex") !== null ||
                  (current as any).onclick !== null ||
                  styles.cursor === "pointer",
              });
            }
            current = walker.nextNode() as Element | null;
          }
        }
      }
    });

    (window as any).__skyvernObserver.observe(anchor, { childList: true, subtree: true });
  }, anchorSelector);
}

/**
 * Stop the lightweight observer and return discovered elements with assigned refs.
 */
export async function stopDomObserver(page: Page): Promise<IncrementalSnapshot> {
  log.debug("stopping DOM observer");
  const result = await page.evaluate(() => {
    if ((window as any).__skyvernObserver) {
      (window as any).__skyvernObserver.disconnect();
      delete (window as any).__skyvernObserver;
    }

    const nodes = (window as any).__skyvernIncrementalNodes || [];
    const startTime = (window as any).__skyvernStartTime || Date.now();
    const duration = Date.now() - startTime;

    delete (window as any).__skyvernIncrementalNodes;
    delete (window as any).__skyvernStartTime;

    return { nodes, observationDurationMs: duration };
  });

  const newElements: IncrementalElement[] = [];
  for (let i = 0; i < result.nodes.length; i++) {
    const node = result.nodes[i];
    newElements.push({
      ref: `d${i + 1}`,
      tagName: node.tagName,
      role: node.role,
      text: node.text,
      className: node.className || "",
      ariaInvalid: null,
      isError: false,
      ariaLabel: node.ariaLabel,
      ariaSelected: node.ariaSelected,
      dataValue: node.dataValue,
      isInteractable: node.isInteractable,
      rect: node.rect,
    });
  }

  return {
    newElements,
    removedCount: 0,
    observationDurationMs: result.observationDurationMs,
  };
}

/**
 * Injects aria-ref attributes into discovered elements so refLocator() can find them.
 * Uses elementFromPoint + text matching to re-identify nodes.
 */
export async function injectIncrementalRefs(page: Page, elements: IncrementalElement[]): Promise<void> {
  await page.evaluate((els) => {
    for (const el of els) {
      if (!el.rect) continue;
      const centerX = el.rect.x + el.rect.width / 2;
      const centerY = el.rect.y + el.rect.height / 2;
      const elementAtPoint = document.elementFromPoint(centerX, centerY);
      if (elementAtPoint) {
        let target: Element | null = elementAtPoint;
        while (target && target !== document.body) {
          if (
            target.tagName.toLowerCase() === el.tagName &&
            (target.textContent || "").trim().slice(0, 200) === el.text
          ) {
            if (el.ref) {
              target.setAttribute("aria-ref", el.ref);
            }
            break;
          }
          target = target.parentElement;
        }
      }
    }
  }, elements);
}
