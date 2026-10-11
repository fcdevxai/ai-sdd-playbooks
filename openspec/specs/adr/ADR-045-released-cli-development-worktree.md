---
schema: adr
status: accepted
date: '2026-10-11'
ticket: bounded-review-loops
---

# ADR: The global CLI runs a released version, methodology development happens in a separate worktree, and `playbook doctor` warns when it does not

## Context

During the LIA Hub change `harness-trust-restoration`, the global `playbook` command pointed
at the checkout of this repository that was being changed. The code under review therefore
judged its own lifecycle gates, and it was hard to tell which version had produced which
evidence. The closure plan fixed this with stop rule RP-5: the global CLI always points at a
released checkout, and development happens in a separate worktree. ADR-042 already covers the
narrower case of a change to the gate code itself. Nothing in this repository writes the
general rule down, and nothing detects a global CLI that runs from a development tree.

The README also still showed an install command that points at a repository of a former
organization, which is not this project's source, while the CI templates install from
`github:fcdevxai/ai-sdd-playbooks`.

## Decision

1. **Released global CLI.** The global `playbook` command runs a released version: either
   installed from a release tag (`npm install -g github:fcdevxai/ai-sdd-playbooks#vX.Y.Z` or a
   `semver:` range), or a dedicated checkout detached at the release tag `vX.Y.Z` with no local
   changes. It never points at a development branch or a dirty tree.
2. **One worktree per methodology change.** Each change to this repository is developed in its
   own git worktree on the branch named after the change, created from `origin/main`. Its
   tests and its own CLI run from that worktree (`npm test`, `node bin/playbook.js`). The
   released global CLI runs the lifecycle against it. A change to the gate code itself still
   follows ADR-042.
3. **Release, then update.** A release is tagged on the merge commit in `main`. Moving the
   global CLI to the new tag is a separate step that needs a human go.
4. **`playbook doctor` warns.** `playbook doctor` adds an advisory warning when the running
   CLI's package root is a git checkout whose `HEAD` does not carry the tag `v<package
   version>`, or that has uncommitted changes. A package root that is not a git checkout (a
   package install) is not checked. The warning never changes `healthy` or the exit code.
5. **README.** The README install command points at `github:fcdevxai/ai-sdd-playbooks`, like
   the CI templates.

## Consequences

### Positive

- Code under development never judges its own gates through the global CLI.
- Drift is visible: `playbook doctor` names the checkout, its `HEAD` and the expected tag.
- The README and the templates agree on where to install from.

### Negative

- `playbook doctor` runs `git` for the first time, so it depends on `git` being available to
  report provenance (it degrades to a note when it is not).
- The warning is advisory and can be ignored.
- A package installed from a branch instead of a tag is not a git checkout, so it is not
  detected.

### Risks

- Running `doctor` from a development worktree shows the warning. This is correct by design
  (that CLI is not a release) and does not change the exit code.

## Alternatives considered

### Report it as a doctor problem (non-zero exit)

Rejected: every development run and the methodology's own CI would fail `doctor` while working
on a change.

### Detect the release from npm metadata

Rejected: npm does not keep stable, documented metadata about the git ref a global package was
installed from.

### Document the rule only

Rejected by the user on 2026-10-11: the rule needs a signal when it is broken.

## Impact

- backend: `src/cli/doctor.js` gains an advisory check that runs `git` read-only on the
  package root
- frontend: no impact
- security: `git` runs with a fixed argument array, no shell and a timeout, on a path derived
  from the module location; it only reads
- data: no impact
- deployment: methodology developers keep the global CLI on a release tag and develop in
  worktrees
- testing: unit tests for the advisory with an injected `git` runner; docs and README checked
  by content
