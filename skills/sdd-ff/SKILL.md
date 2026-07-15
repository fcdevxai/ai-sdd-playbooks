---
name: sdd-ff
description: "DEPRECATED in SDD 2.0. Do not use. This skill only prints a deprecation notice; it does not plan tasks. The 2.0 lifecycle splits planning into sdd-design (when required) and sdd-plan. Run 'sdd next' to determine the applicable step."
lifecycle_stage: null
produces: []
requires: {}
version: 2.0.0
deprecated: true
---

## Purpose

`sdd-ff` is **deprecated** in SDD 2.0. It is intentionally **not** a silent alias
for `sdd-plan` (C-05): the 2.0 lifecycle separates design from planning, and
aliasing could skip a required design step.

## Behavior

Print exactly this notice and stop. Do **not** generate `tasks.md`. Do **not**
run `sdd-plan`.

```
sdd-ff is deprecated in SDD 2.0.
The equivalent lifecycle is:
  1. sdd-design, when required
  2. sdd-plan
Run `sdd next` to determine the applicable step.
```

Then invoke `sdd next` (or tell the user to) so the CLI decides the correct next
step for the current change.

## Rules

- Never execute `sdd-plan` from here.
- Never produce `tasks.md`.
- The original 1.x single-command behavior survives only in the frozen
  `playbooks/sdd-ff/` (legacy) for un-migrated consumers — not here.
