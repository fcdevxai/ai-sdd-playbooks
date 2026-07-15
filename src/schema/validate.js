/**
 * Frontmatter/config validation against the compiled schemas.
 *
 * Pure with respect to the filesystem beyond reading the schema files once:
 * callers pass already-parsed objects (frontmatter, config, lock). Nothing here
 * matches headings, verdict phrases, or emojis, and nothing writes (C-12).
 */
import { loadValidators } from './load.js';

let _bundle;
function bundle() {
  if (!_bundle) _bundle = loadValidators();
  return _bundle;
}

function formatErrors(errors = []) {
  return errors.map((e) => {
    const where = e.instancePath || '(root)';
    const allowed = e.params && e.params.allowedValues
      ? ` — allowed: ${e.params.allowedValues.join(', ')}`
      : '';
    const missing = e.params && e.params.missingProperty
      ? ` '${e.params.missingProperty}'`
      : '';
    return `${where} ${e.message}${missing}${allowed}`;
  });
}

/** Validate a parsed object against a named schema (e.g. 'sdd.config'). */
export function validateNamed(name, obj) {
  const validate = bundle().validators[name];
  if (!validate) return { valid: false, errors: [`no schema named '${name}'`] };
  const valid = validate(obj);
  return { valid, errors: valid ? [] : formatErrors(validate.errors) };
}

/**
 * Validate artifact frontmatter. The artifact type is taken from `schema`.
 * Returns { skipped: true } when the frontmatter has no `schema` field
 * (i.e. the file is not an SDD artifact).
 */
export function validateArtifactFrontmatter(frontmatter) {
  const type = frontmatter && frontmatter.schema;
  if (!type) return { skipped: true, valid: true, errors: [] };
  const validate = bundle().validators[type];
  if (!validate) {
    return { skipped: false, valid: false, errors: [`unknown artifact schema '${type}'`] };
  }
  const valid = validate(frontmatter);
  return { skipped: false, valid, errors: valid ? [] : formatErrors(validate.errors) };
}

export function schemaKeys() {
  return bundle().keys;
}
