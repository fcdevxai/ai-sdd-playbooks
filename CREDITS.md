# Credits

`playbook-ai` is the unification of two sibling Spec-Driven Development
frameworks:

- **ai-sdd-playbooks** — the deterministic two-dimension lifecycle engine,
  JSON-Schema validation, capability-driven runtime gate, and multi-runtime
  install model.
- **specloom** — multi-repo orchestration, Architecture Decision Records,
  token-efficiency tooling (context packets, compacted verification runs,
  section-first spec reads), and end-to-end traceable security.

The Architecture Decision Records `ADR-001` through `ADR-025` under
`openspec/specs/adr/` were authored in specloom and are inherited here
**verbatim and immutable**. File paths they cite (e.g. `framework/cli/lib.js`,
`loom`) refer to specloom's layout; the equivalent modules in playbook-ai live
under `src/` (multi-repo → `src/repos/`, tokens → `src/tokens/`, ADRs →
`src/adr/`). The runtime directory `.specloom/` retains specloom's name by
decision.

See `openspec/specs/adr/ADR-026-fusion-playbook-ai.md` for the fusion decision
record.
