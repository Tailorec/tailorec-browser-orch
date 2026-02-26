import { Page } from "playwright-core";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("pw-dom-observer");

export type IncrementalElement = {
  ref: string;           // assigned ref for the new element
  tagName: string;       // e.g. "div", "li", "option", "span"
  role: string | null;   // aria role if any
  text: string;          // visible text content
  attributes: Record<string, string>; // relevant attrs (value, data-value, aria-selected, etc.)
  isInteractable: boolean;
  rect: { x: number; y: number; width: number; height: number } | null;
};

export type IncrementalSnapshot = {
  newElements: IncrementalElement[];
  removedCount: number;
  observationDurationMs: number;
};

declare global {
  interface Window {
    __skyvernIncrementalNodes?: any[];
    __skyvernObserver?: MutationObserver;
    __skyvernStartTime?: number;
  }
}

export async function startDomObserver(page: Page, anchorSelector?: string): Promise<void> {
    log.debug("starting DOM observer", { anchorSelector });
    await page.evaluate((selector) => {
        const anchor = selector ? document.querySelector(selector) : document.body;
        if (!anchor) return;

        window.__skyvernIncrementalNodes = [];
        window.__skyvernStartTime = Date.now();
        
        if (window.__skyvernObserver) {
            window.__skyvernObserver.disconnect();
        }

        window.__skyvernObserver = new MutationObserver((mutations) => {
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
                            window.__skyvernIncrementalNodes!.push({
                                tagName: current.tagName.toLowerCase(),
                                role: current.getAttribute('role'),
                                text: (current.textContent || '').trim().slice(0, 200),
                                ariaLabel: current.getAttribute('aria-label'),
                                ariaSelected: current.getAttribute('aria-selected'),
                                dataValue: current.getAttribute('data-value') || current.getAttribute('value'),
                                className: current.className?.toString?.()?.slice(0, 100) || '',
                                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                                isInteractable: (
                                    current.tagName === 'BUTTON' ||
                                    current.tagName === 'A' ||
                                    current.tagName === 'INPUT' ||
                                    current.tagName === 'OPTION' ||
                                    current.getAttribute('role') === 'option' ||
                                    current.getAttribute('role') === 'menuitem' ||
                                    current.getAttribute('role') === 'listitem' ||
                                    current.getAttribute('tabindex') !== null ||
                                    (current as any).onclick !== null ||
                                    styles.cursor === 'pointer'
                                ),
                            });
                        }
                        current = walker.nextNode() as Element | null;
                    }
                }
            }
        });

        window.__skyvernObserver.observe(anchor, { childList: true, subtree: true });
    }, anchorSelector);
}

export async function stopDomObserver(page: Page): Promise<IncrementalSnapshot> {
    log.debug("stopping DOM observer");
    const result = await page.evaluate(() => {
        if (window.__skyvernObserver) {
            window.__skyvernObserver.disconnect();
            delete window.__skyvernObserver;
        }

        const nodes = window.__skyvernIncrementalNodes || [];
        const startTime = window.__skyvernStartTime || Date.now();
        const duration = Date.now() - startTime;
        
        delete window.__skyvernIncrementalNodes;
        delete window.__skyvernStartTime;

        return {
            nodes,
            observationDurationMs: duration,
        };
    });

    const newElements: IncrementalElement[] = [];
    
    // Assign refs and optionally inject them into the DOM if we want refLocator to find them easily
    // For now, we'll just return them. The caller (pw-tools-core.interactions.ts) will handle
    // how to make them locatable.
    
    for (let i = 0; i < result.nodes.length; i++) {
        const node = result.nodes[i];
        newElements.push({
            ref: `d${i + 1}`,
            tagName: node.tagName,
            role: node.role,
            text: node.text,
            attributes: {
                "aria-label": node.ariaLabel,
                "aria-selected": node.ariaSelected,
                "data-value": node.dataValue,
                "class": node.className,
            },
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
 * Injects aria-ref attributes into the elements that were discovered.
 * This allows refLocator() to find them.
 */
export async function injectIncrementalRefs(page: Page, elements: IncrementalElement[]): Promise<void> {
    await page.evaluate((els) => {
        for (const el of els) {
            if (!el.rect) continue;
            // Find element at the recorded position
            // This is a bit brittle but better than nothing if we don't have a better way to re-identify nodes
            const centerX = el.rect.x + el.rect.width / 2;
            const centerY = el.rect.y + el.rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            if (elementAtPoint) {
                // Try to find the best match at this point
                let target: Element | null = elementAtPoint;
                while (target && target !== document.body) {
                    if (target.tagName.toLowerCase() === el.tagName && 
                        (target.textContent || '').trim().slice(0, 200) === el.text) {
                        target.setAttribute('aria-ref', el.ref);
                        break;
                    }
                    target = target.parentElement;
                }
            }
        }
    }, elements);
}
