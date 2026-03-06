/**
 * CDP Type Definitions
 * 
 * Type definitions for Chrome DevTools Protocol interactions.
 * Extracted from: src/browser/cdp.ts
 */

/**
 * Aria snapshot node
 */
export type AriaSnapshotNode = {
  role: string;
  name?: string;
  ref?: string;
  children?: AriaSnapshotNode[];
};

/**
 * Raw accessibility node from CDP
 */
export type RawAXNode = {
  nodeId: string;
  role: { name: string };
  name?: { value: string };
  children?: string[];
  ref?: string;
};

/**
 * CDP response for accessibility tree
 */
export type AccessibilityTreeResponse = {
  nodes?: RawAXNode[];
};

/**
 * Format aria snapshot from raw nodes
 */
export function formatAriaSnapshot(nodes: RawAXNode[], limit: number): AriaSnapshotNode[] {
  const byId = new Map<string, RawAXNode>();
  for (const node of nodes) {
    byId.set(node.nodeId, node);
  }

  let counter = 0;
  const nextRef = () => {
    counter += 1;
    return `e${counter}`;
  };

  const out = new Map<string, AriaSnapshotNode>();
  for (const node of nodes) {
    const ref = nextRef();
    node.ref = ref;
    out.set(node.nodeId, {
      role: node.role.name,
      name: node.name?.value,
      ref,
      children: [],
    });
  }

  const result: AriaSnapshotNode[] = [];
  for (const node of nodes) {
    const current = out.get(node.nodeId);
    if (!current) continue;

    if (node.children) {
      for (const childId of node.children) {
        const child = out.get(childId);
        if (child && current.children) {
          current.children.push(child);
        }
      }
    }

    if (!node.children?.length) {
      result.push(current);
    }
  }

  return result.slice(0, limit);
}
