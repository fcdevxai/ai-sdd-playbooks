/**
 * Schema loader — compiles every schemas/*.schema.json with ajv (draft 2020-12).
 *
 * Returns a map of validators keyed by the schema basename:
 *   proposal, design, tasks, code-review-report, security-report,
 *   runtime-gate-report, verification-report, sdd.config, sdd.lock
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA_DIR = path.resolve(__dirname, '..', '..', 'schemas');

export function loadValidators(schemaDir = SCHEMA_DIR) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validators = {};
  const files = fs
    .readdirSync(schemaDir)
    .filter((f) => f.endsWith('.schema.json'))
    .sort();

  for (const file of files) {
    const key = file.replace(/\.schema\.json$/, '');
    const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8'));
    validators[key] = ajv.compile(schema);
  }

  return { ajv, validators, keys: Object.keys(validators) };
}
