# SDD workflow

The methodology is global; this project keeps only its own context. Let the CLI
drive: run `sdd next` at any time to get the single next valid step.

## Lifecycle

```
sdd-enrich-us (pre-process)
  → sdd-new → [human approval]
  → sdd-design (when required) → sdd-plan
  → sdd-apply → sdd-code-review
  → sdd-security-gate (when required) → sdd-runtime-gate
  → sdd-commit → [CI] → [merge]
  → sdd-verify → sdd-archive
```

`sdd status` shows two dimensions: the methodological **lifecycle** and the
**GitHub delivery** state. `sdd next` combines them into one action.

## Rules

- Only a human sets `proposal.status: approved` (and `design.status: approved`).
- Machine-readable fields (status, impact, security, capabilities) stay in English.
- Never skip a gate; a blocking finding blocks the change until resolved.
