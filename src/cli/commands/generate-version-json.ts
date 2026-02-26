// ── hotswap generate-version-json (enhanced) ─────────────────────────
// Reads MDX frontmatter as primary source, falls back to CHANGELOG.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

interface GenerateVersionJsonOptions {
  output: string;
  releasesDir: string;
}

export async function runGenerateVersionJson(options: GenerateVersionJsonOptions): Promise<void> {
  const root = process.cwd();
  const outDir = resolve(root, options.output);
  const outPath = join(outDir, 'version.json');

  const APP_VERSION = process.env.APP_VERSION || readPackageVersion(root);
  const BUILD_HASH = process.env.BUILD_HASH || readGitSha();
  const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();

  const releasesDir = resolve(root, options.releasesDir);
  const mdxFile = join(releasesDir, `${APP_VERSION}.mdx`);

  let versionJson: Record<string, unknown>;

  if (existsSync(mdxFile)) {
    // Primary source: MDX frontmatter
    console.log(`  Reading MDX frontmatter from releases/${APP_VERSION}.mdx`);
    const content = readFileSync(mdxFile, 'utf8');
    const fm = parseFrontmatter(content);

    // Auto-discover hero image
    const heroPath = join(root, 'public', 'release-heroes', `${APP_VERSION}-hero.jpg`);
    const heroMedia = existsSync(heroPath)
      ? [{ type: 'image', src: `/release-heroes/${APP_VERSION}-hero.jpg`, alt: fm.title || '' }]
      : undefined;

    versionJson = {
      version: APP_VERSION,
      buildHash: BUILD_HASH,
      releasedAt: BUILD_TIME,
      impact: fm.impact || 'patch',
      notes: {
        title: fm.title || defaultTitleForImpact(fm.impact || 'patch'),
        summary: fm.summary || defaultSummaryForImpact(fm.impact || 'patch'),
        bullets: [],
        ...(fm.features ? { features: fm.features } : {}),
        ...(fm.ctaLabel ? { ctaLabel: fm.ctaLabel } : {}),
        ...(fm.ctaUrl ? { ctaUrl: fm.ctaUrl } : {}),
        learnMoreUrl: `/changelog#v${APP_VERSION}`,
        ...(heroMedia ? { media: heroMedia } : {}),
      },
    };
  } else {
    // Fallback: CHANGELOG.md (delegate to legacy logic)
    console.log('  No MDX file found, falling back to CHANGELOG.md parsing.');
    const changelogPath = process.env.CHANGELOG_PATH || join(root, 'CHANGELOG.md');
    const changelogText = existsSync(changelogPath)
      ? readFileSync(changelogPath, 'utf8')
      : '';

    const latestBlock = extractLatestChangelogBlock(changelogText);
    const parsed = parseNotesFromBlock(latestBlock);

    const repo = process.env.GITHUB_REPOSITORY;
    const learnMoreUrl = repo
      ? `https://github.com/${repo}/releases/tag/v${APP_VERSION}`
      : undefined;

    // Check for hero even without MDX
    const heroPath = join(root, 'public', 'release-heroes', `${APP_VERSION}-hero.jpg`);
    const heroMedia = existsSync(heroPath)
      ? [{ type: 'image', src: `/release-heroes/${APP_VERSION}-hero.jpg`, alt: parsed.title }]
      : undefined;

    versionJson = {
      version: APP_VERSION,
      buildHash: BUILD_HASH,
      releasedAt: BUILD_TIME,
      impact: parsed.impact,
      notes: {
        title: parsed.title,
        summary: parsed.summary,
        bullets: parsed.bullets,
        ...(learnMoreUrl ? { learnMoreUrl } : {}),
        ...(heroMedia ? { media: heroMedia } : {}),
      },
    };
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(versionJson, null, 2), 'utf8');
  console.log(`[version.json] wrote ${outPath}`);
  console.log(JSON.stringify(versionJson, null, 2));
}

// ── MDX frontmatter parsing ──────────────────────────────────────────

interface ParsedFrontmatter {
  version?: string;
  impact?: string;
  title?: string;
  summary?: string;
  features?: Array<{ icon?: string; heading: string; description: string }>;
  ctaLabel?: string;
  ctaUrl?: string;
  [key: string]: unknown;
}

