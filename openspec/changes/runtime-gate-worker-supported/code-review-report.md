---
schema: code-review-report
schema_version: 1
change_id: runtime-gate-worker-supported
status: passed
created: 2026-09-01
updated: 2026-09-01
---
# Code Review Report — Adapter `worker` de sdd-runtime-gate: de experimental a supported

## Scope reviewed

Ten files, all inside the scope declared by `proposal.md` and `design.md`:

| File | Change |
|---|---|
| `src/adapters/worker.js` | `support: 'experimental'` → `'supported'`; `validates` list rewritten |
| `test/adapters.test.js` | Worker expectation flipped; `cli` blocked test split out |
| `test/skill-contract.test.js` | New positive (worker checklist + SEC-001) and negative (no "worker is experimental") assertions |
| `test/worker-adapter-propagation.test.js` | New file — AC-8 content guard over README/template/bootstrap skill |
| `skills/sdd-runtime-gate/canonical.md` + `SKILL.md` | `### cli / worker (experimental)` split into `### worker (supported)` (7-point checklist, `failed`/`blocked` criteria, SEC-001) and `### cli (experimental)`; selection table and `## Rules` narrowed to `cli`; note added that `worker` has no runtime-tool dependency |
| `skills/sdd-bootstrap-project/canonical.md` + `SKILL.md` | "`cli`/`worker` are experimental adapters" → `cli` only |
| `README.md`, `templates/project/playbook.config.yaml` | Comment for `worker:` updated to `supported` |

`src/adapters/cli.js` was **not** touched, as `## Constraints and non-goals` requires.

## Checklist

- [passed] **AC-1** — `src/adapters/worker.js` reports `support: 'supported'`; asserted in `test/adapters.test.js:9`.
- [passed] **AC-2** — `planRuntimeAdapters({ worker: true, cli: false })` returns exactly `{ status: 'pending' }` (`deepEqual`, so no `reason_code` leaks); `test/adapters.test.js:27-31`.
- [passed] **AC-3** — reachability of a passing gate with `worker` relevant. Covered by composition (`plan.worker → pending` plus the adapter-agnostic `gateStatusFromAdapters` aggregation tests) and by the schema, which permits `adapters.worker.status: passed`. Re-verified live during this review: `planRuntimeAdapters({worker:true},['worker']).worker` → `{"status":"pending"}` and `gateStatusFromAdapters({worker:{status:'passed'}})` → `passed`. See Issue 1 for the missing single-assertion test.
- [passed] **AC-4** — `skills/sdd-runtime-gate/canonical.md` documents the real-evidence checklist, the `failed` criteria, the `blocked` criteria (`DEPENDENCY_UNAVAILABLE` / `INSUFFICIENT_EVIDENCE` — both present in `REASON_CODES`), and SEC-001. `npm run generate` produced no drift (working tree unchanged after re-running it) and `npm run generate:check` exits 0.
- [passed] **AC-5** — the old "worker always blocked" test is gone, and the new tests are genuinely red against the pre-change code. Verified in this review by restoring `HEAD`'s `src/adapters/worker.js`: `# fail 2` — `adapter support levels...` and `planRuntimeAdapters: supported worker with capability true → pending`. Working tree restored afterwards.
- [passed] **AC-6** — `cli` behavior unchanged. `src/adapters/cli.js` untouched; ADR-032 coverage preserved and slightly strengthened (`test/adapters.test.js:21-25` now also asserts `reason_code`), and `test/adapters.test.js:52-58` still exercises `cli: true` alongside `worker: true`.
- [passed] **AC-7** — `adr-worker-adapter-no-declared-dependency.md` present and schema-valid; documents the no-declared-dependency decision and its rejected alternatives. Consistent with `dependency: null` in the descriptor and with the new `## Runtime tool dependency` note in `canonical.md`.
- [passed] **AC-8** — repo-wide grep for `worker` + `experimental`/`ADAPTER_NOT_IMPLEMENTED` returns only the new guard regexes themselves. `openspec/specs/adr/ADR-032` and `openspec/specs/playbooks/spec.md` mention `worker` only as `not_applicable` because `capabilities.worker: false` — still accurate, no stale claim. The AC-8 guards are real: restoring the pre-change docs turns `test/worker-adapter-propagation.test.js` and both new `skill-contract` assertions red (`# fail 3`).
- [passed] **No changes outside allowed modules** — every changed file is named in `proposal.md` / `design.md`.
- [passed] **Conventions & quality gates** — `npm test`: 442 tests, 442 pass, 0 fail. `npm run generate:check`: exit 0. `node --check` on all four touched JS files: clean. No lint/format script exists in `package.json`, matching the packet's `(sin formatter configurado todavía)`.
- [passed] **SEC-001 coherence** — the safety rule lives in the distributed skill text (`canonical.md` step 6), which is where consumer projects read it. `playbook-ai` itself declares `capabilities.worker: false`, so no new sensitive surface is added here (SEC-002).

