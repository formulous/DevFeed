import type { ReactNode } from 'react';

function Item({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-4 first:border-t-0">
      <h2 className="mb-1 text-base font-semibold">{title}</h2>
      <div className="space-y-1 text-sm leading-relaxed text-fg-secondary">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl rounded-[var(--radius-md)] border border-line bg-surface px-6 py-5">
      <h1 className="mb-2 text-xl font-bold">개인정보 안내</h1>
      <p className="mb-2 text-sm text-fg-secondary">DevFeed가 어떤 정보를 왜 보관하고 언제 지우는지 안내해 드려요.</p>
      <Item title="수집 항목">
        <p>회원가입할 때 이메일과 닉네임만 받아요.</p>
        <p>비밀번호는 원래 값으로 되돌릴 수 없는 해시로만 저장해요.</p>
      </Item>
      <Item title="이용 목적">
        <p>로그인, 북마크·읽은 기록 보관, 관심 태그와 읽은 기록을 바탕으로 한 글 추천에만 써요.</p>
      </Item>
      <Item title="비회원 식별 쿠키">
        <p>
          같은 사람이 같은 글을 여러 번 열어도 조회수가 한 번만 오르도록 무작위 식별 쿠키(<code>df_vid</code>)를
          1년 동안 둬요. 이름·이메일 등 개인을 알 수 있는 정보는 담기지 않아요.
        </p>
      </Item>
      <Item title="광고 쿠키">
        <p>Google 광고를 보여주기 위해 Google과 파트너가 쿠키를 사용할 수 있어요. 맞춤 광고는 Google 광고 설정에서 끌 수 있어요.</p>
        <p className="flex flex-wrap gap-x-3">
          <a href="https://policies.google.com/technologies/ads?hl=ko" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
            Google 광고 정책
          </a>
          <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
            Google 광고 설정
          </a>
        </p>
      </Item>
      <Item title="탈퇴">
        <p>탈퇴하면 계정 정보, 북마크, 읽은 기록, 관심 태그를 바로 삭제해요.</p>
        <p>단, 장애 복구용 일일 백업에는 탈퇴 회원 데이터가 최대 14일 남고, 그 뒤 백업과 함께 자동으로 삭제돼요.</p>
        <p>추천 노출·클릭 기록은 회원과의 연결을 끊어 통계로만 보관해요.</p>
      </Item>
      <Item title="원문 저작권">
        <p>각 블로그의 공개 RSS/Atom 피드에서 제목, 300자 이하 요약, 원문 링크만 가져와 보여드려요. 본문 전체는 저장하지 않아요.</p>
      </Item>
    </article>
  );
}
