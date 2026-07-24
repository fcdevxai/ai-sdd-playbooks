---
schema: adr
status: proposed
date: "2026-07-24"
ticket: delivery-state-branch-independence
---

# ADR: A change's delivery state resolves by its own branch, never by the current one

## Context

`playbook status` reports two independent dimensions: **lifecycle** (computed from
local artifacts by a pure engine) and **delivery** (live from git + `gh`). The first
product principle in `openspec/specs/system.md` is that **the CLI is the authority on
state, never the language model** — every gate skill defers to `playbook
status`/`next`/`validate` rather than reasoning about state itself.

That authority is only worth deferring to if it answers the same question the same
way. It does not. `resolveDelivery` (`src/github/index.js`) takes `{cwd, runGit,
runGh}` — **no change identifier** — and resolves the pull request for whatever
branch git currently has checked out:

```js
const branch = currentBranch(git);
const pr = prForBranch(branch, gh);
if (!pr) return { provider: 'github', state: 'committed' };
```

So for one and the same merged change:

| Current branch | delivery | `playbook next` |
|---|---|---|
| the change's branch | `merged` | `sdd-verify` |
| `main`, clean tree | `committed` | `sdd-commit (push and open the pull request)` |

From `main`, `gh pr view main` finds no PR, so the CLI advises re-opening a pull
request for a change that is already merged. Observed three times across the
`contract-first-authoring` and `convention-drift-verify-commit` cycles — checking out
`main` after merging is the natural thing to do, and it is exactly what breaks the
answer.

The blast radius is bounded but lands on the worst moment: `computeNext` consults
delivery **only** when `lifecycle.state === 'runtime_cleared'`
(`src/lifecycle/engine.js`), which is precisely the post-merge, pre-verify window.

The change identifier is already in hand one layer up. `src/cli/status.js` calls
`resolveMultiRepoDelivery({ cwd, slug: change.changeId })`, and
`src/repos/delivery.js` uses that `slug` to read `## Impacted repos` — then calls
`resolveOne({ cwd })` without it. The information is not missing; it is dropped.

The forces in tension are about **how** a change's pull request should be identified:

- Every change already owns a branch named after its `change-id`: `sdd-new` creates
  `git checkout -b <change-id>`, and the `OWNER.md` template records
  `**Branch**: <change-id>`. The convention exists but nothing depends on it, so
  nothing enforces it either.
- The tempting alternative — record the PR number in the change folder when
  `sdd-commit` opens it — collides with a documented architecture constraint:
  `system.md` describes `src/github/` as "Live delivery state (git + `gh`), **never
  persisted**". Delivery is derived on every call precisely so it cannot go stale.
- `gh pr view <branch>` keeps resolving after the merge and after the local branch is
  deleted (verified: `gh pr view token-saving-parity` → `{"state":"MERGED"}`), so a
  branch name remains a usable key for the whole life of a change.

## Decision

A change's delivery state MUST be resolved from **that change's** branch, never from
whatever branch happens to be checked out. Normative rules:

1. **The change-id is the branch name.** `resolveDelivery` accepts an optional
   `slug`; when present it resolves the pull request and CI checks for the branch of
   that name. This promotes an existing convention (`sdd-new` creates the branch,
   `OWNER.md` records it) into a load-bearing contract.
2. **The current branch is a fallback, not the source of truth.** With no `slug`, the
   behavior is unchanged (`currentBranch`), so every existing caller and test keeps
   working. The fallback exists for callers with no change context, not as an
   alternative way to answer the same question.
3. **Nothing is persisted.** The pull request is looked up live on every call. The
   `slug` is an *input*, not stored state, so `system.md`'s "never persisted"
   constraint is preserved — and reinforced, since the rejected alternative was to
   store the PR reference.
4. **Every caller that knows the change must pass it.** `resolveMultiRepoDelivery`
   forwards its `slug` to `resolveOne`, in both the single-repo path and the per-repo
   fan-out — a sibling repo uses the same branch convention, so the same key works
   there.
