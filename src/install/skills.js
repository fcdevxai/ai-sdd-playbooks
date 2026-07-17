/**
 * Global skill installation (design §2.1, decision 2).
 *
 * Installs the methodology ONCE, globally, into the selected runtime targets.
 * Claude has its own target; GitHub Copilot and Codex share ~/.agents/skills.
 * Core only by default; add-ons require explicit opt-in (`--addon <name>`,
 * AC-14). Writes only under the given target dirs — never any consumer-repo
 * files (AC-02).
 *
 * Sources (in the published package):
 *   skills/<name>/SKILL.md                 → core
 *   addons/<addon>/<name>/SKILL.md         → opt-in add-ons
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');

export function readPackageVersion(root = PACKAGE_ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
}

/** Skill dirs directly under `dir` that contain a SKILL.md. */
export function listSkills(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((name) => ({ name, dir: path.join(dir, name) }))
    .filter((s) => fs.statSync(s.dir).isDirectory() && fs.existsSync(path.join(s.dir, 'SKILL.md')));
}

export function listAddonSkills(addonsDir, addon) {
  return listSkills(path.join(addonsDir, addon)).map((s) => ({ ...s, addon }));
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * Install core (+ requested add-ons) into each target dir and stamp the version.
 * Returns a summary; writes nothing outside the target dirs.
 */
export function installSkills({ targets, version, addons = [], sourceRoot = PACKAGE_ROOT }) {
  const core = listSkills(path.join(sourceRoot, 'skills'));
  const addonSkills = addons.flatMap((a) => listAddonSkills(path.join(sourceRoot, 'addons'), a));
  const all = [...core, ...addonSkills];

  const installedInto = {};
  for (const [runtime, targetDir] of Object.entries(targets)) {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const s of all) copyDir(s.dir, path.join(targetDir, s.name));
    fs.writeFileSync(path.join(targetDir, '.sdd-version'), `${version}\n`, 'utf8');
    installedInto[runtime] = targetDir;
  }

  return {
    version,
    core: core.map((s) => s.name),
    addons: addonSkills.map((s) => `${s.addon}/${s.name}`),
    targets: installedInto,
  };
}
