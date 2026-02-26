import type { Plugin } from 'vite';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const VIRTUAL_MODULE_ID = 'virtual:hotswap-releases';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

export interface HotswapMDXPluginOptions {
  /** Directory containing release MDX files. Default: 'releases' */
  releasesDir?: string;
  /** Cache directory. Default: 'node_modules/.cache/hotswap-mdx' */
  cacheDir?: string;
}

/** Parse YAML frontmatter from MDX content (simple key-value + nested arrays). */
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: Record<string, unknown> = {};
  let currentKey = '';
  let currentArray: unknown[] | null = null;
  let currentObject: Record<string, string> | null = null;

  for (const line of yaml.split('\n')) {
    // Array item with object fields (e.g., "  - icon: PlayArrow")
    const arrayObjMatch = line.match(/^\s+-\s+(\w+):\s*"?([^"]*)"?\s*$/);
    if (arrayObjMatch && currentArray !== null) {
      currentObject = { [arrayObjMatch[1]]: arrayObjMatch[2].replace(/^"|"$/g, '') };
      currentArray.push(currentObject);
      continue;
    }

    // Continuation field in array object (e.g., "    heading: ...")
    const contMatch = line.match(/^\s{4,}(\w+):\s*"?([^"]*)"?\s*$/);
    if (contMatch && currentObject !== null) {
      currentObject[contMatch[1]] = contMatch[2].replace(/^"|"$/g, '');
      continue;
    }

    // Top-level key-value
    const kvMatch = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const value = kvMatch[2].replace(/^"|"$/g, '');
      if (value === '') {
        // Could be start of array/object
        result[currentKey] = value;
      } else {
        result[currentKey] = value;
      }
      currentArray = null;
      currentObject = null;
      continue;
    }

    // Start of array under current key
    const arrayStartMatch = line.match(/^(\w+):\s*$/);
    if (arrayStartMatch) {
      currentKey = arrayStartMatch[1];
      currentArray = [];
      currentObject = null;
      result[currentKey] = currentArray;
      continue;
    }

    // Simple array item (e.g., "  - value")
    const simpleArrayMatch = line.match(/^\s+-\s+"?([^"]*)"?\s*$/);
    if (simpleArrayMatch && currentArray !== null) {
      currentArray.push(simpleArrayMatch[1].replace(/^"|"$/g, ''));
      currentObject = null;
      continue;
    }
  }

  return result;
}

/** Extract MDX body (everything after frontmatter). */
function extractBody(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return match ? match[1].trim() : content;
}

/** Discover and sort MDX release files (newest version first). */
function discoverReleases(releasesDir: string): string[] {
  if (!existsSync(releasesDir)) return [];

  return readdirSync(releasesDir)
    .filter((f) => f.endsWith('.mdx'))
    .sort((a, b) => {
      // Sort by semver descending
      const va = a.replace('.mdx', '').split('.').map(Number);
      const vb = b.replace('.mdx', '').split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((vb[i] ?? 0) !== (va[i] ?? 0)) return (vb[i] ?? 0) - (va[i] ?? 0);
      }
      return 0;
    });
}

export function hotswapMDXPlugin(options: HotswapMDXPluginOptions = {}): Plugin {
  const releasesDir = options.releasesDir ?? 'releases';
  const cacheDir = options.cacheDir ?? 'node_modules/.cache/hotswap-mdx';
  let root = process.cwd();
  let mdxCompile: ((source: string, options?: Record<string, unknown>) => Promise<{ value: string }>) | null = null;

  return {
    name: 'hotswap-mdx',

    configResolved(config) {
      root = config.root;
    },

    async buildStart() {
      // Try to load @mdx-js/mdx — it's an optional peer dep
      try {
        // Dynamic import with string var to avoid static type resolution
        const mdxId = '@mdx-js/mdx';
        const mdx = await import(/* @vite-ignore */ mdxId) as {
          compile: (source: string, options?: Record<string, unknown>) => Promise<{ value: string }>;
        };
        mdxCompile = mdx.compile;
      } catch {
        // MDX compilation not available — will export frontmatter-only releases
      }
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    async load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return;

      const dir = resolve(root, releasesDir);
      const files = discoverReleases(dir);

      if (files.length === 0) {
        return 'export const releases = [];';
      }

      const releaseModules: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const filePath = join(dir, files[i]);
        const content = readFileSync(filePath, 'utf8');
        const frontmatter = parseFrontmatter(content);
        const body = extractBody(content);

        let componentCode: string;

        if (mdxCompile && body) {
          try {
            // Check cache
            const cachePath = resolve(root, cacheDir);
            const cacheFile = join(cachePath, files[i].replace('.mdx', '.js'));
            const sourceTime = statSync(filePath).mtimeMs;
            let useCache = false;

            if (existsSync(cacheFile)) {
              const cacheTime = statSync(cacheFile).mtimeMs;
              if (cacheTime > sourceTime) {
                useCache = true;
              }
            }

            if (useCache) {
              componentCode = readFileSync(cacheFile, 'utf8');
            } else {
              const compiled = await mdxCompile(content, {
                outputFormat: 'function-body',
                development: false,
              });
              componentCode = String(compiled.value);

              // Write cache
              mkdirSync(cachePath, { recursive: true });
              writeFileSync(cacheFile, componentCode, 'utf8');
            }
          } catch {
            // Compilation failed — fall back to placeholder
            componentCode = '';
          }
        } else {
          componentCode = '';
        }

        if (componentCode) {
          // Emit as a compiled MDX function-body module
          releaseModules.push(
            `(() => {
  const frontmatter = ${JSON.stringify(frontmatter)};
  ${componentCode}
  return { frontmatter, Component: MDXContent };
})()`
          );
        } else {
          // Frontmatter-only fallback (no MDX body or no compiler)
          releaseModules.push(
            `{ frontmatter: ${JSON.stringify(frontmatter)}, Component: () => null }`
          );
        }
      }

      return `export const releases = [${releaseModules.join(',\n')}];`;
    },

    configureServer(server) {
      const dir = resolve(root, releasesDir);
      if (existsSync(dir)) {
        server.watcher.add(dir);
        server.watcher.on('change', (path) => {
          if (path.startsWith(dir) && path.endsWith('.mdx')) {
            const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
            if (mod) {
              server.moduleGraph.invalidateModule(mod);
              server.ws.send({ type: 'full-reload' });
            }
          }
        });
        server.watcher.on('add', (path) => {
          if (path.startsWith(dir) && path.endsWith('.mdx')) {
            const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
            if (mod) {
              server.moduleGraph.invalidateModule(mod);
              server.ws.send({ type: 'full-reload' });
            }
          }
        });
      }
    },
  };
}
