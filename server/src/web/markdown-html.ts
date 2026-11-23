import { Marked, type Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { escapeHtml } from './html';

export const ALLOWED_TAGS = [
  'p', 'h2', 'h3', 'h4', 'strong', 'em', 'del', 'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'code', 'pre', 'span', 'hr', 'br',
];

const SAFE_URL = /^https?:\/\//i;

const marked = new Marked({
  gfm: true,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    image({ text }: Tokens.Image) {
      const alt = text.trim();
      return escapeHtml(`[이미지${alt ? `: ${alt}` : ''}]`);
    },
  },
});

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'rel', 'target'], code: ['class'], th: ['align'], td: ['align'] },
  allowedClasses: { code: ['language-*'] },
  allowedSchemes: ['http', 'https'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    h1: 'h2',
    h5: 'h4',
    h6: 'h4',
    a: (_tag, attribs) => {
      const href = (attribs.href ?? '').trim();
      if (!SAFE_URL.test(href)) return { tagName: 'span', attribs: {} as sanitizeHtml.Attributes };
      return { tagName: 'a', attribs: { href, target: '_blank', rel: 'nofollow ugc noopener noreferrer' } };
    },
  },
};

export function markdownToSafeHtml(source: string): string {
  const raw = marked.parse(source, { async: false });
  return sanitizeHtml(raw, SANITIZE);
}
