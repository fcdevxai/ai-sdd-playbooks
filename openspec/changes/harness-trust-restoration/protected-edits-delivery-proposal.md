# Proposal — separate delivery of the three protected pre-existing edits

Status: proposal only. It authorizes no staging, commit, push or merge. Decision date for the strategy: 2026-10-07 (user approved delivering these edits apart from the harness change).

## What the edits are

Three uncommitted modifications of the methodology checkout predate this change and are not part of it:

| File | Lines | Purpose |
|---|---|---|
| `src/repos/classify.js` | +11 / -2 | `classifyRepoFiles` takes `allowedPermanentSpecs`; an exact configured canonical contract path is no longer reported as a protected permanent-spec staging violation. |
| `src/repos/plan.js` | +25 / -2 | `buildRepoPlan` reads `contract.path_in_loom` and passes it as the only allowed permanent spec for the SDD repository. |
| `test/repos.test.js` | +36 | Two tests: the guard allows only the exact canonical contract, and `buildRepoPlan` treats the configured contract as a candidate in the SDD repo. |

Provenance: untracked by any commit; HEAD of these files dates from the specloom unification (Felipe Campos, July 2026). A reversible patch of exactly these bytes is kept privately at `/home/ubuntu/.local/share/playbook/evidence/harness-trust-restoration/review-remediation-20261007/round2/protected-edits.patch` (it reverse-applies cleanly to the working tree). Current SHA-256 prefixes: classify.js a6f864d4, plan.js 4164e8eb, repos.test.js ccb6807e.

## Is it an autonomous change?

Yes, with evidence:

- Its only production consumer is `src/repos/plan.js`; no file of the harness work imports `classify.js` or `plan.js`, and the harness files do not import anything the edits change.
- `node --test test/repos.test.js` passes 46/46 on the current checkout; the harness-specific test files do not depend on the two new repos tests.
- It is a distinct capability (contract-first staging guard), unrelated to evidence capture, handoffs, bindings, lifecycle or CI.
- Open dependency to confirm with the author: whether it needs its own SDD change, proposal and tests/documentation (the repository's `contract.path_in_loom` feature is already archived as `archive-contract-first-authoring`). It does not need anything from this harness change.

## Proposed delivery

- **Repository and base:** `ai-sdd-playbooks`, branched from `main` (tip 527448a, identical to the commit the harness branch is based on).
- **Branch name:** one that states the capability, for example `fix/repo-plan-allow-canonical-contract` (final name to be set by the author; the SDD convention of a change slug applies if it gets its own change).
- **Content:** exactly the three files above, the patch kept privately as the source of bytes, nothing else.
- **Verification before the PR:** `node --test test/repos.test.js` (46/46 today) and the complete `npm test` on the new branch; `npm run generate:check`.
- **PR:** separate from the harness PR, base `main`, description limited to the guard behavior and its two tests.
- **Remote action precondition:** confirm the active `gh` account matches the owner of the remote (`fcdevxai`) before any push; the push needs explicit authorization.

## Relationship to the harness change (decided before any gate is sealed)

The governed content of the harness gates must be the final one. Two ways keep it consistent; the first is recommended.

1. **Land the separate PR first (recommended).** After the three files are committed on their own branch and merged to `main`, rebase the harness branch onto the new `main`. The working tree then has no protected edits to carry, the governed content is final, and the harness gates are sealed on that state.
2. **Stack the harness branch on the separate branch.** The three files are tracked in the harness base, so they are no longer dirty, but the harness PR then depends on the other PR's merge order.

In both cases a change of the base or of governed content requires regenerating the handoffs and rerunning the review and gates on that exact state. Evidence sealed on a different snapshot is never rebound. Do not use stash, reset or rollback to remove the edits from the checkout.

## What still needs a user decision

Authorization to stage and commit those three files on the new branch, the branch name, whether to open the PR before or after the harness review, and which of the two relationship options to follow. Until then no delivery eligibility is claimed for the harness change.
