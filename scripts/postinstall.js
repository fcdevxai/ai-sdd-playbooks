/**
 * `postinstall` (design §3, ADR "postinstall message-only"). Message-only,
 * self-contained: no `src/` import, no filesystem write, no consumer-repo
 * read, no network. Anything that goes wrong here is swallowed — a broken
 * npm install must never be this package's fault.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  console.log(`playbook-ai ${pkg.version} installed.`);
  console.log('Run `playbook install` to (re)install the global Agent Skills.');
} catch {
  // Message-only: a failure here must never fail `npm install`.
}
