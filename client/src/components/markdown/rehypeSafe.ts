import { createLowlight } from 'lowlight';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import type { Element, ElementContent, Root, RootContent, Text } from 'hast';

const lowlight = createLowlight({
  bash, c, cpp, css, diff, dockerfile, go, java, javascript, json, kotlin, python, rust, sql, typescript, xml, yaml,
});
lowlight.registerAlias({ bash: ['shell', 'zsh', 'console'], javascript: ['jsx'], typescript: ['tsx'], xml: ['html'] });

export const SAFE_PROTOCOL = /^https?:\/\//i;

export function safeUrl(url: string) {
  return SAFE_PROTOCOL.test(url.trim()) ? url : '';
}

const HEADING: Record<string, string> = { h1: 'h2', h5: 'h4', h6: 'h4' };

function textOf(node: ElementContent | RootContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

function languageOf(code: Element) {
  const cls = code.properties?.className;
  const list = Array.isArray(cls) ? cls.map(String) : [];
  const hit = list.find((c) => c.startsWith('language-'));
  return hit ? hit.slice('language-'.length).toLowerCase() : null;
}

function highlight(code: Element) {
  const lang = languageOf(code);
  if (!lang || !lowlight.registered(lang)) return;
  const tree = lowlight.highlight(lang, textOf(code));
  code.children = tree.children as ElementContent[];
  code.properties = { ...code.properties, className: ['hljs', `language-${lang}`] };
}

function imageText(node: Element): Text {
  const alt = typeof node.properties?.alt === 'string' ? node.properties.alt.trim() : '';
  return { type: 'text', value: `[이미지${alt ? `: ${alt}` : ''}]` };
}

function walk(parent: Root | Element) {
  parent.children = parent.children.map((child) => {
    if (child.type !== 'element') return child;
    if (child.tagName === 'img') return imageText(child);
    if (HEADING[child.tagName]) child.tagName = HEADING[child.tagName];
    if (child.tagName === 'pre') {
      const code = child.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
      if (code) highlight(code);
      return child;
    }
    walk(child);
    return child;
  }) as typeof parent.children;
}

export default function rehypeSafe() {
  return (tree: Root) => walk(tree);
}

export { textOf };
