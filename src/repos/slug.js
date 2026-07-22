/**
 * Change-id (ticket slug) safety guard, shared by every multi-repo module
 * that resolves `changesDir + slug` into a path. A slug is a folder name,
 * never a path — this rejects anything that could escape openspec/changes/.
 */
export function isSafeSlug(slug) {
  return (
    typeof slug === 'string' &&
    slug.length > 0 &&
    slug !== '.' &&
    slug !== '..' &&
    !slug.includes('/') &&
    !slug.includes('\\')
  );
}

export function assertSafeSlug(slug) {
  if (!isSafeSlug(slug)) throw new Error(`Invalid change slug: "${slug}"`);
}
