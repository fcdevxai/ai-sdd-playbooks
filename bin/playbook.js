#!/usr/bin/env node
import { run, EXIT } from '../src/cli/dispatch.js';

try {
  const code = await run(process.argv.slice(2));
  process.exitCode = code;
} catch (err) {
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = EXIT.ENVIRONMENT;
}
