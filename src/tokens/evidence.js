/** Source and normative-artifact fingerprints used by handoffs and gates. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readEvidenceFile, readReference, resolveContainedPath, unsafeEvidenceReason } from '../util/fs-safe.js';
import matter from '../util/frontmatter.js';

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function hashReference(root, relativePath) {
  return sha256(readReference(root, relativePath));
}

// Replace refs never substitute objects in evidence digests (design Amendment R5, rule 2).
const GIT_ENV = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };

function git(root, args) {
  return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024, env: GIT_ENV }).toString('utf8').trim();
}

/**
 * Inside the change directory only derived evidence is outside the governed digest (design F04,
 * Amendment R6 decision): the plan (its normative part has its own hash), the packet, handoff and
 * stage manifests, reports, bindings, and the audit files the plan enumerates in
 * `handoff.audit_evidence`. Proposal, design, ADR drafts, delta specs and any other file there are
 * reviewed content.
 */
export function isChangeEvidence(relative, auditEvidence = []) {
  return relative === 'tasks.md' || relative === 'context-packet.md' || relative === 'handoff-manifest.json'
    || /^handoff-manifest-sdd-[a-z-]+-[a-f0-9]{64}\.json$/.test(relative)
    || /^[a-z0-9-]+-report\.md$/.test(relative) || /^evidence-binding-[a-z0-9._-]+\.json$/.test(relative)
    || auditEvidence.includes(relative);
}

/** The audit files a plan enumerates (change-relative paths); never the normative documents. */
export function auditEvidenceOf(tasksRaw) {
  if (!tasksRaw) return [];
  const declared = matter(tasksRaw).data?.handoff?.audit_evidence;
  if (declared === undefined) return [];
  if (!Array.isArray(declared) || declared.some((entry) => typeof entry !== 'string' || !entry || entry.startsWith('/')
    || entry.split('/').includes('..') || ['proposal.md', 'design.md', 'tasks.md'].includes(entry))) {
    throw new Error('tasks.md handoff.audit_evidence must list change-relative audit files other than proposal, design and tasks');
  }
  return declared;
}

/** The audit list as recorded in the working tree, or at a commit. */
function auditInWorkingTree(root, changeId) {
  const relative = `openspec/changes/${changeId}/tasks.md`;
  const reason = unsafeEvidenceReason(root, relative);
  if (reason === 'missing') return [];
  if (reason) throw new Error(`${relative}: not a contained regular file (${reason})`);
  return auditEvidenceOf(readEvidenceFile(root, relative, 'utf8'));
}

export function auditAtCommit(root, commit, changeId) {
  try {
    return auditEvidenceOf(git(root, ['show', `${commit}:openspec/changes/${changeId}/tasks.md`]));
  } catch (error) {
    if (/audit_evidence/.test(error.message)) throw error;
    return [];
  }
}

function excluded(relativePath, changeId, auditEvidence = []) {
  if (relativePath.startsWith('\u0001')) {
    const bytes = Buffer.from(relativePath.slice(1), 'hex');
    const prefix = Buffer.from(`openspec/changes/${changeId}/`);
    if (bytes.subarray(0, prefix.length).equals(prefix)) {
      const local = bytes.subarray(prefix.length);
      return auditEvidence.some((name) => local.equals(Buffer.from(name)))
        || (Buffer.from(local.toString('utf8')).equals(local) && isChangeEvidence(local.toString('utf8'), auditEvidence));
    }
    return [Buffer.from('openspec/archive/'), Buffer.from('.specloom/')]
      .some((prefixBytes) => bytes.subarray(0, prefixBytes.length).equals(prefixBytes));
  }
  const prefix = `openspec/changes/${changeId}/`;
  if (relativePath.startsWith(prefix)) return isChangeEvidence(relativePath.slice(prefix.length), auditEvidence);
  if (relativePath.startsWith('openspec/archive/') || relativePath.startsWith('.specloom/')) return true;
  return relativePath.split('/').includes('.git');
}

/**
 * Validate a declared source path. A declared symlink is governed by its link
 * bytes (as a tracked one already is), so it is checked lexically and through
 * its parent directory instead of being followed; its target is never read.
 */
function assertDeclaredSource(root, name) {
  const absolute = path.resolve(root, name);
  if (fs.lstatSync(absolute, { throwIfNoEntry: false })?.isSymbolicLink()) {
    resolveContainedPath(root, path.dirname(name));
    if (!fs.existsSync(absolute)) throw new Error(`declared source path missing: ${name}`);
    return;
  }
  resolveContainedPath(root, name);
  if (!fs.existsSync(absolute)) throw new Error(`declared source path missing: ${name}`);
}