5. **The slug is validated before it becomes a command argument.** It already travels
   to `gh` as an array element (no shell, so no command injection), but an
   unvalidated value has no business becoming a branch name. The check mirrors
   `isSafeSlug` in `src/tokens/packet.js`, which already guards its four call sites.
6. **Local tree state keeps its precedence.** A dirty working tree still short-circuits
   to `uncommitted` without consulting GitHub. That behavior is deliberate and pinned
   by a test ("dirty working tree → uncommitted (GitHub not consulted)"), and it keeps
   the CLI usable offline. See the accepted risk below.

## Consequences

### Positive
- `playbook status` and `playbook next` become branch-independent for a change, which
  is what makes "the CLI is the authority on state" true rather than aspirational.
- The fix is a thread-through of data that already exists at the call site, not a new
  mechanism: no persistence, no new state, no new failure mode.
- The change-id ↔ branch-name convention becomes enforced by something real. Before
  this, a change whose branch was named differently would have failed silently in a
  way nobody could see; now it fails visibly, as a wrong delivery state.
- The enforcement is a unit test that fails against the current code — a stronger
  gate than the content assertions the preceding wiring changes relied on, because it
  tests behavior rather than the presence of a sentence.

### Negative
- Elevates a convention to a contract. A change whose branch does not match its
  `change-id` now resolves to `committed` (no PR found for that name) instead of
  reading the current branch. Accepted: that is the correct answer for a change whose
  branch cannot be located, and the convention is already created and recorded by
  `sdd-new`.
- One more parameter on a function that had a deliberately small surface. Accepted:
  it is optional and the no-slug path is byte-identical.

### Risks
- **Accepted risk — the dirty-tree hole stays open.** With `lifecycle: runtime_cleared`,
  a merged PR, and any uncommitted file, delivery still reports `uncommitted` and
  `next` still suggests `sdd-commit`. Closing it would mean consulting GitHub before
  local state, which breaks a pinned test and forces a network call on the common
  path, degrading offline use. The residual case is one where the operator genuinely
  does have uncommitted work, so the advice is imperfect rather than absurd. Recorded
  in `docs/security-checklist.md` at archive time.
- A `slug` that names a branch belonging to a *different* change (a copy-paste error
  in a change folder name) would report that other change's delivery. Mitigated by
  the slug validation and by `change-id` being the folder name the engine already
  reads — the two cannot diverge without someone renaming the folder.

## Alternatives considered

### Persist the PR number in the change folder when `sdd-commit` opens it
Rejected. It would make the lookup explicit and independent of any naming convention,
but it directly contradicts `system.md`'s "Live delivery state (git + `gh`), never
persisted" — the property that keeps delivery from going stale when someone closes,
reopens, or re-targets a PR outside the tool. It also adds a new artifact field to
maintain, validate, and keep in sync. Paying an architectural constraint to avoid a
naming convention that already exists is the wrong trade.

### Make `playbook next` ignore delivery once the lifecycle is far enough along
Rejected as insufficient rather than wrong. `computeNext` already consults delivery
only at `runtime_cleared`, so narrowing it further would suppress the *symptom* — the
bad `next` — while `playbook status` kept reporting a false delivery state to every
human and skill that reads it. Hiding a wrong answer is not fixing it.

### Resolve the branch from git by matching remote branches against the change-id
Rejected. It reaches the same place as rule 1 through a slower, fuzzier path (listing
remote branches and pattern-matching), and it still depends on the change-id ↔ branch
convention — so it buys nothing over asking `gh` for the branch by name, which already
works post-merge and post-deletion.

## Impact

- backend: `resolveDelivery` gains an optional `slug`; `resolveMultiRepoDelivery` forwards it
- frontend: no impact
- security: slug validated before becoming a `gh` argument; nothing persisted (constraint reinforced)
- data: no impact — no artifact or schema change
- deployment: no impact
- testing: new unit tests, including one that fails against the current code; the pinned dirty-tree test stays untouched
