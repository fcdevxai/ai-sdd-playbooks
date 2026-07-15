/**
 * design-required predicate (design §4.4, C-03).
 *
 * `sdd-design` is required iff any `proposal.impact.*` is true, or the project
 * sets `design.always: true`. When false, no `design.md` is needed and the
 * engine computes `designed` directly (no file, no mutation).
 */
export function computeDesignRequired(proposalFrontmatter, config) {
  if (config && config.design && config.design.always === true) return true;
  const impact = (proposalFrontmatter && proposalFrontmatter.impact) || {};
  return Object.values(impact).some(Boolean);
}
