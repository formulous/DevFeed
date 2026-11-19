import { describe, expect, it } from 'vitest';
import { splitHighlight } from '@/lib/highlight';

describe('splitHighlight', () => {
  it('검색어 일치 구간을 표시함', () => {
    expect(splitHighlight('카프카 컨슈머 리밸런싱이 문제', '리밸런싱')).toEqual([
      { text: '카프카 컨슈머 ', match: false },
      { text: '리밸런싱', match: true },
      { text: '이 문제', match: false },
    ]);
  });

  it('여러 토큰과 대소문자를 처리함', () => {
    const segs = splitHighlight('React and react', 'REACT and');
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual(['React', 'and', 'react']);
  });

  it('정규식 특수문자를 그대로 검색함', () => {
    expect(splitHighlight('a.b axb', 'a.b')).toEqual([
      { text: 'a.b', match: true },
      { text: ' axb', match: false },
    ]);
  });

  it('HTML 문자열도 텍스트로만 분리함', () => {
    const segs = splitHighlight('<img src=x onerror=alert(1)> kafka', 'kafka');
    expect(segs[0]).toEqual({ text: '<img src=x onerror=alert(1)> ', match: false });
  });

  it('빈 검색어면 원문 하나를 반환함', () => {
    expect(splitHighlight('text', '  ')).toEqual([{ text: 'text', match: false }]);
  });
});
