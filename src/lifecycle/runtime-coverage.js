/** Fail-closed runtime coverage across configured surfaces and declared criteria. */
import { ADAPTERS, gateStatusFromAdapters } from '../adapters/index.js';

function sameReceipt(left, right) {
  return left?.repository === right?.repository && left?.path === right?.path && left?.sha256 === right?.sha256;
}

function checkReceipt(reference, validateReceipt, issues, context) {
  if (!reference || typeof reference.repository !== 'string' || typeof reference.path !== 'string'
    || !/^[a-f0-9]{64}$/.test(reference.sha256 || '')) {
    issues.push(`${context}: invalid receipt reference`);
    return;
  }
  const result = validateReceipt(reference);
  if (!result?.ok) issues.push(`${context}: ${result?.issues?.join('; ') || 'receipt validation failed'}`);
}

/** Canonical references the handoff already governs; an exclusion's authority must be one of them. */
function governedReferences(manifest) {
  return [
    manifest?.requirement, manifest?.design,
    ...(manifest?.spec || []), ...(manifest?.architecture || []),
    ...(manifest?.contracts || []).map((entry) => ({ repository: entry.repository, path: entry.path, hash: entry.content_hash })),
  ].filter(Boolean);
}

/** Structural problems that make a runtime report unreadable as coverage (reported, never a crash). */
function reportShapeIssues(report) {
  const issues = [];
  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
  if (report?.adapters !== undefined && !isObject(report.adapters)) issues.push('runtime report adapters must be a mapping');
  if (report?.coverage !== undefined && (!Array.isArray(report.coverage) || !report.coverage.every(isObject))) issues.push('runtime report coverage must be a list of entries');
  for (const [name, adapter] of Object.entries(isObject(report?.adapters) ? report.adapters : {})) {
    if (!isObject(adapter)) { issues.push(`runtime adapter ${name} must be a mapping`); continue; }
    if (adapter.receipts !== undefined && !Array.isArray(adapter.receipts)) issues.push(`runtime adapter ${name} receipts must be a list`);
    if (adapter.exclusion !== undefined && !isObject(adapter.exclusion)) issues.push(`runtime adapter ${name} exclusion must be a mapping`);
    for (const key of ['substitute_receipts', 'covered_criteria']) {
      if (adapter.exclusion?.[key] !== undefined && !Array.isArray(adapter.exclusion[key])) issues.push(`runtime adapter ${name} exclusion ${key} must be a list`);
    }
  }
  return issues;
}