/** Hash tracked and non-ignored untracked source bytes, file modes and deletions. */
/** The checked-out branch, or null for a detached HEAD (design Amendment R5, rule 6). */
export function currentBranch(root) {
  try {
    return git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']) || null;
  } catch {
    return null;
  }
}

/** Split NUL-terminated Git output into raw byte records. */
function splitNul(buffer) {
  const records = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index++) {
    if (buffer[index] !== 0) continue;
    if (index > start) records.push(buffer.subarray(start, index));
    start = index + 1;
  }
  if (start < buffer.length) records.push(buffer.subarray(start));
  return records;
}

/**
 * A stable key for a path: its text when the bytes are valid UTF-8, otherwise `\u0001` plus the
 * hexadecimal bytes. Names are never decoded lossily, so a tracked file is always found and hashed.
 */
function nameKey(bytes) {
  const text = bytes.toString('utf8');
  return Buffer.from(text, 'utf8').equals(bytes) && !text.startsWith('\u0001') ? text : `\u0001${bytes.toString('hex')}`;
}

function keyPath(root, key) {
  const bytes = keyBytes(key);
  return Buffer.concat([Buffer.from(root.endsWith(path.sep) ? root : root + path.sep), bytes]);
}

function keyBytes(key) {
  return key.startsWith('\u0001') ? Buffer.from(key.slice(1), 'hex') : Buffer.from(key, 'utf8');
}

function isChangeArtifact(key) {
  const prefix = Buffer.from('openspec/changes/');
  return keyBytes(key).subarray(0, prefix.length).equals(prefix);
}

/** Split `<meta>\t<path>` records from `ls-files -s -z` or `ls-tree -z`. */
function metaRecords(buffer) {
  return splitNul(buffer).map((record) => {
    const tab = record.indexOf(0x09);
    return { meta: record.subarray(0, tab).toString('utf8').split(' '), key: nameKey(record.subarray(tab + 1)) };
  });
}

/** Files under a declared directory (symbolic links kept as links, `.git` skipped). */
function expandDeclared(root, name) {
  const absolute = keyPath(root, name);
  const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) return [name];
  return fs.readdirSync(absolute, { encoding: 'buffer' }).filter((entry) => !entry.equals(Buffer.from('.git')))
    .flatMap((entry) => expandDeclared(root, nameKey(Buffer.concat([keyBytes(name), Buffer.from('/'), entry]))));
}

/** Actual child content is compared to HEAD; index performance hints never prove cleanliness. */
function assertSubmoduleContents(directory, key, commit) {
  const entries = metaRecords(execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', commit], {
    cwd: directory, stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV, maxBuffer: 64 * 1024 * 1024,
  }));
  const blobs = entries.filter(({ meta }) => meta[0] !== '160000');
  const contents = readBlobs(directory, blobs.map(({ meta }) => meta[2]));
  let index = 0;
  for (const { meta: [mode, , object], key: child } of entries) {
    const file = keyPath(directory, child), parent = file.subarray(0, file.lastIndexOf(47));
    if (!fs.realpathSync(parent, { encoding: 'buffer' }).equals(parent)) throw new Error(`submodule has unreviewed symbolic parent: ${key}/${child}`);
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    let matches = false;
    if (mode === '160000') matches = !!stat && stat.isDirectory() && gitlinkCommit(directory, child, object) === object;
    else {
      const expected = contents[index++];
      if (mode === '120000') matches = !!stat?.isSymbolicLink() && fs.readlinkSync(file, { encoding: 'buffer' }).equals(expected);
      else if (['100644', '100755'].includes(mode)) matches = !!stat?.isFile()
        && ((stat.mode & 0o100) !== 0) === (mode === '100755') && fs.readFileSync(file).equals(expected);
    }
    if (!matches) throw new Error(`initialized submodule has unreviewed local content: ${key}/${child}`);
  }
}

/** The commit a submodule's working tree is at, or the recorded gitlink when it is not populated. */
function gitlinkCommit(root, key, recorded) {
  if (key.startsWith('\u0001')) throw new Error(`cannot inspect non-UTF-8 submodule path: ${key}`);
  resolveContainedPath(root, key);
  const directory = keyPath(root, key).toString();
  let initialized = false;
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV }).toString('utf8').trim();
    if (fs.realpathSync(top) !== fs.realpathSync(directory)) {
      if (fs.readdirSync(directory).length > 0) throw new Error(`uninitialized submodule contains unreviewed local files: ${key}`);
      return recorded;
    }
    initialized = true;
    const status = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none'], {
      cwd: directory, stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV,
    });
    if (status.length > 0) throw new Error(`initialized submodule has unreviewed local changes: ${key}`);
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV }).toString('utf8').trim();
    assertSubmoduleContents(directory, key, commit);
    return commit;
  } catch (error) {
    if (initialized || error.message?.includes('unreviewed local files')) throw error;
    return recorded;
  }
}

