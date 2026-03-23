/**
 * Mock implementations for Node.js fs (file system) module.
 * Used for unit testing file operations without touching the real file system.
 */

import { EventEmitter } from "node:events";

/**
 * In-memory file system for testing.
 */
export class MockFileSystem {
  private files: Map<string, string | Buffer> = new Map();
  private directories: Set<string> = new Set();

  constructor() {
    // Create root directory
    this.directories.add("/");
  }

  /**
   * Writes content to a file.
   */
  writeFileSync(path: string, content: string | Buffer): void {
    this.files.set(path, content);
  }

  /**
   * Reads content from a file.
   */
  readFileSync(path: string, options?: { encoding?: string } | string): string | Buffer {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    if (typeof options === "string" && options === "utf8") {
      return content.toString();
    }
    if (typeof options === "object" && options.encoding === "utf8") {
      return content.toString();
    }
    return content;
  }

  /**
   * Checks if a file exists.
   */
  existsSync(path: string): boolean {
    return this.files.has(path) || this.directories.has(path);
  }

  /**
   * Creates a directory.
   */
  mkdirSync(path: string, options?: { recursive?: boolean }): void {
    if (this.directories.has(path)) {
      if (!options?.recursive) {
        throw new Error(`EEXIST: file already exists: ${path}`);
      }
      return;
    }

    if (options?.recursive) {
      const parts = path.split("/").filter(Boolean);
      let current = "/";
      for (const part of parts) {
        current = `${current}${part}/`;
        this.directories.add(current);
      }
    } else {
      this.directories.add(path);
    }
  }

  /**
   * Removes a file.
   */
  unlinkSync(path: string): void {
    if (!this.files.has(path)) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    this.files.delete(path);
  }

  /**
   * Removes a directory.
   */
  rmdirSync(path: string): void {
    if (!this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    this.directories.delete(path);
  }

  /**
   * Reads a directory.
   */
  readdirSync(path: string): string[] {
    const normalizedPath = path.endsWith("/") ? path : `${path}/`;
    const entries = new Set<string>();

    for (const dir of this.directories) {
      if (dir.startsWith(normalizedPath) && dir !== normalizedPath) {
        const relative = dir.slice(normalizedPath.length);
        const firstPart = relative.split("/")[0];
        entries.add(firstPart);
      }
    }

    for (const [file] of this.files) {
      if (file.startsWith(normalizedPath)) {
        const relative = file.slice(normalizedPath.length);
        const firstPart = relative.split("/")[0];
        entries.add(firstPart);
      }
    }

    return Array.from(entries);
  }

  /**
   * Gets file stats.
   */
  statSync(path: string): { isFile(): boolean; isDirectory(): boolean; size: number } {
    if (this.files.has(path)) {
      const content = this.files.get(path)!;
      return {
        isFile: () => true,
        isDirectory: () => false,
        size: typeof content === "string" ? Buffer.byteLength(content) : content.length,
      };
    }
    if (this.directories.has(path)) {
      return {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
      };
    }
    throw new Error(`ENOENT: no such file or directory: ${path}`);
  }

  /**
   * Clears all files and directories.
   */
  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.directories.add("/");
  }
}

/**
 * Global mock file system instance.
 */
export const mockFileSystem = new MockFileSystem();

/**
 * Mock fs module with synchronous methods.
 */
