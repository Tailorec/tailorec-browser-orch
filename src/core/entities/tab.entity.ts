/**
 * Tab Entity
 * 
 * Represents a browser tab/window with its metadata.
 * Extracted from: src/browser/pw-session.ts (listPagesViaPlaywright return type)
 */

/**
 * Tab information as returned from browser APIs
 */
export type TabInfo = {
  targetId: string;
  type?: string;
  title?: string;
  url?: string;
  attached?: boolean;
};

/**
 * Tab Entity
 * 
 * Encapsulates a browser tab's identity and state.
 */
export class Tab {
  constructor(
    public readonly targetId: string,
    public type: string = 'page',
    public title: string = '',
    public url: string = 'about:blank',
    public attached: boolean = false,
  ) {}

  /**
   * Create a Tab from target info
   */
  static fromTargetInfo(info: TabInfo): Tab {
    return new Tab(
      info.targetId,
      info.type ?? 'page',
      info.title ?? '',
      info.url ?? 'about:blank',
      info.attached ?? false,
    );
  }

  /**
   * Convert to target info format
   */
  toTargetInfo(): TabInfo {
    return {
      targetId: this.targetId,
      type: this.type,
      title: this.title,
      url: this.url,
      attached: this.attached,
    };
  }

  /**
   * Check if tab is attached
   */
  isAttached(): boolean {
    return this.attached;
  }

  /**
   * Update tab URL
   */
  updateUrl(url: string): void {
    this.url = url;
  }

  /**
   * Update tab title
   */
  updateTitle(title: string): void {
    this.title = title;
  }
}
