/**
 * `postinstall` (design §3, ADR "postinstall message-only"). Message-only,
 * self-contained: no `src/` import, no filesystem write, no consumer-repo
 * read, no network. Anything that goes wrong here is swallowed — a broken
 * npm install must never be this package's fault.
 *
 * `.cjs` + `require`, not `.js` + `import`: this script must also run
 * correctly when copied out of this package (no local `package.json` to
 * resolve, no `"type": "module"` to lean on) — a `.js` file with a bare
 * `import` would hit a hard `SyntaxError` before the try/catch below ever
 * runs on engines without ESM-without-package.json detection (e.g. Node 18).
 * `.cjs` is always CommonJS regardless of any package.json's `"type"`.
 */
try {
  const fs = require('node:fs');
  const path = require('node:path');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  console.log(`playbook-ai ${pkg.version} installed.`);
  console.log('Run `playbook install` to (re)install the global Agent Skills.');
} catch {
  // Message-only: a failure here must never fail `npm install`.
}
