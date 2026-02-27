// ── hotswap init ─────────────────────────────────────────────────────
// Codemod to scaffold hotswap into an existing React + Vite + MUI app.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runInit(): Promise<void> {
  const root = process.cwd();
  console.log('[hotswap init] Scaffolding hotswap into project...\n');

  // 1. Verify project structure
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) {
    console.error('Error: No package.json found. Run this from your project root.');
    process.exit(1);
  }

  const viteConfigPath = findViteConfig(root);
  if (!viteConfigPath) {
    console.error('Error: No vite.config.ts/js found. This command requires a Vite project.');
    process.exit(1);
  }

  // 2. Scaffold releases/ directory with example MDX
  const releasesDir = join(root, 'releases');
  if (!existsSync(releasesDir)) {
    mkdirSync(releasesDir, { recursive: true });
    const templatePath = resolve(__dirname, '../templates/example-release.mdx');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const version = pkg.version || '0.1.0';

    if (existsSync(templatePath)) {
      const content = readFileSync(templatePath, 'utf8').replace(/\{\{VERSION\}\}/g, version);
      writeFileSync(join(releasesDir, `${version}.mdx`), content, 'utf8');
    } else {
      // Inline template fallback
      writeFileSync(
        join(releasesDir, `${version}.mdx`),
        createExampleMDX(version),
        'utf8',
      );
    }
    console.log(`  Created releases/${version}.mdx`);
  } else {
    console.log('  releases/ directory already exists, skipping.');
  }

  // 3. Create public/release-heroes/ directory
  const heroesDir = join(root, 'public', 'release-heroes');
  if (!existsSync(heroesDir)) {
    mkdirSync(heroesDir, { recursive: true });
    console.log('  Created public/release-heroes/');
  }

  // 4. Modify vite.config
  const modified = await modifyViteConfig(viteConfigPath);
  if (modified) {
    console.log(`  Modified ${viteConfigPath.replace(root + '/', '')}`);
  } else {
    console.log('\n  Could not automatically modify vite.config. Please add manually:');
    console.log('    import { appUpdaterPlugin } from "@hopdrive/hotswap/vite";');
    console.log('    // In plugins array: appUpdaterPlugin()');
  }

  // 5. Add type declarations to vite-env.d.ts
  const viteEnvModified = addTypeDeclarations(root);
  if (viteEnvModified) {
    console.log(`  Modified src/vite-env.d.ts (added type declarations)`);
  }

  // 6. Provide manual instructions for remaining steps
  console.log('\n  Next steps (manual):');
  console.log('  1. Wrap your <App /> in <UpdateProvider buildHash={__APP_UPDATER_BUILD_HASH__}>');
  console.log('  2. Add <MuiUpdateToast /> inside the provider');
  console.log('  3. Add a route: <Route path="/changelog" element={<ChangelogPage />} />');
  if (!viteEnvModified) {
    console.log('  4. Add type declarations to vite-env.d.ts (see README)');
    console.log('  5. Add to build script: hotswap generate-version-json');
  } else {
    console.log('  4. Add to build script: hotswap generate-version-json');
  }
  console.log('\n  See https://github.com/hopdrive/hotswap#readme for full docs.');

  console.log('\n[hotswap init] Done!\n');
}

function addTypeDeclarations(root: string): boolean {
  const candidates = [
    join(root, 'src', 'vite-env.d.ts'),
    join(root, 'vite-env.d.ts'),
    join(root, 'src', 'env.d.ts'),
    join(root, 'env.d.ts'),
  ];

  const envFile = candidates.find((f) => existsSync(f));
  if (!envFile) return false;

  let content = readFileSync(envFile, 'utf8');
  if (content.includes('__APP_UPDATER_BUILD_HASH__')) return true; // already present

  const declarations = `
declare const __APP_UPDATER_BUILD_HASH__: string;
declare const __APP_UPDATER_VERSION__: string;
declare const __APP_UPDATER_BUILD_TIME__: string;

declare module 'virtual:hotswap-releases' {
  import type { CompiledRelease } from '@hopdrive/hotswap';
  export const releases: CompiledRelease[];
}
`;

  // Append after existing content, ensuring a blank line separator
  if (!content.endsWith('\n')) content += '\n';
  writeFileSync(envFile, content + declarations, 'utf8');
  return true;
}

