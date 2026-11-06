const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ensp: ' ', emsp: ' ', thinsp: ' ', shy: '', middot: '·', bull: '•',
  hellip: '…', ndash: '–', mdash: '—', minus: '−',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  copy: '©', reg: '®', times: '×', laquo: '«', raquo: '»',
};

export function cleanText(text) {
  // Keep historical character forms, including CJK compatibility ideographs.
  return text
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f-\u009f\u200b\ufeff]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]*);/giu, (entity, name) => {
    if (!name.startsWith('#')) return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : entity;
    const hex = name[1].toLowerCase() === 'x';
    const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
      ? String.fromCodePoint(code)
      : '\ufffd';
  });
}

const TAG = /<\/?[a-z][\w:-]*(?:[^'"<>]|"[^"]*"|'[^']*')*>|<![^>]*>/giu;
const BLOCK = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'caption', 'dd', 'details', 'div', 'dl', 'dt',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'main', 'ol', 'p',
  'pre', 'section', 'summary', 'table', 'tbody', 'td', 'th', 'thead', 'tfoot', 'tr', 'ul',
]);

export function extractArticleHtml(html) {
  const content = html
    .replace(/<!--[\s\S]*?(?:-->|$)/gu, '')
    .replace(/<(script|style|template|noscript|head)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/giu, '');
  const main = /<main\b[^>]*>([\s\S]*?)<\/main\s*>/iu.exec(content);
  const body = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/iu.exec(content);
  const source = (main?.[1] ?? body?.[1] ?? content)
    .replace(/<(footer|nav)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '')
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure\s*>/giu, (figure) => {
      const caption = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption\s*>/iu.exec(figure);
      return caption && cleanText(decodeEntities(caption[1].replace(TAG, '')))
        ? figure.replace(/<img\b(?:[^'"<>]|"[^"]*"|'[^']*')*>/giu, '')
        : figure;
    });

  const paragraphs = [];
  let parts = [];
  let previous = 0;
  let imageAltParagraphs = 0;
  function flush() {
    const text = cleanText(decodeEntities(parts.join('')));
    if (text) paragraphs.push(text);
    parts = [];
  }
  for (const match of source.matchAll(TAG)) {
    const token = match[0];
    parts.push(source.slice(previous, match.index));
    previous = match.index + token.length;
    const name = /^<\/?([\w:-]+)/u.exec(token)?.[1].toLowerCase();
    if (BLOCK.has(name)) flush();
    if (name === 'img') {
      const alt = /\s+alt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu.exec(token);
      const label = cleanText(decodeEntities(alt?.[1] ?? alt?.[2] ?? alt?.[3] ?? ''));
      if (label && !/^(?:이미지|사진|image|photo|picture|img)(?:\s*\d+)?$/iu.test(label)) {
        flush();
        paragraphs.push(label);
        imageAltParagraphs++;
      }
    }
  }
  parts.push(source.slice(previous));
  flush();
  return {paragraphs, imageAltParagraphs};
}
