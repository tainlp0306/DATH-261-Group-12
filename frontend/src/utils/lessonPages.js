const wordsIn = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export const buildPages = (lesson) => {
  const storedPages = [...(lesson.pages || [])]
    .sort((left, right) => left.page_number - right.page_number)
    .map((page) => page.content)
    .filter(Boolean);
  if (storedPages.length) return storedPages;

  const content = lesson.content || '';
  const markedPages = content.split(/\s*\[\[PAGE\]\]\s*/).map((page) => page.trim()).filter(Boolean);
  if (markedPages.length > 1) return markedPages;
  if (!content.trim()) return [''];

  const sections = content.split(/\n\s*\n/).map((section) => section.trim()).filter(Boolean);
  const chunks = sections.flatMap((section) => {
    const words = section.split(/\s+/);
    const pieces = [];
    for (let index = 0; index < words.length; index += 180) {
      pieces.push(words.slice(index, index + 180).join(' '));
    }
    return pieces;
  });

  const pages = [];
  let current = [];
  let currentWords = 0;
  chunks.forEach((chunk) => {
    const count = wordsIn(chunk);
    if (current.length && currentWords + count > 220) {
      pages.push(current.join('\n\n'));
      current = [];
      currentWords = 0;
    }
    current.push(chunk);
    currentWords += count;
  });
  if (current.length) pages.push(current.join('\n\n'));
  return pages.length ? pages : [''];
};
