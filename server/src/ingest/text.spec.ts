import { htmlToText, makeSummary, makeTitle, truncateChars } from './text';

describe('htmlToText', () => {
  it('태그·스크립트를 제거하고 엔티티를 디코딩함', () => {
    expect(htmlToText('<p>Hello&nbsp;<b>World</b> &amp; 카프카</p><script>alert(1)</script>')).toBe(
      'Hello World & 카프카',
    );
  });

  it('이스케이프된 HTML은 그대로 텍스트로 남김', () => {
    expect(htmlToText('a &lt;script&gt; b')).toBe('a <script> b');
  });
});

describe('truncateChars', () => {
  it('최대 길이 이하면 그대로 반환', () => {
    expect(truncateChars('짧은 글', 300)).toBe('짧은 글');
  });

  it('잘리면 말줄임표 포함 최대 길이를 넘지 않음', () => {
    const text = '가나다 '.repeat(200);
    const result = truncateChars(text, 300);
    expect(Array.from(result).length).toBeLessThanOrEqual(300);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toMatch(/\s…$/);
  });

  it('이모지를 코드 포인트 단위로 셈', () => {
    const result = truncateChars('😀'.repeat(400), 300);
    expect(Array.from(result)).toHaveLength(300);
  });
});

describe('makeSummary / makeTitle', () => {
  it('첫 번째로 비어 있지 않은 후보를 사용함', () => {
    expect(makeSummary('', '  ', '<p>본문</p>')).toBe('본문');
    expect(makeSummary(null, undefined)).toBeNull();
  });

  it('제목은 HTML을 제거함', () => {
    expect(makeTitle('<em>제목</em> &amp; 부제')).toBe('제목 & 부제');
    expect(makeTitle('   ')).toBeNull();
  });
});
