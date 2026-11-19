export const MAX_TAGS_PER_POST = 5;

export interface TagDefinition {
  id: number;
  name: string;
  synonyms: string[];
}

interface CompiledTerm {
  tagId: number;
  term: string;
  ascii: boolean;
}

export interface TagMatch {
  tagId: number;
  rank: number;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

function isAsciiTerm(term: string): boolean {
  return /^[\x00-\x7f]+$/.test(term);
}

export class TagDictionary {
  private readonly terms: CompiledTerm[];

  constructor(tags: TagDefinition[]) {
    const seen = new Set<string>();
    this.terms = [];
    for (const tag of tags) {
      for (const raw of [tag.name, ...tag.synonyms]) {
        const term = normalize(raw).trim();
        if (!term || seen.has(`${tag.id}:${term}`)) continue;
        seen.add(`${tag.id}:${term}`);
        this.terms.push({ tagId: tag.id, term, ascii: isAsciiTerm(term) });
      }
    }
    this.terms.sort((a, b) => b.term.length - a.term.length);
  }

  get size(): number {
    return this.terms.length;
  }

  private firstPosition(text: string, term: CompiledTerm): number {
    let from = 0;
    while (from <= text.length) {
      const index = text.indexOf(term.term, from);
      if (index < 0) return -1;
      if (!term.ascii) return index;
      const before = index > 0 ? text[index - 1] : '';
      const after = text[index + term.term.length] ?? '';
      const startsWithWord = WORD_CHAR.test(term.term[0]);
      const endsWithWord = WORD_CHAR.test(term.term[term.term.length - 1]);
      const okBefore = !startsWithWord || !before || !/[a-z0-9]/.test(before);
      const okAfter = !endsWithWord || !after || !/[a-z0-9]/.test(after);
      if (okBefore && okAfter) return index;
      from = index + 1;
    }
    return -1;
  }

  private matchIn(text: string): Map<number, number> {
    const found = new Map<number, number>();
    if (!text) return found;
    const normalized = normalize(text);
    for (const term of this.terms) {
      const position = this.firstPosition(normalized, term);
      if (position < 0) continue;
      const previous = found.get(term.tagId);
      if (previous === undefined || position < previous) found.set(term.tagId, position);
    }
    return found;
  }

  extract(input: { title: string; summary?: string | null; categories?: string[] }): TagMatch[] {
    const ordered: number[] = [];
    const push = (matches: Map<number, number>) => {
      const sorted = [...matches.entries()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      for (const [tagId] of sorted) if (!ordered.includes(tagId)) ordered.push(tagId);
    };
    push(this.matchIn(input.title));
    const categoryMatches = new Map<number, number>();
    (input.categories ?? []).forEach((category, index) => {
      for (const [tagId] of this.matchIn(category)) {
        if (!categoryMatches.has(tagId)) categoryMatches.set(tagId, index);
      }
    });
    push(categoryMatches);
    push(this.matchIn(input.summary ?? ''));
    return ordered.slice(0, MAX_TAGS_PER_POST).map((tagId, index) => ({ tagId, rank: index + 1 }));
  }
}
