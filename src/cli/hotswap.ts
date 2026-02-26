// ── hotswap CLI ──────────────────────────────────────────────────────
// Unified CLI for @hopdrive/hotswap.

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));

const program = new Command();

program
  .name('hotswap')
  .description('Zero-config SPA update detection CLI')
  .version(pkg.version);

program
  .command('init')
  .description('Scaffold hotswap into an existing React + Vite + MUI project')
  .action(async () => {
    const { runInit } = await import('./commands/init.js');
    await runInit();
  });

program
  .command('generate-hero')
  .description('Screenshot release content and generate a desaturated hero image')
  .option('-v, --version <version>', 'Specific version to generate hero for')
  .option('-o, --output <dir>', 'Output directory', 'public/release-heroes')
  .option('--releases-dir <dir>', 'Releases MDX directory', 'releases')
  .action(async (opts) => {
    const { runGenerateHero } = await import('./commands/generate-hero.js');
    await runGenerateHero(opts);
  });

program
  .command('generate-version-json')
  .description('Generate version.json from MDX frontmatter or CHANGELOG.md')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .option('--releases-dir <dir>', 'Releases MDX directory', 'releases')
  .action(async (opts) => {
    const { runGenerateVersionJson } = await import('./commands/generate-version-json.js');
    await runGenerateVersionJson(opts);
  });

program.parse();