export function snapshotRepository({ root, changeId, untrackedPaths = [] }) {
  const branch = currentBranch(root);
  const commit_sha = git(root, ['rev-parse', 'HEAD']);
  if (!/^[a-f0-9]{40}$/.test(commit_sha)) throw new Error(`invalid Git HEAD at ${root}`);
  // Raw bytes from Git's index: modes and object ids are kept so gitlinks (submodules) are recognized.
  const indexed = new Map();
  for (const { meta, key } of metaRecords(execFileSync('git', ['ls-files', '--cached', '--stage', '-z'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, env: GIT_ENV,
  }))) indexed.set(key, { mode: meta[0], object: meta[1] });
  const audit = auditInWorkingTree(root, changeId);
  const declared = [];
  for (const name of untrackedPaths) {
    // An untracked environment file is a secret store, never declarable source.
    const basename = name.split('/').at(-1);
    if (excluded(name, changeId, audit) || basename === '.env' || basename.startsWith('.env.')) throw new Error(`declared source path excluded: ${name}`);
    assertDeclaredSource(root, name);
    for (const entry of expandDeclared(root, name)) {
      const entryBase = entry.split('/').at(-1);
      if (!excluded(entry, changeId, audit) && entryBase !== '.env' && !entryBase.startsWith('.env.')) declared.push(entry);
    }
  }
  // The change's own files are its scope even before they are committed: proposal, design, ADR
  // drafts and other non-evidence files are reviewed content whether tracked or not.
  const changeFiles = splitNul(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z', '--', `openspec/changes/${changeId}/`], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, env: GIT_ENV,
  })).map(nameKey);
  const files = [...new Set([...indexed.keys(), ...declared, ...changeFiles])]
    .filter((key) => !excluded(key, changeId, audit)).sort();
  const digest = createHash('sha256');
  const tree = [];
  let treeComparable = true;
  for (const name of files) {
    const file = keyPath(root, name);
    if (isChangeArtifact(name)) {
      const reason = unsafeEvidenceReason(root, keyBytes(name));
      if (reason && reason !== 'missing') throw new Error(`${name}: not a contained regular file (${reason})`);
    }
    let type = 'deleted';
    let mode = '0';
    let contentHash = '';
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    const record = indexed.get(name);
    if (stat && record?.mode === '160000') {
      type = 'gitlink';
      mode = '160000';
      contentHash = sha256(Buffer.from(gitlinkCommit(root, name, record.object)));
      tree.push(treeEntry(name, 'gitlink', false, contentHash));
    } else if (stat) {
      mode = String(stat.mode & 0o777);
      if (stat.isSymbolicLink()) {
        type = 'symlink';
        contentHash = sha256(fs.readlinkSync(file, { encoding: 'buffer' }));
        tree.push(treeEntry(name, 'symlink', false, contentHash));
      } else if (stat.isFile()) {
        type = 'file';
        contentHash = sha256(isChangeArtifact(name) ? readEvidenceFile(root, keyBytes(name)) : fs.readFileSync(file));
        tree.push(treeEntry(name, 'file', (stat.mode & 0o100) !== 0, contentHash));
      } else {
        type = 'other';
        treeComparable = false;
      }
    }
    digest.update(`${name}\0${type}\0${mode}\0${contentHash}\0`);
  }
  const result = { branch, commit_sha, source_hash: digest.digest('hex'), inventory_count: files.length };
  if (treeComparable) result.tree_hash = treeDigest(tree);
  for (const name of files) {
    if (indexed.get(name)?.mode === '160000' && fs.lstatSync(keyPath(root, name), { throwIfNoEntry: false })) {
      const finalCommit = gitlinkCommit(root, name, indexed.get(name).object);
      if (!tree.includes(treeEntry(name, 'gitlink', false, sha256(Buffer.from(finalCommit))))) {
        throw new Error(`submodule changed during source snapshot: ${name}`);
      }
    }
  }
  return result;
}

/**
 * Git-comparable governed digest. Unlike `source_hash` (working-tree modes),
 * it records only what a Git tree can hold: file or symlink, the executable
 * bit and the content bytes. Deleted paths are simply absent. The same function
 * hashes the reviewed working tree and a committed tree, so a later commit can
 * be proven identical to the reviewed bytes.
 */
function treeEntry(name, kind, executable, contentHash) {
  return `${name}\0${kind}\0${executable ? '1' : '0'}\0${contentHash}\0`;
}

function treeDigest(entries) {
  return sha256([...entries].sort().join(''));
}