function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: Record<string, unknown> = {};
  let currentKey = '';
  let currentArray: unknown[] | null = null;
  let currentObject: Record<string, string> | null = null;

  for (const line of yaml.split('\n')) {
    // Array item with key-value (e.g., "  - icon: PlayArrow")
    const arrayObjMatch = line.match(/^\s+-\s+(\w+):\s*"?([^"]*)"?\s*$/);
    if (arrayObjMatch && currentArray !== null) {
      currentObject = { [arrayObjMatch[1]]: arrayObjMatch[2].replace(/^"|"$/g, '') };
      currentArray.push(currentObject);
      continue;
    }

    // Continuation field in array object
    const contMatch = line.match(/^\s{4,}(\w+):\s*"?([^"]*)"?\s*$/);
    if (contMatch && currentObject !== null) {
      currentObject[contMatch[1]] = contMatch[2].replace(/^"|"$/g, '');
      continue;
    }

    // Start of array
    const arrayStartMatch = line.match(/^(\w+):\s*$/);
    if (arrayStartMatch) {
      currentKey = arrayStartMatch[1];
      currentArray = [];
      currentObject = null;
      result[currentKey] = currentArray;
      continue;
    }

    // Top-level key-value
    const kvMatch = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      result[currentKey] = kvMatch[2].replace(/^"|"$/g, '');
      currentArray = null;
      currentObject = null;
      continue;
    }
  }

  return result as ParsedFrontmatter;
}

// ── CHANGELOG.md fallback helpers (copied from legacy CLI) ───────────

function readPackageVersion(root: string): string {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function readGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function extractLatestChangelogBlock(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+\d+\.\d+\.\d+/.test(lines[i])) {
      if (start === -1) { start = i; } else { end = i; break; }
    }
  }
  if (start === -1) return '';
  return lines.slice(start, end).join('\n').trim();
}

interface ParsedNotes {
  impact: string;
  title: string;
  summary: string;
  bullets: string[];
}

function parseNotesFromBlock(block: string): ParsedNotes {
  const impact = extractImpact(block) || 'patch';
  const { title, summary, bullets } = extractTitleSummaryBullets(block);
  return {
    impact,
    title: title || defaultTitleForImpact(impact),
    summary: summary || defaultSummaryForImpact(impact),
    bullets,
  };
}

function extractImpact(block: string): string | null {
  if (!block) return null;
  const m = block.match(/\[impact:\s*(patch|minor|major|critical)\s*\]/i);
  return m ? m[1].toLowerCase() : null;
}

function extractTitleSummaryBullets(block: string): { title: string; summary: string; bullets: string[] } {
  if (!block) return { title: '', summary: '', bullets: [] };
  const lines = block.split(/\r?\n/);
  let title = '';
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s*\[impact:\s*(?:patch|minor|major|critical)\s*\]\s*(.+)\s*$/i);
    if (m) { title = cleanText(m[1]); break; }
  }
  let summary = '';
  if (block.includes('[impact:')) {
    const idx = lines.findIndex((l) => /\[impact:\s*(patch|minor|major|critical)\s*\]/i.test(l));
    for (let i = idx + 1; i < lines.length; i++) {
      const t = cleanText(lines[i]);
      if (!t) continue;
      if (/^###\s+/.test(lines[i])) continue;
      if (/^\s*[-*]\s+/.test(lines[i])) continue;
      summary = t;
      break;
    }
  }
  const bullets: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(.+)\s*$/);
    if (!m) continue;
    const raw = cleanText(m[1]);
    if (/\[impact:\s*(patch|minor|major|critical)\s*\]/i.test(raw)) continue;
    if (looksLikeDependencyNoise(raw)) continue;
    if (raw) bullets.push(raw);
    if (bullets.length >= 6) break;
  }
  return { title, summary, bullets };
}

function looksLikeDependencyNoise(s: string): boolean {
  const t = s.toLowerCase();
  if (t.includes('bump ') || t.includes('deps') || t.includes('dependencies')) return true;
  if (t.includes('from ') && t.includes(' to ') && /\d+\.\d+\.\d+/.test(t)) return true;
  if (t.startsWith('@') && t.includes(' to ') && /\d+\.\d+\.\d+/.test(t)) return true;
  return false;
}

function defaultTitleForImpact(impact: string): string {
  switch (impact) {
    case 'major': return 'New features and updates';
    case 'critical': return 'Important update';
    default: return 'Updates and improvements';
  }
}

function defaultSummaryForImpact(impact: string): string {
  switch (impact) {
    case 'major': return 'A new version is available with important changes.';
    case 'critical': return 'Please reload to continue with the latest update.';
    default: return 'Bug fixes and improvements are ready.';
  }
}

function cleanText(s: string): string {
  return (s || '').replace(/\s+/g, ' ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[(.+?)\]\((.+?)\)/g, '$1').trim();
}
