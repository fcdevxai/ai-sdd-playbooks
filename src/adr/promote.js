/**
 * ADR promotion — ported from specloom's `promoteAdrPlan`/`applyPromotePlan`
 * (specloom), adapted to the cwd-only path model (no
 * `consumerRoot(cwd, repoRoot)` — playbook-ai installs globally, so every path
 * here is resolved directly against the consumer's own `cwd`).
 *
 * `promoteAdrPlan` is a pure planner (no writes). `applyPromotePlan` is the
 * only mutator: it moves draft(s) to `openspec/specs/adr/`, rewrites the ADR
 * README index, updates superseded records, stages everything with git, and
 * verifies the staged content matches disk — rolling back every touched path
 * on any failure (transactional).
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFrontmatter } from './validate.js';

function isSafeSlug(slug) {
  return (
    typeof slug === 'string' &&
    slug.length > 0 &&
    slug !== '.' &&
    slug !== '..' &&
    !slug.includes('/') &&
    !slug.includes('\\')
  );
}

function assertSafeTicketSlug(slug) {
  if (!isSafeSlug(slug)) throw new Error(`Invalid ticket slug: "${slug}"`);
}

export function defaultChangesDir(cwd = process.cwd()) {
  return path.join(cwd, 'openspec', 'changes');
}

export function defaultAdrDir(cwd = process.cwd()) {
  return path.join(cwd, 'openspec', 'specs', 'adr');
}

/** ADR drafts live in the change folder as adr-<decision-slug>.md — unnumbered until promoted. */
export function listAdrFiles(slug, changesDir = defaultChangesDir()) {
  if (!isSafeSlug(slug)) return [];
  const dir = path.join(changesDir, slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^adr-.+\.md$/.test(f))
    .sort();
}

export function stripAdrTitlePrefix(h1) {
  return String(h1 || '')
    .replace(/^ADR-\d{3}:\s*/i, '')
    .replace(/^ADR:\s*/i, '')
    .trim();
}

function adrReadmeFallback() {
  return [
    '# ADR Index',
    '',
    'Architecture Decision Records: they document the context, alternatives, and trade-offs behind hard-to-reverse decisions.',
    '',
    '| # | Title | Status | Date | Originating change |',
    '|---|---|---|---|---|',
    '',
  ].join('\n');
}

function readmeStatus(row) {
  if (row.status === 'superseded' && row.supersededBy) return `superseded by ${row.supersededBy}`;
  return row.status || '';
}

function escapeTableCell(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

function formatAdrDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value || '';
}

export function renderAdrReadme(existingReadme, rows) {
  const header = '| # | Title | Status | Date | Originating change |';
  const source = existingReadme || adrReadmeFallback();
  const headerIndex = source.indexOf(header);
  const prefix = headerIndex === -1 ? adrReadmeFallback().split(header)[0] : source.slice(0, headerIndex);
  const body = rows
    .map(
      (row) =>
        `| ${escapeTableCell(row.id)} | ${escapeTableCell(row.title)} | ${escapeTableCell(readmeStatus(row))} | ${escapeTableCell(row.date)} | ${escapeTableCell(row.ticket)} |`,
    )
    .join('\n');
  return `${prefix}${header}\n|---|---|---|---|---|\n${body}${body ? '\n' : ''}`;
}

