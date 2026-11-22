import { markdownExcerpt } from './markdown-excerpt';

describe('markdownExcerpt', () => {
  it('제목·강조·링크·이미지·인라인 코드·목록·인용 기호를 걷어냄', () => {
    const md = [
      '## 질문 제목',
      '',
      '**굵게** 와 *기울임* 그리고 `code` 와 ~~취소~~',
      '- 하나',
      '1. 둘',
      '> 인용',
      '[링크](https://a.test) ![그림](https://img.test/x.png)',
    ].join('\n');
    expect(markdownExcerpt(md)).toBe('질문 제목 굵게 와 기울임 그리고 code 와 취소 하나 둘 인용 링크 그림');
  });

  it('코드 블록은 통째로 빼고 HTML 태그는 지움', () => {
    const md = '앞\n```ts\nconst a = 1;\n```\n<script>alert(1)</script> 뒤';
    expect(markdownExcerpt(md)).toBe('앞 alert(1) 뒤');
  });

  it('닫히지 않은 코드 블록은 끝까지 뺌', () => {
    expect(markdownExcerpt('본문\n```\n코드만 계속')).toBe('본문');
  });

  it('주소에 괄호가 있는 링크도 글자만 남김', () => {
    expect(markdownExcerpt('[a](javascript:alert(1)) 끝')).toBe('a 끝');
  });

  it('표는 칸 글자만 남김', () => {
    expect(markdownExcerpt('| a | b |\n|---|:---:|\n| 1 | 2 |')).toBe('a b 1 2');
  });

  it('200자를 넘으면 말줄임표 포함 200자', () => {
    const out = markdownExcerpt('가'.repeat(300));
    expect([...out]).toHaveLength(200);
    expect(out.endsWith('…')).toBe(true);
  });

  it('이모지는 코드 포인트 단위로 자름', () => {
    const out = markdownExcerpt('😀'.repeat(250));
    expect([...out]).toHaveLength(200);
  });
});
