// ── hotswap generate-hero ────────────────────────────────────────────
// Screenshot release content in a headless browser, then desaturate.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface GenerateHeroOptions {
  version?: string;
  output: string;
  releasesDir: string;
}

/** Parse frontmatter from MDX content. */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?([^"\n]*)"?\s*$/);
    if (kv) result[kv[1]] = kv[2];
  }
  return result;
}

/** Build the HTML template for hero screenshot. */
function buildHeroHTML(frontmatter: Record<string, string>, body: string): string {
  // Try to load external template
  const templatePath = resolve(__dirname, '../templates/hero-template.html');
  let template: string;

  if (existsSync(templatePath)) {
    template = readFileSync(templatePath, 'utf8');
  } else {
    template = DEFAULT_HERO_TEMPLATE;
  }

  return template
    .replace('{{VERSION}}', frontmatter.version || '')
    .replace('{{TITLE}}', frontmatter.title || '')
    .replace('{{SUMMARY}}', frontmatter.summary || '')
    .replace('{{BODY}}', body);
}

const DEFAULT_HERO_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px;
      height: 630px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 80px;
      overflow: hidden;
    }
    .version {
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 3px;
      opacity: 0.7;
      margin-bottom: 16px;
    }
    .title {
      font-size: 48px;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 24px;
    }
    .summary {
      font-size: 20px;
      line-height: 1.5;
      opacity: 0.85;
      max-width: 800px;
    }
  </style>
</head>
<body>
  <div class="version">v{{VERSION}}</div>
  <div class="title">{{TITLE}}</div>
  <div class="summary">{{SUMMARY}}</div>
</body>
</html>`;

export async function runGenerateHero(options: GenerateHeroOptions): Promise<void> {
  const root = process.cwd();
  const releasesDir = resolve(root, options.releasesDir);
  const outputDir = resolve(root, options.output);

  if (!existsSync(releasesDir)) {
    console.error(`Error: Releases directory not found: ${releasesDir}`);
    console.error('Create releases/*.mdx files first, or run: hotswap init');
    process.exit(1);
  }

  // Determine which versions to process
  let files: string[];
  if (options.version) {
    const file = `${options.version}.mdx`;
    if (!existsSync(join(releasesDir, file))) {
      console.error(`Error: Release file not found: releases/${file}`);
      process.exit(1);
    }
    files = [file];
  } else {
    files = readdirSync(releasesDir).filter((f) => f.endsWith('.mdx'));
  }

  if (files.length === 0) {
    console.log('No MDX release files found.');
    return;
  }

  // Try to load puppeteer
  let puppeteer: typeof import('puppeteer');
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.error('Error: puppeteer is required for hero generation.');
    console.error('Install it: npm install -D puppeteer');
    process.exit(1);
  }

  // Try to load sharp
  type SharpFn = (input: Buffer) => {
    modulate: (opts: { saturation: number }) => {
      composite: (layers: { input: Buffer; blend: string }[]) => {
        jpeg: (opts: { quality: number }) => {
          toBuffer: () => Promise<Buffer>;
        };
      };
    };
  };
  let sharp: SharpFn | null = null;
  try {
    const sharpId = 'sharp';
    const sharpMod = await import(sharpId);
    sharp = sharpMod.default as unknown as SharpFn;
  } catch {
    console.log('Note: sharp not installed — skipping desaturation post-processing.');
    console.log('Install for full effect: npm install -D sharp');
  }

  mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.default.launch({ headless: true });

  for (const file of files) {
    const version = file.replace('.mdx', '');
    const content = readFileSync(join(releasesDir, file), 'utf8');
    const frontmatter = parseFrontmatter(content);
    const bodyMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
    const body = bodyMatch ? bodyMatch[1].trim() : '';

    const html = buildHeroHTML(frontmatter, body);
    const outPath = join(outputDir, `${version}-hero.jpg`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    let screenshot = await page.screenshot({ type: 'jpeg', quality: 90 }) as Buffer;
    await page.close();

    // Post-process with sharp if available
    if (sharp) {
      try {
        const overlay = Buffer.from(
          `<svg width="1200" height="630"><rect width="1200" height="630" fill="rgba(0,0,0,0.15)"/></svg>`,
        );

        screenshot = await sharp(screenshot)
          .modulate({ saturation: 0.3 })
          .composite([{ input: overlay, blend: 'over' as const }])
          .jpeg({ quality: 85 })
          .toBuffer();
      } catch (_err) {
        console.warn(`  Warning: sharp post-processing failed for ${version}, using raw screenshot.`);
      }
    }

    writeFileSync(outPath, screenshot);
    console.log(`  Generated ${outPath.replace(root + '/', '')}`);
  }

  await browser.close();
  console.log(`\n[generate-hero] Done! Generated ${files.length} hero image(s).`);
}
