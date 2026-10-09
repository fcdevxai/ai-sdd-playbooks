# F06 execution evidence — methodology

## Finding and ownership

F06 was reproduced before editing: `playbook run` converted child exit 7 to generic 1, hid successful test counts/warnings/skips, and truncated a 2,272,000-byte synthetic output to 1,114,112 bytes due to synchronous process buffering. This repository owns command capture, summaries, and retained run telemetry. Global Claude filtering and RTK integration are separately owned and tested in the LIA companion evidence.

## Structural correction

An isolated detached worktree at `/home/ubuntu/ai-sdd-playbooks-harness-worktree` was created from HEAD `527448a98ed85263328b04308d1fe2a5d8bef79f`. It contained a copy of the approved change artifacts and a link to the existing dependency tree. The globally installed CLI still resolved to the original checkout during development. Tested files were transferred individually to that canonical checkout only after the targeted and full tests passed and a clean-destination check found no overlapping user edits.

Changed canonical source: `bin/playbook.js`, `src/cli/dispatch.js`, `src/cli/run.js`, `src/tokens/run.js`, new `src/tokens/capture.js`, and `src/repos/gate-check.js`. Regressions: `test/tokens.test.js` and new `test/evidence-run.test.js`. The direct global CLI link now consumes these upstream files; no package version, Hub lock, generated skill, or installed skill content changed in this wave.

`playbook run` streams child stdout/stderr to private `stdout.raw` and `stderr.raw` files and a combined `full.log`, using bounded memory for the NORMAL summary. RAW forwards each original stream byte-for-byte. Per-stream hashes/byte counts and the actual child status are retained in `usage.json`. `gate-check` keeps its synchronous API while routing child output directly to a private combined file descriptor; its raw evidence no longer has a process buffer ceiling. `bin/playbook.js` sets `process.exitCode` so RAW output flushes. The dispatcher forwards child flags after `--` unchanged.

## Behavioral regression

The new test file was red before implementation: five tests exposed exit conversion, lost summary content, truncation, missing RAW mode, and child flag interception. A further gate-check regression reproduced a 2,300,000-byte failure being retained as only 146,176 bytes. These tests now pass. Targeted tests including the untouched `test/repos.test.js` passed: 94 tests. Full methodology suite in the isolated worktree passed: 455 tests. The same suite through the installed CLI in the original checkout passed: 457 tests. `npm run generate:check` passed; generation was not needed because F06 changed no canonical skill source. Changed JavaScript files passed `node --check`.

Synthetic cases include recognized assertion failure, unfamiliar failure with child exit 7, successful totals (12 tests/45 assertions), warning-only success, skipped/incomplete tests, >2.3 MB output on both streams, non-UTF-8 RAW output, argument injection text, child `--json`/`--help` after `--`, missing executable, long-line display bounds, and `gate-check` large failure. Raw byte/hash and file-mode assertions are part of the tests. The exact installed-suite log is `/home/ubuntu/ai-sdd-playbooks/.specloom/runs/1791310698956-9874bfc0-RoiuGN/full.log` (97,940 bytes, SHA-256 `6cf4c9df2fbff6bc1c02cb6de0c94ff1f6327ee6f324b8265e68ae20c86d9dea`, mode 0600); its `usage.json` is 1,331 bytes, SHA-256 `0ee5dcf387a6f2fbf799128cc6beb0dba24510ff642457620cf5d56aaf93335f`, mode 0600. These logs are private local runtime evidence, not closure retention. F04 must make required proof durable outside the disposable active change.

After propagation, the other identified installed consumer, `/home/ubuntu/eduassistant/playbook-sdd`, had no active changes and `playbook doctor --json` remained healthy. An all-home `rg` scan encountered one unrelated permission-denied database recovery directory; no claim is made that this scan proves there are no consumers elsewhere. The three protected preexisting methodology modifications retained their exact preflight SHA-256 values.

## Result and residual risk

F06 methodology command capture is behaviorally validated for the tested local CLI and synthetic evidence. Child exit codes now propagate; a capture failure is explicitly an evidence/environment failure rather than a pass. This does not establish the later F04 execution-receipt identity contract, nor actual fresh Claude runtime parity. The complete F06 scoped global-hook integration is documented in the LIA companion report. No merge, push or archive was performed.
