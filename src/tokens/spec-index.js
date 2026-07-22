/**
 * Permanent-spec structural index + section-first reads — ported from
 * specloom's `buildSpecIndex`/`writeSpecIndex`/`readSpecSection`
 * (framework/cli/lib.js, ADR-012). Adapted to the cwd-only path model.
 *
 * The index (`.playbook/index/spec-index.json`) stores structure only — file
 * list, H1 title, `status` frontmatter, and headings with line ranges — never
 * section bodies, so it stays small regardless of spec size. `readSpecSection`
 * parses the live file directly to return a section's real body, confined to
 * `openspec/specs/**`.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { parseMarkdownHeadings } from '../util/markdown.js';

export function defaultSpecIndexPath(cwd = process.cwd()) {
  return path.join(cwd, '.playbook', 'index', 'spec-index.json');
}

/** Permanent specs indexed: system.md and one-level domain spec.md files only. */
export function discoverSpecFiles(root = process.cwd()) {
  const specsDir = path.join(root, 'openspec', 'specs');
  const files = [];
  if (fs.existsSync(path.join(specsDir, 'system.md'))) {
    files.push('openspec/specs/system.md');
  }
  if (!fs.existsSync(specsDir)) return files;

  for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const relPath = path.join('openspec', 'specs', entry.name, 'spec.md');
    if (fs.existsSync(path.join(root, relPath))) files.push(relPath);
  }
  return files.sort((a, b) => {
    if (a === 'openspec/specs/system.md') return -1;
    if (b === 'openspec/specs/system.md') return 1;
    return a.localeCompare(b);
  });
}

function readSpecForIndex(root, relPath) {
  const filePath = path.join(root, relPath);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return { raw, parsed: matter(raw) };
  } catch (err) {
    throw new Error(`Failed to parse frontmatter in ${relPath}: ${err.message}`);
  }
}

/** Builds the local spec index JSON model. Stores structure only, never section bodies. */
export function buildSpecIndex(root = process.cwd()) {
  const specFiles = discoverSpecFiles(root);
  if (specFiles.length === 0) {
    throw new Error(`No target spec files found under ${path.join('openspec', 'specs')}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    files: specFiles.map((file) => {
      const { raw, parsed } = readSpecForIndex(root, file);
      const headings = parseMarkdownHeadings(raw);
      return {
        file,
        title: headings.find((heading) => heading.level === 1)?.title || path.basename(file),
        frontmatter: {
          status: parsed.data.status || null,
        },
        headings,
      };
    }),
  };
}

/** Writes the spec index JSON to the consumer-local cache path. */
export function writeSpecIndex(index, indexPath = defaultSpecIndexPath()) {
  try {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
  } catch (err) {
    throw new Error(`Failed to write spec index at ${indexPath}: ${err.message}`);
  }
  return indexPath;
}

function assertSafeRelativePath(relPath, requiredPrefix, label) {
  if (
    typeof relPath !== 'string' ||
    relPath.length === 0 ||
    relPath.includes('\\') ||
    path.isAbsolute(relPath) ||
    /^[A-Za-z]:[\\/]/.test(relPath)
  ) {
    throw new Error(`Invalid ${label} path: "${relPath}"`);
  }
  const parts = relPath.split('/');
  if (parts.includes('..') || parts.includes('.') || path.posix.normalize(relPath) !== relPath) {
    throw new Error(`Invalid ${label} path: "${relPath}"`);
  }
  if (!relPath.startsWith(requiredPrefix)) {
    throw new Error(`${label} path outside ${requiredPrefix.replace(/\/$/, '')}: "${relPath}"`);
  }
  return relPath;
}

function splitSpecReference(reference) {
  const hash = reference.indexOf('#');
  if (hash === -1 || hash === 0 || hash === reference.length - 1) {
    throw new Error('Usage: playbook spec-read <openspec/specs/file.md#anchor>');
  }
  return {
    relPath: reference.slice(0, hash),
    anchor: reference.slice(hash + 1),
  };
}

/**
 * Reads the body of a live permanent-spec section, confined to
 * openspec/specs/**. The index remains navigation-only; this parses the
 * requested file directly.
 */
export function readSpecSection(reference, { cwd = process.cwd() } = {}) {
  const { relPath, anchor } = splitSpecReference(reference);
  const safeRelPath = assertSafeRelativePath(relPath, 'openspec/specs/', 'spec');
  const filePath = path.join(cwd, ...safeRelPath.split('/'));
  const specsRoot = path.join(cwd, 'openspec', 'specs');
  const relativeToSpecs = path.relative(specsRoot, filePath);
  if (relativeToSpecs.startsWith('..') || path.isAbsolute(relativeToSpecs)) {
    throw new Error(`spec path outside openspec/specs: "${relPath}"`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`spec file not found: ${relPath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const headings = parseMarkdownHeadings(parsed.content);
  const heading = headings.find((h) => h.anchor === anchor);
  if (!heading) {
    throw new Error(`anchor "${anchor}" not found in ${relPath}`);
  }
  return parsed.content
    .split('\n')
    .slice(heading.lineStart, heading.lineEnd)
    .join('\n')
    .trim();
}
