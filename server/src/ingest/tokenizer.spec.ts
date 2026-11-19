import { buildBooleanQuery, toTokenString, tokenize } from './tokenizer';

describe('tokenize', () => {
  it('한글 단어는 bigram으로 분해함', () => {
    expect(tokenize('리밸런싱이')).toEqual(['리밸', '밸런', '런싱', '싱이']);
  });

  it('영문·숫자 단어는 소문자 그대로, 1글자는 버림', () => {
    expect(tokenize('Kafka K8s a 7 Node.js')).toEqual(['kafka', 'k8s', 'node', 'js']);
  });

  it('1글자 한글 단어는 버리고 NFKC 정규화함', () => {
    expect(tokenize('및 ＡＢＣ 카프카')).toEqual(['abc', '카프', '프카']);
  });

  it('빈 입력은 빈 배열', () => {
    expect(tokenize(null)).toEqual([]);
    expect(tokenize('  ,, ')).toEqual([]);
  });
});

describe('buildBooleanQuery', () => {
  it('저장과 같은 규칙으로 토큰화하고 모든 토큰을 필수로 둠', () => {
    expect(buildBooleanQuery('카프카 컨슈머')).toBe('+카프 +프카 +컨슈 +슈머');
  });

  it('불리언 연산자 문자는 토큰에 남지 않음', () => {
    expect(buildBooleanQuery('"react" -vue +(next*)')).toBe('+react +vue +next');
  });

  it('검색 문자열은 저장 토큰의 부분집합으로 매칭됨', () => {
    const stored = toTokenString('카프카 컨슈머 리밸런싱이 줄어드는 이유').split(' ');
    for (const token of buildBooleanQuery('리밸런싱').split(' ')) {
      expect(stored).toContain(token.slice(1));
    }
  });
});
