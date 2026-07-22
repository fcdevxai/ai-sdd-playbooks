/**
 * Shell-like command-string splitter — ported from specloom's `splitCommand`
 * (framework/cli/lib.js). Understands quotes and backslash-escapes; never
 * invokes a shell itself, just tokenizes a `verification:` command string into
 * argv for execFileSync/spawnSync.
 */
export function splitCommand(command) {
  const parts = [];
  let current = '';
  let quote = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === '\\') {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (escaping) current += '\\';
  if (quote) throw new Error(`Unable to parse verification command with unmatched quote: ${command}`);
  if (current) parts.push(current);
  if (parts.length === 0) throw new Error('Empty verification command');
  return parts;
}