function adrNumberFromFile(fileName) {
  const match = path.basename(fileName).match(/^ADR-(\d{3})-/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function adrSlugFromDraft(fileName) {
  return path.basename(fileName, '.md').replace(/^adr-/, '');
}

function firstMarkdownH1(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function readAdrRow(filePath) {
  const parsed = readFrontmatter(filePath);
  const number = adrNumberFromFile(filePath);
  if (number === null) return null;
  const id = `ADR-${String(number).padStart(3, '0')}`;
  return {
    id,
    number,
    title: stripAdrTitlePrefix(firstMarkdownH1(parsed.content)),
    status: parsed.data.status || '',
    supersededBy: parsed.data.superseded_by || null,
    date: formatAdrDate(parsed.data.date),
    ticket: parsed.data.ticket || '',
    path: filePath,
  };
}

function listPromotedAdrPaths(adrDir) {
  if (!fs.existsSync(adrDir)) return [];
  return fs
    .readdirSync(adrDir)
    .filter((file) => /^ADR-\d{3}-.+\.md$/.test(file))
    .sort()
    .map((file) => path.join(adrDir, file));
}

function maxAdrNumber(adrDir) {
  return listPromotedAdrPaths(adrDir).reduce((max, filePath) => {
    const number = adrNumberFromFile(filePath);
    return number === null ? max : Math.max(max, number);
  }, 0);
}

function promotedAdrById(adrDir) {
  const entries = new Map();
  for (const filePath of listPromotedAdrPaths(adrDir)) {
    const number = adrNumberFromFile(filePath);
    if (number !== null) entries.set(`ADR-${String(number).padStart(3, '0')}`, filePath);
  }
  return entries;
}

function buildAdrRows(adrDir, promotionRows, supersessionEdits) {
  const supersededBy = new Map(supersessionEdits.map((edit) => [edit.id, edit.supersededBy]));
  const existingRows = listPromotedAdrPaths(adrDir)
    .map((filePath) => {
      const row = readAdrRow(filePath);
      if (!row) return null;
      if (supersededBy.has(row.id)) {
        return { ...row, status: 'superseded', supersededBy: supersededBy.get(row.id) };
      }
      return row;
    })
    .filter(Boolean);
  return [...existingRows, ...promotionRows].sort((a, b) => a.number - b.number);
}

function relativeToGit(gitCwd, filePath) {
  const rel = path.relative(gitCwd, filePath).split(path.sep).join('/');
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path is outside git cwd: ${filePath}`);
  }
  return rel;
}

/**
 * Pure planner: reads drafts + already-promoted ADRs, assigns numbering and
 * supersession, and renders the new README — but writes nothing.
 */
export function promoteAdrPlan(slug, { changesDir = defaultChangesDir(), adrDir = defaultAdrDir() } = {}) {
  assertSafeTicketSlug(slug);
  const changeDir = path.join(changesDir, slug);
  if (!fs.existsSync(changeDir)) {
    throw new Error(`No change found at openspec/changes/${slug}/`);
  }

  const draftFiles = listAdrFiles(slug, changesDir);
  if (draftFiles.length === 0) {
    return { slug, promotions: [], readmeContent: null, supersessionEdits: [], touchedPaths: [] };
  }

  const targetById = promotedAdrById(adrDir);
  let nextNumber = maxAdrNumber(adrDir) + 1;
  const promotions = [];
  const promotionRows = [];
  const supersessionEdits = [];

  for (const file of draftFiles) {
    const draftPath = path.join(changeDir, file);
    const parsed = readFrontmatter(draftPath);
    const status = parsed.data.status;
    if (status === 'proposed') {
      throw new Error(`ADR draft still has status: proposed: ${file}`);
    }
    if (!['accepted', 'rejected'].includes(status)) {
      throw new Error(`ADR draft ${file} must be accepted or rejected before promotion (found: ${status || 'missing'})`);
    }
    const supersedes = parsed.data.supersedes || null;
    const supersededPath = supersedes ? targetById.get(supersedes) : null;
    if (supersedes && !supersededPath) {
      throw new Error(`${file} supersedes missing ADR ${supersedes}`);
    }

    while (targetById.has(`ADR-${String(nextNumber).padStart(3, '0')}`)) {
      nextNumber += 1;
    }
    const number = nextNumber;
    const id = `ADR-${String(number).padStart(3, '0')}`;
    const slugPart = adrSlugFromDraft(file);
    const targetPath = path.join(adrDir, `${id}-${slugPart}.md`);
    targetById.set(id, targetPath);
    nextNumber += 1;

    const title = stripAdrTitlePrefix(firstMarkdownH1(parsed.content));
    const promotion = {
      draftFile: file,
      draftPath,
      number,
      id,
      targetPath,
      title,
      status,
      date: formatAdrDate(parsed.data.date),
      ticket: parsed.data.ticket || slug,
      supersedes,
    };
    promotions.push(promotion);
    promotionRows.push({ id, number, title, status, date: promotion.date, ticket: promotion.ticket });
    if (supersedes) {
      supersessionEdits.push({ id: supersedes, path: supersededPath, newStatus: 'superseded', supersededBy: id });
    }
  }

  const existingReadmePath = path.join(adrDir, 'README.md');
  const existingReadme = fs.existsSync(existingReadmePath) ? fs.readFileSync(existingReadmePath, 'utf8') : adrReadmeFallback();
  const readmeContent = renderAdrReadme(existingReadme, buildAdrRows(adrDir, promotionRows, supersessionEdits));
  const touchedPaths = [
    ...promotions.flatMap((promotion) => [promotion.draftPath, promotion.targetPath]),
    existingReadmePath,
    ...supersessionEdits.map((edit) => edit.path),
  ];

  return {
    slug,
    promotions,
    readmeContent,
    supersessionEdits,
    touchedPaths: [...new Set(touchedPaths)],
  };
}

function updateSupersessionFrontmatter(filePath, supersededBy) {
  const parsed = readFrontmatter(filePath);
  parsed.data.status = 'superseded';
  if (parsed.data.date instanceof Date) {
    parsed.data.date = parsed.data.date.toISOString().slice(0, 10);
  }
  parsed.data.superseded_by = supersededBy;
  fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));
}

function verifyCachedMatchesDisk(paths, gitCwd) {
  const relPaths = paths.map((filePath) => relativeToGit(gitCwd, filePath));
  for (const rel of relPaths) {
    const diffStatus = spawnSync('git', ['diff', '--cached', '--quiet', '--', rel], { cwd: gitCwd });
    if (diffStatus.status === 0) {
      throw new Error(`staged content missing for ${rel}`);
    }
    const diskPath = path.join(gitCwd, rel);
    if (!fs.existsSync(diskPath)) continue;
    const cached = execFileSync('git', ['show', `:${rel}`], { cwd: gitCwd });
    const disk = fs.readFileSync(diskPath);
    if (!cached.equals(disk)) {
      throw new Error(`staged content differs from disk for ${rel}`);
    }
  }
}

function snapshotTouchedPaths(paths, gitCwd) {
  return paths.map((filePath) => ({
    filePath,
    rel: relativeToGit(gitCwd, filePath),
    existed: fs.existsSync(filePath),
    content: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null,
  }));
}

function restoreTouchedPaths(snapshots, trackedBefore, gitCwd) {
  for (const snapshot of snapshots) {
    if (snapshot.existed) {
      fs.mkdirSync(path.dirname(snapshot.filePath), { recursive: true });
      fs.writeFileSync(snapshot.filePath, snapshot.content);
    } else {
      fs.rmSync(snapshot.filePath, { force: true });
    }
  }

  const restorePaths = snapshots
    .filter((snapshot) => trackedBefore.has(snapshot.rel))
    .map((snapshot) => snapshot.rel);
  if (restorePaths.length > 0) {
    execFileSync('git', ['add', '--', ...restorePaths], { cwd: gitCwd });
  }

  const removeFromIndex = snapshots
    .filter((snapshot) => !snapshot.existed && !trackedBefore.has(snapshot.rel))
    .map((snapshot) => snapshot.rel);
  if (removeFromIndex.length > 0) {
    execFileSync('git', ['rm', '--cached', '--ignore-unmatch', '--', ...removeFromIndex], { cwd: gitCwd });
  }
}

/**
 * The only mutator: moves draft(s) → openspec/specs/adr/, rewrites README,
 * updates superseded records, stages with git, and verifies staged content
 * matches disk. Rolls back every touched path on any failure (transactional).
 */
export function applyPromotePlan(plan, { gitCwd = process.cwd() } = {}) {
  if (plan.promotions.length === 0) return { stagedPaths: [] };
  fs.mkdirSync(path.dirname(plan.promotions[0].targetPath), { recursive: true });
  const relPaths = plan.touchedPaths.map((filePath) => relativeToGit(gitCwd, filePath));
  const snapshots = snapshotTouchedPaths(plan.touchedPaths, gitCwd);
  const trackedBefore = new Set(
    relPaths.filter((rel) => {
      const result = spawnSync('git', ['ls-files', '--error-unmatch', '--', rel], { cwd: gitCwd });
      return result.status === 0;
    }),
  );

  try {
    for (const promotion of plan.promotions) {
      fs.renameSync(promotion.draftPath, promotion.targetPath);
    }
    fs.writeFileSync(path.join(path.dirname(plan.promotions[0].targetPath), 'README.md'), plan.readmeContent);
    for (const edit of plan.supersessionEdits) {
      updateSupersessionFrontmatter(edit.path, edit.supersededBy);
    }

    const addPaths = relPaths.filter((rel) => fs.existsSync(path.join(gitCwd, rel)) || trackedBefore.has(rel));
    execFileSync('git', ['add', '--', ...addPaths], { cwd: gitCwd });
    verifyCachedMatchesDisk(
      plan.touchedPaths.filter((filePath) => {
        const rel = relativeToGit(gitCwd, filePath);
        return fs.existsSync(path.join(gitCwd, rel)) || trackedBefore.has(rel);
      }),
      gitCwd,
    );
  } catch (err) {
    restoreTouchedPaths(snapshots, trackedBefore, gitCwd);
    throw err;
  }
  return { stagedPaths: relPaths };
}
