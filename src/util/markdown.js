/**
 * Markdown structural primitives — extracted once from specloom's
 * `framework/cli/lib.js` so validation, tokens (context-packet) and multi-repo
 * body-linting all share a single implementation instead of three copies.
 *
 * Pure: no filesystem, no network. Callers pass already-read file contents.
 */

export function markdownAnchor(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[`*_~()[\]{}:;'",.!?\\/]/g, '')
    .replace(/&/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Parses Markdown ATX headings, ignoring any headings inside fenced code blocks. */
export function parseMarkdownHeadings(content) {
  const lines = content.replace(/\n$/, '').split('\n');
  const headings = [];
  let fence = null;

  lines.forEach((line, index) => {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === marker) {
        fence = null;
      } else if (!fence) {
        fence = marker;
      }
      return;
    }
    if (fence) return;

    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!headingMatch) return;
    const title = headingMatch[2].trim();
    headings.push({
      level: headingMatch[1].length,
      title,
      anchor: markdownAnchor(title),
      lineStart: index + 1,
      lineEnd: lines.length,
    });
  });

  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i];
    const nextBoundary = headings.slice(i + 1).find((candidate) => candidate.level <= current.level);
    current.lineEnd = nextBoundary ? nextBoundary.lineStart - 1 : lines.length;
  }

  return headings;
}

/**
 * Pulls the byte-exact body of a `## <title>` (level-2) section out of a
 * markdown document. Returns null when the section is absent. The returned
 * text is a literal substring of the source (trimmed of surrounding blank
 * lines) — never re-serialized through a markdown/YAML round-trip that could
 * normalize whitespace.
 */
export function headingSection(content, title, level = 2) {
  const headings = parseMarkdownHeadings(content);
  const heading = headings.find((h) => h.level === level && h.title.toLowerCase() === title.toLowerCase());
  if (!heading) return null;
  return content
    .split('\n')
    .slice(heading.lineStart, heading.lineEnd)
    .join('\n')
    .trim();
}

/** Alias kept for call-site clarity where "verbatim" is the intent (ADR-010/019). */
export function verbatimSection(content, title) {
  return headingSection(content, title);
}

function splitByHeader(body, headerRe) {
  const sections = {};
  const lines = body.split('\n');
  let current = null;
  let buffer = [];
  for (const line of lines) {
    const match = line.match(headerRe);
    if (match) {
      if (current !== null) sections[current] = buffer.join('\n').trim();
      current = match[1].trim();
      buffer = [];
    } else if (current !== null) {
      buffer.push(line);
    }
  }
  if (current !== null) sections[current] = buffer.join('\n').trim();
  return sections;
}

/** Maps `## Title` → body text (H2 sections, e.g. a proposal.md's top-level sections). */
export function splitSections(body) {
  return splitByHeader(body, /^##\s+(.+)$/);
}

/** Maps `### Title` → body text (H3 sub-sections, e.g. an ADR's Consequences). */
export function splitSubSections(body) {
  return splitByHeader(body, /^###\s+(.+)$/);
}

/**
 * A section counts as "empty" once its own HTML-comment placeholder (the only
 * kind of placeholder the scaffolded templates use) is stripped. There is no
 * generic bracket-based heuristic here on purpose — matching arbitrary
 * "<...>"/"[...]" content false-flags legitimate one-line prose like
 * "[See design.md for details]".
 */
export function isEmpty(content) {
  if (!content) return true;
  const stripped = content.replace(/<!--.*?-->/gs, '').trim();
  return !stripped;
}

/**
 * Tolerantly pulls every backtick-quoted token out of the lines whose label
 * matches labelRe (e.g. "Files to create/modify", "Validation command(s)").
 * Falls back to comma-splitting plain text when a matched line has no
 * backticks. De-duplicated, first occurrence wins — deterministic output.
 */
export function extractLabeledTokens(content, labelRe) {
  const tokens = [];
  for (const line of content.split('\n')) {
    const match = line.match(labelRe);
    if (!match) continue;
    const rest = match[1];
    const ticked = [...rest.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
    if (ticked.length > 0) {
      tokens.push(...ticked);
    } else {
      rest
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => tokens.push(s));
    }
  }
  return [...new Set(tokens)];
}
