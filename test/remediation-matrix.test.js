import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { gatedFixture, DELIVERY, evidence, cli } from './helpers/evidence-fixture.js';
import { inspectEvidence } from '../src/lifecycle/eligibility.js';
import { writeHandoffManifest } from '../src/tokens/handoff.js';
import { loadConfig } from '../src/config/config.js';
import { loadChange } from '../src/config/artifacts.js';
import matter from '../src/util/frontmatter.js';
const require = createRequire(new URL('../package.json', import.meta.url));
const yaml = require('js-yaml');

const edit = (file, change) => { const parsed = matter(fs.readFileSync(file, 'utf8')); change(parsed.data); fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data)); };

test('29: invalid required security fields and schema version cannot remain eligible', async () => {
  const variants = [
    ['missing-risk', data => { delete data.risk; }],
    ['missing-schema-version', data => { delete data.schema_version; }],
    ['wrong-schema-type', data => { data.schema = 'code-review-report'; delete data.risk; }],
  ];
  const failures = [];
  for (const [name, mutate] of variants) {
    const state = await gatedFixture({ tamper: ({ change }) => edit(path.join(change, 'security-report.md'), mutate) });
    const assessed = evidence(state.cwd, state.change, DELIVERY.uncommitted).gates['security-report.md'];
    const ordinary = await cli(['validate', 'demo', '--cwd', state.cwd, '--json']);
    const status = await cli(['status', 'demo', '--cwd', state.cwd, '--json']);
    console.log(JSON.stringify({ issue: 29, name, gate: assessed, validation_exit: ordinary.code, status_exit: status.code }));
    if (assessed.ok) failures.push(name);
  }
  assert.deepEqual(failures, []);
});

test('34: absent own config is distinct from malformed, wrong-shape or unreadable present config', async () => {
  const cases = [
    ['absent', null, true],
    ['malformed', 'version: 2\ncapabilities: [\n  browser: true\n', false],
    ['invalid-capabilities', 'version: 2\ncapabilities: [browser]\n', false],
    ['directory-at-config-path', 'directory', false],
  ];
  const failures = [];
  for (const [name, content, expected] of cases) {
    const service = fs.mkdtempSync(path.join(os.tmpdir(), 'review9-own-config-'));
    const git = (...args) => execFileSync('git', args, { cwd: service, stdio: ['ignore', 'pipe', 'pipe'] });
    git('init', '-q', '-b', 'demo'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
    // Create valid gates first; corrupt the authoritative config afterwards.
    if (content !== null) fs.writeFileSync(path.join(service, 'playbook.config.yaml'), 'version: 2\ncapabilities: {browser: false, http: false, cli: false, worker: false}\n');
    fs.writeFileSync(path.join(service, 'README.md'), 'service\n'); git('add', '-A'); git('commit', '-qm', 'service');
    const state = await gatedFixture({ prepare: ({ cwd, change }) => {
      const config = path.join(cwd, 'playbook.config.yaml'), data = yaml.load(fs.readFileSync(config, 'utf8'));
      data.repos.service = { path: service, capabilities: { browser: false, http: false, cli: false, worker: false } };
      fs.writeFileSync(config, yaml.dump(data));
      const proposal = path.join(change, 'proposal.md');
      fs.writeFileSync(proposal, fs.readFileSync(proposal, 'utf8').replace('## Impacted repos\n- hub', '## Impacted repos\n- hub\n- service'));
    } });
    if (content === 'directory') { fs.unlinkSync(path.join(service, 'playbook.config.yaml')); fs.mkdirSync(path.join(service, 'playbook.config.yaml')); fs.writeFileSync(path.join(service, 'playbook.config.yaml', 'x'), 'x'); }
    else if (content !== null) fs.writeFileSync(path.join(service, 'playbook.config.yaml'), content);
    writeHandoffManifest('demo', { cwd: state.cwd, stage: 'sdd-apply', agent: 'Fixture' });
    const result = inspectEvidence('demo', { cwd: state.cwd, config: loadConfig({ cwd: state.cwd }).config,
      artifacts: loadChange(state.change).artifacts, delivery: DELIVERY.uncommitted });
    const runtime = result.gates['runtime-gate-report.md'];
    console.log(JSON.stringify({ issue: 34, name, runtime }));
    if (!expected) assert.match(runtime.issues.join(' '), /invalid own capability configuration/);
    if (runtime.ok !== expected) failures.push(name);
  }
  assert.deepEqual(failures, []);
});
