/**
 * Adversarial probes (receipt subsystem): a receipt must not prove more than the run observed
 * (design F04, "Source snapshots and freshness", Amendment R2). Each test asserts the SAFE behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { captureRun } from '../src/tokens/capture.js';
import { validateReceiptReference } from '../src/tokens/receipt.js';
import { sha256 } from '../src/tokens/evidence.js';
import { gatedFixture } from './helpers/evidence-fixture.js';

async function runWhileStale(mutateRelative, mutate) {
  const { cwd, change } = await gatedFixture();
  const file = path.join(cwd, mutateRelative);
  const original = fs.readFileSync(file);
  fs.writeFileSync(file, mutate(original.toString('utf8')));
  const captured = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'demo', step: 'runtime', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  fs.writeFileSync(file, original);
  const receipt = JSON.parse(fs.readFileSync(captured.receiptPath, 'utf8'));
  const source = matter(fs.readFileSync(path.join(change, 'runtime-gate-report.md'), 'utf8')).data.source_binding;
  const reference = { repository: 'hub', path: path.relative(cwd, captured.receiptPath), sha256: sha256(fs.readFileSync(captured.receiptPath)) };
  return { receipt, checked: validateReceiptReference(reference, { cwd, changeId: 'demo', stage: 'runtime', source }) };
}

test('AUD-R1: a receipt written while the normative plan differed from the manifest is not eligible evidence', async () => {
  const { receipt, checked } = await runWhileStale('openspec/changes/demo/tasks.md', (text) => `${text}\n## Extra normative step\n- run something else\n`);
  assert.equal(checked.ok, false,
    `receipt accepted; identity_issues=${JSON.stringify(receipt.identity_issues)}; normative_tasks_hash recorded=${receipt.artifacts.normative_tasks_hash}`);
});

test('AUD-R2: a receipt written while the approved proposal differed from the manifest is not eligible evidence', async () => {
  const { receipt, checked } = await runWhileStale('openspec/changes/demo/proposal.md', (text) => text.replace('- **AC-1:** works', '- **AC-1:** works differently'));
  assert.equal(checked.ok, false,
    `receipt accepted; identity_issues=${JSON.stringify(receipt.identity_issues)}; proposal_hash recorded=${receipt.artifacts.proposal_hash}`);
});

test('AUD-R3: sealing a gate refuses a receipt that recorded MANIFEST_STALE at execution time', async () => {
  const { sealReport } = await import('../src/tokens/seal.js');
  const { DELIVERY } = await import('./helpers/evidence-fixture.js');
  const { cwd } = await gatedFixture();
  const tasks = path.join(cwd, 'openspec/changes/demo/tasks.md');
  const original = fs.readFileSync(tasks);
  fs.writeFileSync(tasks, `${original}\n## Extra normative step\n- run something else\n`);
  const captured = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'demo', step: 'runtime', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  fs.writeFileSync(tasks, original);
  const receipt = JSON.parse(fs.readFileSync(captured.receiptPath, 'utf8'));
  assert.ok(receipt.identity_issues.includes('MANIFEST_STALE'));
  // An unsealed runtime report pointing at the new receipt (as a fresh gate run would write it).
  const reportPath = path.join(cwd, 'openspec/changes/demo/runtime-gate-report.md');
  const parsed = matter(fs.readFileSync(reportPath, 'utf8'));
  const ref = { repository: 'hub', path: path.relative(cwd, captured.receiptPath), sha256: sha256(fs.readFileSync(captured.receiptPath)) };
  const data = { ...parsed.data, adapters: { http: { status: 'passed', receipts: [ref] } }, coverage: [{ criterion: 'AC-1', repository: 'hub', adapter: 'http', receipt: ref }] };
  delete data.source_binding;
  fs.writeFileSync(reportPath, matter.stringify(parsed.content, data));
  assert.throws(() => sealReport('demo', 'runtime-gate-report.md', { cwd, receipts: [captured.receiptPath], delivery: DELIVERY.uncommitted }),
    /stale|ineligible|manifest/i);
});
