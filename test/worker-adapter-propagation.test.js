import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function linesThatStillMakeWorkerExperimental(relativePath) {
  return read(relativePath)
    .split('\n')
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter(({ text }) => (
      /worker[^.;\n]*(experimental|ADAPTER_NOT_IMPLEMENTED)/i.test(text)
      || /(experimental adapters?|ADAPTER_NOT_IMPLEMENTED)[^.;\n]*worker/i.test(text)
      || /`cli`\/`worker`/i.test(text)
    ));
}

test('propagated docs/templates no longer classify worker as experimental (AC-8)', () => {
  const files = [
    'README.md',
    'templates/project/playbook.config.yaml',
    'skills/sdd-bootstrap-project/canonical.md',
    'skills/sdd-bootstrap-project/SKILL.md',
  ];

  const offenders = Object.fromEntries(
    files
      .map((file) => [file, linesThatStillMakeWorkerExperimental(file)])
      .filter(([, lines]) => lines.length > 0),
  );

  assert.deepEqual(offenders, {});
});