export const fs = {
  existsSync: (path: string): boolean => mockFileSystem.existsSync(path),

  readFileSync: (path: string, options?: { encoding?: string } | string): string | Buffer =>
    mockFileSystem.readFileSync(path, options),

  writeFileSync: (path: string, content: string | Buffer): void =>
    mockFileSystem.writeFileSync(path, content),

  unlinkSync: (path: string): void => mockFileSystem.unlinkSync(path),

  mkdirSync: (path: string, options?: { recursive?: boolean }): void =>
    mockFileSystem.mkdirSync(path, options),

  rmdirSync: (path: string): void => mockFileSystem.rmdirSync(path),

  readdirSync: (path: string): string[] => mockFileSystem.readdirSync(path),

  statSync: (path: string) => mockFileSystem.statSync(path),

  // Async versions
  exists: (path: string, callback: (exists: boolean) => void): void => {
    callback(mockFileSystem.existsSync(path));
  },

  readFile: (
    path: string,
    options: { encoding?: string } | string | ((err: Error | null, data: string | Buffer) => void),
    callback?: (err: Error | null, data: string | Buffer) => void,
  ): void => {
    const actualCallback = typeof options === "function" ? options : callback;
    try {
      const data = mockFileSystem.readFileSync(path, typeof options === "object" ? options : undefined);
      actualCallback?.(null, data);
    } catch (err) {
      actualCallback?.(err as Error, Buffer.alloc(0));
    }
  },

  writeFile: (
    path: string,
    content: string | Buffer,
    callback: (err: Error | null) => void,
  ): void => {
    try {
      mockFileSystem.writeFileSync(path, content);
      callback(null);
    } catch (err) {
      callback(err as Error);
    }
  },

  unlink: (path: string, callback: (err: Error | null) => void): void => {
    try {
      mockFileSystem.unlinkSync(path);
      callback(null);
    } catch (err) {
      callback(err as Error);
    }
  },

  mkdir: (path: string, options: { recursive?: boolean } | ((err: Error | null) => void), callback?: (err: Error | null) => void): void => {
    try {
      mockFileSystem.mkdirSync(path, typeof options === "object" ? options : undefined);
      callback?.(null);
    } catch (err) {
      callback?.(err as Error);
    }
  },

  rmdir: (path: string, callback: (err: Error | null) => void): void => {
    try {
      mockFileSystem.rmdirSync(path);
      callback(null);
    } catch (err) {
      callback(err as Error);
    }
  },

  readdir: (path: string, callback: (err: Error | null, files: string[]) => void): void => {
    try {
      callback(null, mockFileSystem.readdirSync(path));
    } catch (err) {
      callback(err as Error, []);
    }
  },

  stat: (path: string, callback: (err: Error | null, stats: any) => void): void => {
    try {
      callback(null, mockFileSystem.statSync(path));
    } catch (err) {
      callback(err as Error, null);
    }
  },

  // Promise versions
  promises: {
    readFile: async (path: string, options?: { encoding?: string }): Promise<string | Buffer> =>
      mockFileSystem.readFileSync(path, options),

    writeFile: async (path: string, content: string | Buffer): Promise<void> => {
      mockFileSystem.writeFileSync(path, content);
    },

    unlink: async (path: string): Promise<void> => {
      mockFileSystem.unlinkSync(path);
    },

    mkdir: async (path: string, options?: { recursive?: boolean }): Promise<void> => {
      mockFileSystem.mkdirSync(path, options);
    },

    rmdir: async (path: string): Promise<void> => {
      mockFileSystem.rmdirSync(path);
    },

    readdir: async (path: string): Promise<string[]> => mockFileSystem.readdirSync(path),

    stat: async (path: string) => mockFileSystem.statSync(path),

    access: async (path: string): Promise<void> => {
      if (!mockFileSystem.existsSync(path)) {
        throw new Error(`ENOENT: no such file or directory: ${path}`);
      }
    },

    rename: async (oldPath: string, newPath: string): Promise<void> => {
      const content = mockFileSystem.readFileSync(oldPath);
      mockFileSystem.writeFileSync(newPath, content);
      mockFileSystem.unlinkSync(oldPath);
    },

    copyFile: async (src: string, dest: string): Promise<void> => {
      const content = mockFileSystem.readFileSync(src);
      mockFileSystem.writeFileSync(dest, content);
    },

    appendFile: async (path: string, content: string | Buffer): Promise<void> => {
      const existing = mockFileSystem.readFileSync(path, "utf8");
      const newContent = typeof existing === "string" ? existing + content : Buffer.concat([existing, content as Buffer]);
      mockFileSystem.writeFileSync(path, newContent);
    },
  },

  // EventEmitter for watch
  watch: (path: string, options?: any, listener?: any): EventEmitter => {
    return new EventEmitter();
  },

  watchFile: (path: string, options: any, listener: any): void => {},
  unwatchFile: (path: string, listener?: any): void => {},

  // Constants
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
  },
};

export default fs;
