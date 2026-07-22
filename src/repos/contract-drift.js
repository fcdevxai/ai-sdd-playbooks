/**
 * Structural diff between the canonical OpenAPI contract
 * (openspec/specs/contracts/openapi.yaml, the "loom-first" source of truth
 * per playbook.config.yaml's `contract:`) and an OpenAPI document generated
 * from a repo's actual implementation. Ported from specloom's
 * `check-contract-drift.js`.
 *
 * This is a STRUCTURAL check (which endpoints exist, which fields are
 * required), not a full semantic OpenAPI equivalence check — it will not
 * catch every possible divergence (e.g. a field whose type silently changed
 * from string to number), but it catches the common, high-impact cases:
 * missing/extra endpoints and missing/extra required fields.
 *
 * Stack-agnostic: it only reads standard OpenAPI YAML/JSON, so the same
 * check works regardless of what generates the other repo's spec.
 */
import fs from 'node:fs';
import yaml from 'js-yaml';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export function loadSpec(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return filePath.endsWith('.json') ? JSON.parse(raw) : yaml.load(raw);
}

function endpointKey(pathStr, method) {
  return `${method.toUpperCase()} ${pathStr}`;
}

function collectEndpoints(spec) {
  const endpoints = new Map();
  const paths = spec.paths || {};
  for (const [pathStr, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue;
      endpoints.set(endpointKey(pathStr, method), operation);
    }
  }
  return endpoints;
}

function requiredFields(operation) {
  const schema = operation?.requestBody?.content?.['application/json']?.schema;
  return new Set(schema?.required || []);
}

/** Pure structural diff between two parsed OpenAPI documents. Returns an array of issue strings. */
export function diffContract(canonical, generated) {
  const canonicalEndpoints = collectEndpoints(canonical);
  const generatedEndpoints = collectEndpoints(generated);
  const issues = [];

  for (const key of canonicalEndpoints.keys()) {
    if (!generatedEndpoints.has(key)) {
      issues.push(`MISSING IN BACKEND: ${key} is in the contract but not implemented`);
    }
  }

  for (const key of generatedEndpoints.keys()) {
    if (!canonicalEndpoints.has(key)) {
      issues.push(`UNDOCUMENTED: ${key} is implemented but not in the contract`);
    }
  }

  for (const [key, canonicalOp] of canonicalEndpoints.entries()) {
    if (!generatedEndpoints.has(key)) continue;
    const generatedOp = generatedEndpoints.get(key);
    const canonicalRequired = requiredFields(canonicalOp);
    const generatedRequired = requiredFields(generatedOp);

    for (const field of canonicalRequired) {
      if (!generatedRequired.has(field)) {
        issues.push(`FIELD MISMATCH: ${key} - contract requires "${field}", backend does not`);
      }
    }
    for (const field of generatedRequired) {
      if (!canonicalRequired.has(field)) {
        issues.push(`FIELD MISMATCH: ${key} - backend requires "${field}", contract does not`);
      }
    }
  }

  return issues;
}

/** Convenience wrapper: loads both files from disk and diffs them. */
export function checkContractDrift(canonicalPath, generatedPath) {
  for (const p of [canonicalPath, generatedPath]) {
    if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`);
  }
  return diffContract(loadSpec(canonicalPath), loadSpec(generatedPath));
}