function findViteConfig(root: string): string | null {
  for (const name of ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs']) {
    const p = join(root, name);
    if (existsSync(p)) return p;
  }
  return null;
}

async function modifyViteConfig(configPath: string): Promise<boolean> {
  try {
    // Try magicast for safe AST-based modification
    const magicastId = 'magicast';
    const magicast = await import(magicastId) as {
      parseModule: (code: string) => Record<string, any>;
      addImport: (mod: any, imp: { from: string; imported: string }) => void;
      generateCode: (mod: any) => { code: string };
      builders: { functionCall: (name: string) => unknown };
    };
    const mod = magicast.parseModule(readFileSync(configPath, 'utf8'));

    // Add import
    const imports = mod.imports;
    const hasImport = Object.values(imports.$items ?? {}).some(
      (item: unknown) => {
        const imp = item as { from?: string };
        return imp.from === '@hopdrive/hotswap/vite';
      }
    );

    if (!hasImport) {
      magicast.addImport(mod, {
        from: '@hopdrive/hotswap/vite',
        imported: 'appUpdaterPlugin',
      });
    }

    // Try to add to plugins array
    const config = mod.exports.default;
    if (config && typeof config === 'object' && '$type' in config) {
      // It's a function call like defineConfig({...})
      const args = (config as Record<string, unknown>).$args as unknown[];
      if (args && args[0] && typeof args[0] === 'object') {
        const configObj = args[0] as Record<string, unknown>;
        if (Array.isArray(configObj.plugins)) {
          const alreadyHas = configObj.plugins.some(
            (p: unknown) => String(p).includes('appUpdaterPlugin'),
          );
          if (!alreadyHas) {
            const call = magicast.builders.functionCall('appUpdaterPlugin');
            configObj.plugins.push(call);
          }
        }
      }
    }

    writeFileSync(configPath, magicast.generateCode(mod).code, 'utf8');
    return true;
  } catch {
    // magicast not available or modification failed — fall back to text-based
    return tryTextBasedViteModify(configPath);
  }
}

function tryTextBasedViteModify(configPath: string): boolean {
  try {
    let content = readFileSync(configPath, 'utf8');

    // Add import if missing
    if (!content.includes('@hopdrive/hotswap/vite')) {
      const importLine = "import { appUpdaterPlugin } from '@hopdrive/hotswap/vite';\n";
      // Insert after last import
      const lastImportIdx = content.lastIndexOf('\nimport ');
      if (lastImportIdx !== -1) {
        const endOfLine = content.indexOf('\n', lastImportIdx + 1);
        content = content.slice(0, endOfLine + 1) + importLine + content.slice(endOfLine + 1);
      } else {
        content = importLine + content;
      }
    }

    // Add to plugins array if possible
    if (!content.includes('appUpdaterPlugin()')) {
      const pluginsMatch = content.match(/plugins\s*:\s*\[/);
      if (pluginsMatch && pluginsMatch.index !== undefined) {
        const insertIdx = pluginsMatch.index + pluginsMatch[0].length;
        content = content.slice(0, insertIdx) + '\n      appUpdaterPlugin(),' + content.slice(insertIdx);
      }
    }

    writeFileSync(configPath, content, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function createExampleMDX(version: string): string {
  return `---
version: "${version}"
impact: minor
title: "Initial Release"
summary: "The first version of this application."
features:
  - icon: RocketLaunch
    heading: "Getting Started"
    description: "Welcome to the app! Explore the features and let us know what you think."
---

Welcome to version ${version}! This is your first release notes entry.

Edit this file or create new ones in the \`releases/\` directory to document future releases.
`;
}
