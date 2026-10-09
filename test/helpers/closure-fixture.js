/** A merged, verified change whose four gates were sealed as the CLI would, ready for closure. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { writeHandoffManifest, governedManifestHash } from '../../src/tokens/handoff.js';
import { sha256 } from '../../src/tokens/evidence.js';

export const merged = { state: 'merged', per_repo: [{ repo: 'hub', state: 'merged' }] };

export function fixture({ changeLocalReference = false, prepare = () => {} } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-retain-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
  git('init', '-q', '-b', 'example'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Fixture');
  const change = path.join(cwd, 'openspec/changes/example');
  fs.mkdirSync(change, { recursive: true }); fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'openspec/specs'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'), 'version: 2\ncapabilities: {browser: false, http: false, cli: true, worker: false}\nrepos: {hub: {role: sdd, path: ., capabilities: {browser: false, http: false, cli: true, worker: false}}}\n');
  fs.writeFileSync(path.join(cwd, 'openspec/specs/system.md'), '# System\n');
  fs.writeFileSync(path.join(cwd, 'docs/doc_architecture.md'), '# Architecture\n');
  fs.writeFileSync(path.join(change, 'proposal.md'), '---\nschema: proposal\nstatus: approved\nimpact: {architecture_boundary: true}\n---\n# Example\n## Impacted repos\n- hub\n## Acceptance criteria\n- **AC-1:** works\n## Security considerations\n- **SEC-1:** safe\n## Constraints and non-goals\nOnly fixture.\n');
  fs.writeFileSync(path.join(change, 'design.md'), '---\nschema: design\nstatus: approved\n---\n# Design\n');
  if (changeLocalReference) fs.writeFileSync(path.join(change, 'required-architecture.md'), '# Required architecture\n');
  fs.writeFileSync(path.join(change, 'tasks.md'), '---\nschema: tasks\nstatus: passed\nhandoff:\n  specs: []\n  architecture: ' + (changeLocalReference ? '[{repository: hub, path: openspec/changes/example/required-architecture.md}]' : '[]') + '\n  contracts: []\n  required_skills: []\n  required_tools: [{name: playbook, context: hub, purpose: lifecycle}]\n  runtime_coverage: [{criterion: AC-1, repositories: [hub], capabilities: [cli]}]\n  non_runtime: [{criterion: SEC-1, rationale: Security is checked by the substitute fixture test.}]\n  unresolved_risks: []\n  blockers: []\n---\n# Tasks\n- **Done**: [x]\n');
  prepare({ cwd, change, git });
  git('add', '.'); git('commit', '-qm', 'source');
  // Every gate is sealed as the CLI would: its own stage manifest, receipt and source binding.
  const seal = (stage, step, reportName, frontmatter) => {
    const { manifest, stagePath } = writeHandoffManifest('example', { cwd, stage, agent: 'Codex' });
    const runDir = path.join(cwd, `.specloom/runs/run-${step}`);
    fs.mkdirSync(runDir, { recursive: true });
    const raw = path.join(runDir, 'full.log'); fs.writeFileSync(raw, `1..1\nok 1 - synthetic ${step}\n`);
    const receipt = path.join(runDir, 'execution-receipt.json');
    const manifestHash = sha256(fs.readFileSync(path.join(change, 'handoff-manifest.json')));
    fs.writeFileSync(receipt, JSON.stringify({
      schema: 'execution-receipt', schema_version: 1, run_id: `run-${step}`, change_id: 'example', stage: step,
      repository: manifest.repositories[0],
      actor: { agent: 'Codex', provider: 'unknown', model: 'unknown', provenance: 'caller_declared', identity_issues: ['PROVIDER_UNAVAILABLE', 'MODEL_UNAVAILABLE'] },
      command: { argv: ['node', '--test'], cwd },
      environment: { platform: 'linux', runtime: 'node', container: 'unknown' },
      started_at: '2026-10-06T00:00:00.000Z', ended_at: '2026-10-06T00:00:01.000Z', exit_code: 0, summary: '1 test passed',
      raw: { full: { path: 'full.log', bytes: fs.statSync(raw).size, sha256: sha256(fs.readFileSync(raw)) } },
      manifest_hash: manifestHash,
      source_changed_during_run: false,
      artifacts: { proposal_hash: manifest.requirement.hash, tasks_hash: manifest.tasks.hash,
        normative_tasks_hash: manifest.tasks.normative_hash, contract_hashes: [] },
    }));
    const source_binding = {
      manifest_path: path.relative(cwd, stagePath),
      manifest_hash: manifestHash,
      governed_manifest_hash: governedManifestHash(manifest),
      repositories: manifest.repositories.map(({ name, branch, commit_sha, source_hash, tree_hash }) => ({ name, branch, commit_sha, source_hash, ...(tree_hash ? { tree_hash } : {}) })),
      proposal_hash: manifest.requirement.hash, design_hash: manifest.design.hash,
      normative_tasks_hash: manifest.tasks.normative_hash, contract_hashes: [],
      receipts: [{ repository: 'hub', path: `.specloom/runs/run-${step}/execution-receipt.json`, sha256: sha256(fs.readFileSync(receipt)) }],
      delivery_state: 'merged',
    };
    const body = reportName === 'verification-report.md'
      ? '# Report\n## Acceptance criteria\nAC-1 verified.\n## Security considerations\nSEC-1 verified.\n## Regression\nSynthetic fixture passed.\n'
      : '# Report\n';
    if (step === 'runtime') {
      frontmatter = { schema: 'runtime-gate-report', status: 'not_applicable',
        adapters: { cli: { status: 'not_applicable', reason_code: 'NOT_RELEVANT_TO_CHANGE',
          exclusion: { reason: 'Bounded experimental CLI substitute', authority: manifest.requirement,
            covered_criteria: ['AC-1'], substitute_receipts: source_binding.receipts } } },
        coverage: [{ criterion: 'AC-1', repository: 'hub', adapter: 'cli', receipt: source_binding.receipts[0] }] };
    }
    fs.writeFileSync(path.join(change, reportName), `---\n${yaml.dump({ status: 'passed', ...frontmatter, schema_version: 2, change_id: 'example', source_binding })}---\n${body}`);
    return { receipt, raw };
  };
  seal('sdd-code-review', 'review', 'code-review-report.md', { schema: 'code-review-report' });
  seal('sdd-security-gate', 'security', 'security-report.md', { schema: 'security-report', risk: 'low' });
  seal('sdd-runtime-gate', 'runtime', 'runtime-gate-report.md', { schema: 'runtime-gate-report' });
  const { receipt, raw } = seal('sdd-verify', 'verify', 'verification-report.md', { schema: 'verification-report' });
  return { cwd, change, rawDestination: fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-private-')), receipt, raw };
}