/** Tree digest of a commit as recorded in Git; null when an entry cannot be compared consistently. */
export function commitTreeDigest({ root, commit, changeId }) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`invalid commit: ${commit}`);
  const listing = metaRecords(execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', commit], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, env: GIT_ENV,
  }));
  const audit = auditAtCommit(root, commit, changeId);
  const wanted = [];
  const entries = [];
  for (const { meta: [mode, , object], key } of listing) {
    if (excluded(key, changeId, audit)) continue;
    if (mode === '160000') {
      entries.push(treeEntry(key, 'gitlink', false, sha256(Buffer.from(object))));
      continue;
    }
    if (!['100644', '100755', '120000'].includes(mode)) return null;
    wanted.push({ name: key, mode, object });
  }
  const contents = readBlobs(root, wanted.map(({ object }) => object));
  return treeDigest([...entries, ...wanted.map(({ name, mode }, index) => treeEntry(name, mode === '120000' ? 'symlink' : 'file',
    mode === '100755', sha256(contents[index])))]);
}

function readBlobs(root, objects) {
  if (objects.length === 0) return [];
  const output = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root, input: `${objects.join('\n')}\n`, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 1024, env: GIT_ENV,
  });
  const blobs = [];
  let offset = 0;
  for (const object of objects) {
    const end = output.indexOf(0x0a, offset);
    const header = output.subarray(offset, end).toString('utf8').split(' ');
    if (header[0] !== object || header[1] !== 'blob') throw new Error(`unreadable Git object: ${object}`);
    const size = Number(header[2]);
    blobs.push(output.subarray(end + 1, end + 1 + size));
    offset = end + 1 + size + 1;
  }
  return blobs;
}

/** Ignore only completion checkboxes and appended execution reports. */
/**
 * Hash of the plan's normative content: everything except Execution Report sections (from an
 * `## Execution Report` heading to the next level-two heading) and completion checkboxes.
 * Task text, files, criteria and commands count wherever they appear, before or after a report.
 */
export function normativeTasksHash(raw) {
  // Front matter is normative as a whole; only the Markdown body has reports to drop.
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  const frontmatter = match ? match[0] : '';
  const kept = [];
  let fence = null;
  let reportLevel = 0;
  let indented = false;
  for (const line of raw.slice(frontmatter.length).split('\n')) {
    const blank = line.trim() === '';
    if (!blank) indented = /^(?: {4}|\t)/.test(line);
    // Conservatively recognize fences through list and quote containers. An ambiguous literal
    // stays governed; it must never be mistaken for execution bookkeeping.
    let containerLine = line;
    let quotes = 0;
    while (/^[ \t]*(?:>[ \t]?|(?:[-*+]|\d{1,9}[.)])[ \t]+)/.test(containerLine)) {
      if (/^[ \t]*>/.test(containerLine)) quotes++;
      containerLine = containerLine.replace(/^[ \t]*(?:>[ \t]?|(?:[-*+]|\d{1,9}[.)])[ \t]+)/, '');
    }
    const fenceMatch = containerLine.match(/^[ \t]*(`{3,}|~{3,})/);
    const literal = !!fence || indented || !!fenceMatch;
    if (fence) {
      let closing = line, closingQuotes = 0;
      while (/^[ \t]*>/.test(closing)) { closing = closing.replace(/^[ \t]*>[ \t]?/, ''); closingQuotes++; }
      const closeMatch = closing.match(/^[ \t]*(`{3,}|~{3,})[ \t]*$/);
      if (closeMatch && closingQuotes === fence.quotes && closeMatch[1][0] === fence.marker[0]
        && closeMatch[1].length >= fence.marker.length) fence = null;
    } else if (fenceMatch) {
      fence = { marker: fenceMatch[1], quotes };
    } else {
      // CommonMark ATX heading: up to three spaces, 1–6 '#', then a space or tab (or end of line).
      const heading = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/);
      if (heading) {
        const level = heading[1].length;
        const text = (heading[2] || '').trim();
        if (reportLevel && level <= reportLevel) reportLevel = 0;
        if (!reportLevel && level === 2 && /^Execution Report(?:$|\s+[—–:-])/.test(text)) reportLevel = 2;
      }
    }
    if (!reportLevel && !(!literal && /^\s*- \*\*Done\*\*: \[[ xX]\]\s*$/.test(line))) {
      kept.push({ line: literal ? line : line.replace(/^(\s*[-*+] )\[[ xX]\](?=\s)/, '$1[ ]'), literal });
    }
  }
  const normalized = [];
  for (const entry of kept) {
    if (entry.line === '' && !entry.literal && normalized.length >= 2
      && normalized.at(-1).line === '' && !normalized.at(-1).literal
      && normalized.at(-2).line === '' && !normalized.at(-2).literal) continue;
    normalized.push(entry);
  }
  while (normalized.at(-1)?.line.trim() === '' && !normalized.at(-1).literal) normalized.pop();
  const normative = frontmatter + normalized.map(({ line }) => line).join('\n') + '\n';
  return sha256(normative);
}
