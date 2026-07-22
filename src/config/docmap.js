/**
 * Document adoption map (design §5.1, C-09).
 *
 * Resolves a logical document name (system_spec, architecture, verification,
 * workflow) to a path: `documents:` in playbook.config.yaml wins over the default.
 * `adopted` marks that the project pointed the logical doc at a non-default path
 * (adoption by config, C-09) rather than using the scaffold location.
 */
import { DEFAULT_DOCUMENTS } from './config.js';

export function documentNames() {
  return Object.keys(DEFAULT_DOCUMENTS);
}

export function resolveDocument(config, logicalName) {
  const fromConfig = config && config.documents && config.documents[logicalName];
  const fallback = DEFAULT_DOCUMENTS[logicalName] || null;
  const resolved = fromConfig || fallback;
  return {
    name: logicalName,
    path: resolved,
    known: Boolean(resolved),
    adopted: Boolean(fromConfig && fromConfig !== fallback),
  };
}

export function resolveAllDocuments(config) {
  return documentNames().map((name) => resolveDocument(config, name));
}
