/**
 * Front matter is data, never code (design Amendment R5, rule 5). gray-matter evaluates
 * `---js` / `---javascript` front matter by default; every module reads artifacts through
 * this wrapper, which accepts only YAML and JSON and refuses any executable language.
 */
import grayMatter from 'gray-matter';

const refuse = () => {
  throw new Error('front matter must be YAML or JSON; executable front matter is refused');
};
const SAFE_ENGINES = { javascript: { parse: refuse, stringify: refuse }, js: { parse: refuse, stringify: refuse } };

export default function matter(input, options = {}) {
  const language = (options.language || options.lang || 'yaml').toLowerCase();
  if (!['yaml', 'yml', 'json'].includes(language)) refuse();
  return grayMatter(input, { ...options, engines: { ...(options.engines || {}), ...SAFE_ENGINES } });
}

matter.stringify = (file, data, options = {}) => grayMatter.stringify(file, data,
  { ...options, engines: { ...(options.engines || {}), ...SAFE_ENGINES } });
matter.test = (input, options) => grayMatter.test(input, options);
