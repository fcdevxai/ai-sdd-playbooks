/**
 * `sdd install` — install/refresh core skills into the global agent dirs.
 *
 * Core only unless `--addon <name>` is given (repeatable). Writes only under the
 * resolved global targets; creates no consumer-repo files (AC-02, AC-14).
 */
import { EXIT } from './exit.js';
import { resolveTargets } from '../install/targets.js';
import { installSkills, readPackageVersion } from '../install/skills.js';
import { loadConfig } from '../config/config.js';

function parseInstallArgs(rest) {
  const addons = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--addon' && rest[i + 1]) { addons.push(rest[i + 1]); i++; }
  }
  return { addons };
}

export async function installCommand(parsed, io) {
  const { addons: flagAddons } = parseInstallArgs(parsed.rest);
  // Add-ons are opt-in: via --addon and/or `addons:` in the project's sdd.config.yaml.
  const { config } = loadConfig({ cwd: parsed.flags.cwd || process.cwd() });
  const configAddons = Object.entries(config.addons || {})
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  const addons = [...new Set([...flagAddons, ...configAddons])];

  const version = readPackageVersion();
  const targets = resolveTargets(process.env);
  const result = installSkills({ targets, version, addons });

  if (parsed.flags.json) {
    io.out(JSON.stringify(result, null, 2));
    return EXIT.OK;
  }

  io.out(`sdd install — methodology ${version}`);
  io.out(`  core skills: ${result.core.length ? result.core.join(', ') : '(none authored yet)'}`);
  if (addons.length) {
    io.out(`  add-on skills: ${result.addons.length ? result.addons.join(', ') : '(none found)'}`);
  }
  for (const [runtime, dir] of Object.entries(result.targets)) {
    io.out(`  → ${runtime}: ${dir}`);
  }
  return EXIT.OK;
}
