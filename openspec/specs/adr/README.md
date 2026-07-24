# ADR Index

Architecture Decision Records: they document the context, alternatives, and trade-offs behind hard-to-reverse decisions.

| # | Title | Status | Date | Originating change |
|---|---|---|---|---|
| ADR-001 | Adoptar Architecture Decision Records en el ciclo SDD | accepted | 2026-07-02 | adr-decision-records |
| ADR-002 | Distribuir specloom como dependencia git privada, no como registro npm ni como repo clonado | accepted | 2026-07-03 | npm-package-distribution |
| ADR-003 | Los playbooks de specloom son fijos, sin mecanismo de customización por proyecto consumidor | accepted | 2026-07-03 | npm-package-distribution |
| ADR-004 | Los required status checks nunca filtran con `on.paths`; el filtrado de paths vive dentro del job | accepted | 2026-07-03 | spec-lint-required-check |
| ADR-005 | Modelo de ownership de templates — managed vs consumer-owned | accepted | 2026-07-03 | template-drift-detection |
| ADR-006 | El postinstall de specloom es message-only — nunca lee, escribe, conecta ni falla | accepted | 2026-07-03 | template-drift-detection |
| ADR-007 | `loom run` no comprime salida en su primera versión — full passthrough + log a disco | superseded by ADR-009 | 2026-07-03 | loom-run-usage-telemetry |
| ADR-008 | Schema de `usage.json` y convención `.specloom/runs/<run-id>/` como base de telemetría | accepted | 2026-07-03 | loom-run-usage-telemetry |
| ADR-009 | La compactación pasa a ser el comportamiento default de `loom run` | accepted | 2026-07-03 | loom-run-compaction |
| ADR-010 | context-packet.md como artefacto intermedio generado en sdd-ff y consumido por gates, commit y verify | accepted | 2026-07-03 | context-packet |
| ADR-011 | Topes numéricos de reintento con stop/report, y comandos independientes del cwd, como convención de playbook | accepted | 2026-07-04 | retry-caps-cwd-safety |
| ADR-012 | Spec index establishes section-first reads for permanent specs | accepted | 2026-07-04 | spec-index-section-reads |
| ADR-013 | Agent Skills Default Render | accepted | 2026-07-05 | catalog-kernel-token-reduction |
| ADR-014 | Short Semantic Skill Descriptions | accepted | 2026-07-05 | catalog-kernel-token-reduction |
| ADR-015 | Repos impactados declarados en `proposal.md` | accepted | 2026-07-05 | cross-repo-gate-check |
| ADR-016 | `loom gate-check` como comando standalone | accepted | 2026-07-05 | cross-repo-gate-check |
| ADR-017 | Verificación local desde `config.yaml` | accepted | 2026-07-05 | cross-repo-gate-check |
| ADR-018 | IDs estables para criterios (AC-N / EC-N / SEC-N) | accepted | 2026-07-05 | token-audit-quick-wins |
| ADR-019 | Context packet generado por CLI con frescura verificable por hash | accepted | 2026-07-06 | loom-packet-command |
| ADR-020 | config.yaml `repos` como sustrato de ejecución multi-repo | accepted | 2026-07-06 | loom-cli-helpers |
| ADR-021 | `loom adr promote` como ejecutor canónico de la promoción de ADRs | accepted | 2026-07-06 | loom-adr-promote |
| ADR-022 | CLI fallback structured output for agent workflows | accepted | 2026-07-08 | resilient-changed-files-fallback |
| ADR-023 | la CLI planifica multi-repo; `prepare-repos` es el único mutador (solo branches) | accepted | 2026-07-08 | multi-repo-commit-orchestration |
| ADR-024 | repo SDD explícito en `config.yaml` + campos `default_base` y `protected_paths` | accepted | 2026-07-08 | multi-repo-commit-orchestration |
| ADR-025 | `## Files touched` agrupado por nombre lógico repo-relativo como fuente del mapeo archivo→repo | accepted | 2026-07-08 | multi-repo-commit-orchestration |
| ADR-026 | Fusión de ai-sdd-playbooks y specloom en playbook-ai; herencia de ADRs y retención de `.specloom/` | accepted | 2026-07-23 | restore-specloom-provenance |
| ADR-027 | Reducción "eslabón más débil" para delivery multi-repo | accepted | 2026-07-23 | multi-repo-delivery-aggregation |
| ADR-028 | Stateful bootstrap skills treat existing config as a diff baseline, not a completion signal | accepted | 2026-07-23 | bootstrap-repos-diff-on-rerun |
| ADR-029 | Skills invoke capabilities through `playbook` commands, never through internal source references | accepted | 2026-07-24 | cli-detect-siblings |
| ADR-030 | The canonical API contract is authored during `sdd-design`, under human sign-off | accepted | 2026-07-24 | contract-first-authoring |
