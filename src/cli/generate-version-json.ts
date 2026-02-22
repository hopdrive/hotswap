import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DIST_DIR = process.env.DIST_DIR || 'dist';
const OUT_PATH = path.join(DIST_DIR, 'version.json');

const APP_VERSION = process.env.APP_VERSION || readPackageVersion();
const BUILD_HASH = process.env.BUILD_HASH || readGitSha();
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();

const changelogPath = process.env.CHANGELOG_PATH || 'CHANGELOG.md';
const changelogText = fs.existsSync(changelogPath)
  ? fs.readFileSync(changelogPath, 'utf8')
  : '';

const latestBlock = extractLatestChangelogBlock(changelogText);
const parsed = parseNotesFromBlock(latestBlock);

const repo = process.env.GITHUB_REPOSITORY; // "org/repo"
const learnMoreUrl = repo
  ? `https://github.com/${repo}/releases/tag/v${APP_VERSION}`
  : undefined;

// Optional media file merge
const mediaPath = process.env.RELEASE_MEDIA_PATH || 'release-media.json';
const mediaByVersion = fs.existsSync(mediaPath)
  ? safeJsonParse(fs.readFileSync(mediaPath, 'utf8'))
  : null;
const media = mediaByVersion?.[APP_VERSION]?.media || undefined;

const versionJson = {
  version: APP_VERSION,
  buildHash: BUILD_HASH,
  releasedAt: BUILD_TIME,
  impact: parsed.impact,
  notes: {
    title: parsed.title,
    summary: parsed.summary,
    bullets: parsed.bullets,
    ...(learnMoreUrl ? { learnMoreUrl } : {}),
    ...(media ? { media } : {}),
  },
};

fs.mkdirSync(DIST_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(versionJson, null, 2), 'utf8');
// eslint-disable-next-line no-console
console.log(`[version.json] wrote ${OUT_PATH}`);
// eslint-disable-next-line no-console
console.log(JSON.stringify(versionJson, null, 2));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readPackageVersion(): string {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  return pkg.version || '0.0.0';
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

  // Find first "## x.y.z"
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+\d+\.\d+\.\d+/.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return '';

  // Find next "## " heading after start
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+\d+\.\d+\.\d+/.test(lines[i])) {
      end = i;
      break;
    }
  }

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
    bullets: bullets || [],
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

  // Title heuristic: first list item that contains [impact: x]
  let title = '';
  for (const line of lines) {
    const m = line.match(
      /^\s*[-*]\s*\[impact:\s*(?:patch|minor|major|critical)\s*\]\s*(.+)\s*$/i,
    );
    if (m) {
      title = cleanText(m[1]);
      break;
    }
  }

  // Summary heuristic: first non-empty paragraph line after the impact line
  let summary = '';
  if (block.includes('[impact:')) {
    const idx = lines.findIndex((l) =>
      /\[impact:\s*(patch|minor|major|critical)\s*\]/i.test(l),
    );
    for (let i = idx + 1; i < lines.length; i++) {
      const t = cleanText(lines[i]);
      if (!t) continue;
      // skip section headings
      if (/^###\s+/.test(lines[i])) continue;
      // skip bullets (summary should be plain sentence)
      if (/^\s*[-*]\s+/.test(lines[i])) continue;
      summary = t;
      break;
    }
  }

  // Bullets: collect up to 6 bullet-looking lines, excluding noise
  const bullets: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(.+)\s*$/);
    if (!m) continue;

    const raw = cleanText(m[1]);

    // filter out title bullets if they contain the impact tag
    if (/\[impact:\s*(patch|minor|major|critical)\s*\]/i.test(raw)) continue;

    // filter out common dependency noise
    if (looksLikeDependencyNoise(raw)) continue;

    if (raw) bullets.push(raw);
    if (bullets.length >= 6) break;
  }

  return { title, summary, bullets };
}

function looksLikeDependencyNoise(s: string): boolean {
  const t = s.toLowerCase();
  if (t.includes('bump ') || t.includes('deps') || t.includes('dependencies'))
    return true;
  if (t.includes('from ') && t.includes(' to ') && /\d+\.\d+\.\d+/.test(t))
    return true;
  if (t.startsWith('@') && t.includes(' to ') && /\d+\.\d+\.\d+/.test(t))
    return true;
  return false;
}

function defaultTitleForImpact(impact: string): string {
  switch (impact) {
    case 'major':
      return 'New features and updates';
    case 'critical':
      return 'Important update';
    default:
      return 'Updates and improvements';
  }
}

function defaultSummaryForImpact(impact: string): string {
  switch (impact) {
    case 'major':
      return 'A new version is available with important changes.';
    case 'critical':
      return 'Please reload to continue with the latest update.';
    default:
      return 'Bug fixes and improvements are ready.';
  }
}

function cleanText(s: string): string {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1') // strip bold
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1') // strip markdown links to text
    .trim();
}

function safeJsonParse(text: string): Record<string, Record<string, unknown>> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