export function validateRuntimeCoverage(report, { manifest, config, validateReceipt, repositoryCapabilities = () => null }) {
  const shape = reportShapeIssues(report);
  if (shape.length) return shape;
  const issues = [];
  const adapters = report?.adapters || {};
  const coverage = report?.coverage || [];
  const declared = manifest?.runtime_coverage || [];
  // F05: every AC, EC and SEC needs a runtime mapping or a deliberate non-runtime rationale.
  const known = new Set([...(manifest?.acceptance_criteria || []), ...(manifest?.error_cases || []), ...(manifest?.security_criteria || [])].map(({ id }) => id));
  const nonRuntime = new Map((manifest?.non_runtime_criteria || []).map(({ criterion, rationale }) => [criterion, rationale]));
  const expected = new Set();
  const mappedCapabilities = new Map();
  // A repository's own capabilities decide applicability; the aggregate Hub
  // capabilities are acceptable only when the change has a single repository.
  const multiRepository = (manifest?.repositories || []).length > 1;
  const reported = new Set();
  const capabilityCache = new Map();
  const ownCapabilities = (repository) => {
    if (!capabilityCache.has(repository)) {
      try { capabilityCache.set(repository, { value: repositoryCapabilities(repository) }); }
      catch (error) { capabilityCache.set(repository, { error: error.message }); }
    }
    return capabilityCache.get(repository);
  };
  // F05: a repository's own configuration first, then the Hub's explicit repos.<name>.capabilities.
  const capabilitiesAreExplicit = (repository) => !!ownCapabilities(repository).value || !!config?.repos?.[repository]?.capabilities || !multiRepository;
  const capabilitiesOf = (repository) => {
    const authority = ownCapabilities(repository);
    if (authority.error) {
      if (!reported.has(repository)) {
        reported.add(repository);
        issues.push(`repository ${repository} has invalid own capability configuration: ${authority.error}`);
      }
      return {};
    }
    const own = authority.value;
    if (own) return own;
    const explicit = config?.repos?.[repository]?.capabilities;
    if (explicit) return explicit;
    if (!multiRepository) return config?.capabilities || {};
    if (!reported.has(repository)) {
      reported.add(repository);
      issues.push(`repository ${repository} has no explicit capabilities for a multi-repository change`);
    }
    return {};
  };
  for (const mapping of declared) {
    if (!known.has(mapping.criterion)) issues.push(`unknown runtime criterion ${mapping.criterion}`);
    for (const repository of mapping.repositories || []) {
      if (!(manifest?.repositories || []).some(({ name }) => name === repository)) issues.push(`unknown runtime repository ${repository}`);
      const pair = `${mapping.criterion}:${repository}`;
      if (!mappedCapabilities.has(pair)) mappedCapabilities.set(pair, new Set());
      for (const adapter of mapping.capabilities || []) mappedCapabilities.get(pair).add(adapter);
      for (const adapter of mapping.capabilities || []) expected.add(`${mapping.criterion}:${repository}:${adapter}`);
    }
  }
  for (const id of known) {
    const mapped = declared.some(({ criterion }) => criterion === id);
    const rationale = nonRuntime.get(id);
    if (mapped && nonRuntime.has(id)) issues.push(`${id} is both mapped to runtime evidence and declared non-runtime`);
    else if (!mapped && !(typeof rationale === 'string' && rationale.trim())) issues.push(`${id} has no runtime criterion mapping or non-runtime rationale`);
  }
  for (const [pair, mapped] of mappedCapabilities) {
    const [criterion, repository] = pair.split(':');
    const capabilities = capabilitiesOf(repository);
    if (capabilitiesAreExplicit(repository)) {
      for (const name of mapped) {
        if (!Object.hasOwn(ADAPTERS, name)) issues.push(`${criterion} ${repository} maps unknown capability ${name}`);
        else if (!capabilities[ADAPTERS[name].capability]) issues.push(`${criterion} ${repository} maps disabled capability ${name}`);
      }
    }
    for (const [name, descriptor] of Object.entries(ADAPTERS)) {
      if (capabilities[descriptor.capability] && !mapped.has(name)) {
        issues.push(`${criterion} ${repository} enabled capability ${name} not mapped`);
      }
    }
  }
  const requiredAdapters = new Set();
  for (const { name: repository } of manifest?.repositories || []) {
    const capabilities = capabilitiesOf(repository);
    for (const [name, descriptor] of Object.entries(ADAPTERS)) {
      if (capabilities[descriptor.capability]) requiredAdapters.add(name);
    }
  }
  for (const mapping of declared) for (const capability of mapping.capabilities || []) requiredAdapters.add(capability);
  for (const name of requiredAdapters) if (!Object.hasOwn(adapters, name)) issues.push(`required runtime adapter ${name} missing`);
  for (const [name, adapter] of Object.entries(adapters)) {
    if (!Object.hasOwn(ADAPTERS, name)) { issues.push(`unknown runtime adapter ${name}`); continue; }
    if (!['passed', 'not_applicable', 'blocked', 'failed'].includes(adapter.status)) issues.push(`adapter ${name} has invalid status`);
    if (adapter.status === 'passed') {
      if (ADAPTERS[name]?.support !== 'supported') issues.push(`adapter ${name} cannot pass with ${ADAPTERS[name]?.support || 'unknown'} support`);
      if (!Array.isArray(adapter.receipts) || adapter.receipts.length === 0) issues.push(`adapter ${name} passed without receipt`);
      for (const ref of adapter.receipts || []) {
        checkReceipt(ref, validateReceipt, issues, `adapter ${name}`);
        if (!(manifest?.repositories || []).some(({ name: repository }) => repository === ref?.repository)
          || !capabilitiesOf(ref?.repository)[ADAPTERS[name].capability]) issues.push(`adapter ${name} receipt names an unknown or disabled repository capability`);
        if (!coverage.some(row => row.adapter === name && row.repository === ref?.repository
          && expected.has(`${row.criterion}:${row.repository}:${name}`) && sameReceipt(row.receipt, ref))) {
          issues.push(`adapter ${name} has receipt unrelated to its required coverage`);
        }
      }
    } else if (adapter.status === 'not_applicable') {
      if (adapter.reason_code !== 'NOT_RELEVANT_TO_CHANGE' || !adapter.exclusion?.reason?.trim()) {
        issues.push(`adapter ${name} has invalid exclusion`);
      }
      const exclusion = adapter.exclusion;
      const approving = exclusion?.authority;
      if (!approving || !governedReferences(manifest).some((entry) => entry.repository === approving.repository
        && entry.path === approving.path && entry.hash === approving.hash)) {
        issues.push(`adapter ${name} exclusion needs an approving authority reference governed by the handoff`);
      }
      const covered = exclusion?.covered_criteria;
      const mappedCriteria = declared.filter((mapping) => (mapping.capabilities || []).includes(name)).map((mapping) => mapping.criterion);
      if (!Array.isArray(covered) || covered.length === 0 || mappedCriteria.some((id) => !covered.includes(id))) {
        issues.push(`adapter ${name} exclusion needs covered criteria including ${mappedCriteria.join(', ') || 'at least one criterion'}`);
      }
      for (const id of Array.isArray(covered) ? covered : []) {
        if (!known.has(id)) issues.push(`adapter ${name} exclusion covers unknown criterion ${id}`);
      }
      const substitutes = adapter.exclusion?.substitute_receipts;
      if (!Array.isArray(substitutes) || substitutes.length === 0) issues.push(`adapter ${name} exclusion needs substitute receipt`);
      for (const ref of substitutes || []) checkReceipt(ref, validateReceipt, issues, `adapter ${name} substitute`);
    } else {
      issues.push(`required adapter ${name} not passed: ${adapter.status || 'unknown'}`);
    }
  }
  for (const row of coverage) {
    const key = `${row.criterion}:${row.repository}:${row.adapter}`;
    if (!expected.has(key)) { issues.push(`unrelated runtime coverage ${key}`); continue; }
    const adapter = adapters[row.adapter];
    const references = adapter?.status === 'passed' ? adapter.receipts
      : adapter?.status === 'not_applicable' ? adapter.exclusion?.substitute_receipts : [];
    if (!adapter || !['passed', 'not_applicable'].includes(adapter.status)) {
      issues.push(`coverage ${key} has no cleared adapter`); continue;
    }
    if (row.receipt?.repository !== row.repository || !(references || []).some((ref) => sameReceipt(ref, row.receipt))) {
      issues.push(`coverage ${key} has unrelated receipt or repository`);
    }
  }
  for (const key of expected) {
    const [criterion, repository, adapter] = key.split(':');
    if (!coverage.some((row) => row.criterion === criterion && row.repository === repository && row.adapter === adapter)) {
      issues.push(`required coverage ${criterion} ${repository} ${adapter} missing`);
    }
  }
  if (report?.status !== gateStatusFromAdapters(adapters)) issues.push('runtime gate status disagrees with adapters aggregate');
  if (report?.status !== 'passed' && report?.status !== 'not_applicable') issues.push('runtime gate is not passed');
  return issues;
}