## Issues found

### Issue 1 — AC-3 has no single test that asserts the reachability it claims (low)

- **File**: `test/adapters.test.js:27`
- **Problem**: AC-3 states that a project with `worker: true` and complete real evidence can reach `runtime-gate-report.md` with `status: passed`. The Execution Report's evidence for AC-3 cites only `canonical.md` documentation. In code the property holds — I verified it live — but it holds by composing two separate tests (`worker → pending`, plus generic aggregation), and `test/adapters.test.js:71` covers only the *excluded*-worker path. If `gateStatusFromAdapters` ever grew adapter-specific handling, AC-3 would regress silently.
- **Suggested fix**: add the worker mirror of the existing line-71 test:
  ```js
  test('a change with worker relevant and evidenced can reach a passing gate (AC-3)', () => {
    const plan = planRuntimeAdapters({ browser: false, http: false, cli: false, worker: true }, ['worker']);
    assert.deepEqual(plan.worker, { status: 'pending' });
    assert.equal(gateStatusFromAdapters({ ...plan, worker: { status: 'passed' } }), 'passed');
  });
  ```

### Issue 2 — `validates` and the canonical checklist can drift apart unchecked (low)

- **File**: `src/adapters/worker.js:7-13`
- **Problem**: the five `validates` entries are a verbatim restatement of the five checklist headings in `skills/sdd-runtime-gate/canonical.md`. Nothing consumes `validates` at runtime and no test binds the two, so editing one and not the other is invisible to CI. This is pre-existing convention (`browser`/`http`/`cli` have the same unasserted field), so it is not a violation introduced here — only a place where this change doubled the surface that can drift.
- **Suggested fix**: optional, and arguably belongs to its own change: assert in `test/skill-contract.test.js` that every `ADAPTERS.worker.validates` entry appears in the `### \`worker\` (supported)` section, reusing the existing `headingSection` helper.

### Issue 3 — `context-packet.md` omits one file the proposal does list (informational)

- **File**: `openspec/changes/runtime-gate-worker-supported/context-packet.md` (`## Files touched`)
- **Problem**: the list names `skills/sdd-bootstrap-project/SKILL.md` but not its source `skills/sdd-bootstrap-project/canonical.md`, even though `proposal.md:69` and `design.md:64` both name the canonical file explicitly. A reviewer working from the packet alone would read the canonical edit as unplanned. It is **not** scope creep — editing the generated `SKILL.md` without its canonical source would be the actual violation.
- **Suggested fix**: none required for this change. The packet is CLI-derived (`playbook packet`) and its source hashes match the live `proposal.md`/`tasks.md` byte-for-byte, so the omission is in the extraction heuristic, not in the authored artifacts. Worth a separate look at `src/tokens/packet.js`'s files-touched extraction if it recurs.

## Notes on the guard regexes (no action)

The AC-8 guards are line-scoped regexes. `test/worker-adapter-propagation.test.js:18-20` will not catch a claim split across a sentence boundary ("`worker`. It is experimental"), and `test/skill-contract.test.js:205` will false-fail on a legitimate contrastive sentence ("unlike the experimental `cli`, `worker` is supported"). Both are acceptable trade-offs for a content guard and both are currently green with real red-first evidence; flagged only so a future editor knows why a harmless rewording might trip them.

## Verdict

`status: passed`. Every acceptance criterion has passing evidence, no file was changed outside the declared scope, `cli` is bit-for-bit untouched, and every executable quality gate in `tasks.md` was run and is green. The three issues above are non-blocking: Issue 1 is a test-coverage strengthening, Issue 2 is a pre-existing convention, Issue 3 is a packet-generation artifact with no effect on the delivered code.
