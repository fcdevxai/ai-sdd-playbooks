/**
 * Install manifest (design §1, ADR "La instalación global se verifica por
 * contenido, no por número de versión").
 *
 * `.playbook-version` answers "is this a compatible version?" — the manifest
 * answers "is the installed content what that version declares?". Separate
 * artifact, separate question: the stamp is what `playbook sync` copies into
 * the consumer's committed `playbook.lock`, and a manifest field leaking in
 * there would be silent, permanent contamination.
 *
 * All functions here are pure and read-only except `writeManifest`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const MANIFEST_FILENAME = '.playbook-manifest.json';
const SCHEMA_VERSION = 1;

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function manifestPathFor(targetDir) {
  return path.join(targetDir, MANIFEST_FILENAME);
}

/**
 * `skills`: array of `{ name, files }`, where each file is `{ name, sourcePath }`.
 * In `copy` mode each file entry gets the sha256 of its source (what was just
 * copied byte-for-byte); in `link` mode it gets the absolute source path instead
 * — a digest there would always match the source, by definition.
 */
export function buildManifest({ version, mode = 'copy', sourceRoot = null, skills = [] }) {
  const skillsEntry = {};
  for (const skill of skills) {
    const files = {};
    for (const file of skill.files) {
      files[file.name] = mode === 'link'
        ? { link: file.sourcePath }
        : { sha256: sha256File(file.sourcePath) };
    }
    skillsEntry[skill.name] = files;
  }
  const manifest = { schema_version: SCHEMA_VERSION, version, mode, skills: skillsEntry };
  if (mode === 'link') manifest.source = sourceRoot;
  return manifest;
}

export function writeManifest(targetDir, manifest) {
  fs.writeFileSync(manifestPathFor(targetDir), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/** Absent or unparseable/unknown-schema manifest → `null`, never throws. */
export function readManifest(targetDir) {
  const p = manifestPathFor(targetDir);
  if (!fs.existsSync(p)) return null;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
  if (!parsed || parsed.schema_version !== SCHEMA_VERSION) return null;
  return parsed;
}

/**
 * Pure, read-only: compares a manifest against what is actually installed in
 * `targetDir`. Returns an array of finding strings — empty means no drift.
 * A `sha256` entry mismatched or missing is a finding; a `link` entry whose
 * symlink is dangling is a finding. A resolvable link is never a finding —
 * that is the point of link mode.
 */
export function verifyManifest(targetDir, manifest) {
  const findings = [];
  for (const [skillName, files] of Object.entries(manifest.skills || {})) {
    for (const [fileName, entry] of Object.entries(files)) {
      const installedPath = path.join(targetDir, skillName, fileName);
      if ('sha256' in entry) {
        if (!fs.existsSync(installedPath)) {
          findings.push(`${skillName}/${fileName} is missing from the install (${installedPath})`);
          continue;
        }
        if (sha256File(installedPath) !== entry.sha256) {
          findings.push(`${skillName}/${fileName} content differs from what \`playbook install\` recorded — re-run \`playbook install\``);
        }
      } else if ('link' in entry) {
        let resolved = null;
        try {
          if (fs.existsSync(installedPath)) resolved = fs.realpathSync(installedPath);
        } catch {
          resolved = null;
        }
        if (!resolved) {
          findings.push(`${skillName}/${fileName} is a dangling symlink (source moved or deleted) — re-run \`playbook install --link\``);
        }
      }
    }
  }
  return findings;
}
