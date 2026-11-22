import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import { Button } from '@onyx/components/button/button';
import { TextInput } from '@/components/common/TextInput';
import { ApiError } from '@/api/http';
import { INTEREST_MAX, INTEREST_MIN, saveInterestTags, updateNickname, withdraw } from '@/api/me';
import { useAuth } from '@/auth/AuthProvider';
import { FieldError } from '@/components/common/FieldError';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { errorMessage, fieldErrorMap } from '@/lib/errors';
import { interestTagsQuery } from './queries';
import { TagPicker } from './TagPicker';
import { PasskeySection } from './PasskeySection';
import { passkeyAvailable } from '@/lib/passkey';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-line bg-surface p-5">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function NicknameForm() {
  const { me, updateMe } = useAuth();
  const toast = useToast();
  const [value, setValue] = useState(me?.nickname ?? '');
  const trimmed = value.trim();
  const local = trimmed.length < 2 || trimmed.length > 20 ? '닉네임은 2~20자로 입력해 주세요' : undefined;
  const save = useMutation({
    mutationFn: () => updateNickname(trimmed),
    onSuccess: (user) => {
      updateMe({ nickname: user.nickname });
      toast('닉네임을 바꿨어요');
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!local && trimmed !== me?.nickname) save.mutate();
  };
  const serverError = fieldErrorMap(save.error).nickname ?? (save.isError ? errorMessage(save.error) : undefined);

  return (
    <form onSubmit={submit} noValidate className="flex items-start gap-2">
      <div className="max-w-xs flex-1">
        <TextInput label="닉네임" value={value} maxLength={20} onChange={(e) => setValue(e.target.value)} className="h-9" />
        <FieldError message={(value !== me?.nickname ? local : undefined) ?? serverError} />
      </div>
      <Button
        type="submit"
        width={64}
        height={36}
        className="mt-5 rounded-full bg-inverse text-on-inverse"
        content="저장"
        disabled={!!local || trimmed === me?.nickname || save.isPending}
      />
    </form>
  );
}

function InterestTags() {
  const client = useQueryClient();
  const { updateMe } = useAuth();
  const toast = useToast();
  const tags = useQuery(interestTagsQuery);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<number[]>([]);
  const current = tags.data ?? [];

  const save = useMutation({
    mutationFn: (ids: number[]) => saveInterestTags(ids),
    onSuccess: (data) => {
      client.setQueryData(interestTagsQuery.queryKey, data);
      updateMe({ hasInterestTags: data.items.length > 0, onboardingCompleted: true });
      client.invalidateQueries({ queryKey: ['posts', 'recommendations'] });
      setPicking(false);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  const remove = (id: number) => save.mutate(current.filter((t) => t.id !== id).map((t) => t.id));
  const openPicker = () => {
    setDraft(current.map((t) => t.id));
    setPicking(true);
  };
  const atMin = current.length <= INTEREST_MIN;

  return (
    <div>
      {tags.isPending ? (
        <p className="text-sm text-fg-muted">불러오는 중</p>
      ) : (
        <ul className="flex flex-wrap items-center gap-2" aria-label="관심 태그">
          {current.map((t) => (
            <li key={t.id}>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-sm text-brand">
                #{t.name}
                <button
                  type="button"
                  aria-label={`${t.name} 관심 태그 제거`}
                  title={atMin ? `최소 ${INTEREST_MIN}개가 필요해요` : undefined}
                  disabled={atMin || save.isPending}
                  onClick={() => remove(t.id)}
                  className="disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FiX size={12} />
                </button>
              </span>
            </li>
          ))}
          <li>
            <button type="button" onClick={openPicker} className="rounded-full border border-dashed border-line px-3 py-1 text-sm text-fg-secondary hover:border-line-strong hover:text-brand">
              {current.length === 0 ? '+ 관심 태그 고르기' : '+ 추가·변경'}
            </button>
          </li>
        </ul>
      )}
      <p className="mt-2 text-xs text-fg-muted">
        {INTEREST_MIN}~{INTEREST_MAX}개. {atMin && current.length > 0 ? `최소 ${INTEREST_MIN}개가 필요해서 더 뺄 수 없어요` : '추천 피드에 반영돼요'}
      </p>

      <Modal open={picking} onClose={() => setPicking(false)} title="관심 태그">
        <TagPicker
          selected={draft}
          max={INTEREST_MAX}
          onToggle={(id) => setDraft((d) => (d.includes(id) ? d.filter((v) => v !== id) : [...d, id]))}
        />
        <div className="mt-5 flex items-center gap-2">
          <span className="mr-auto text-sm tabular-nums text-fg-secondary">
            선택 {draft.length}/{INTEREST_MAX}
          </span>
          <Button variant="outlined" width={64} height={36} content="취소" onClick={() => setPicking(false)} />
          <Button
            width={64}
            height={36}
            className="rounded-full bg-inverse text-on-inverse"
            content="저장"
            disabled={draft.length < INTEREST_MIN || save.isPending}
            onClick={() => save.mutate(draft)}
          />
        </div>
      </Modal>
    </div>
  );
}

function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { clearSession } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const run = useMutation({
    mutationFn: () => withdraw(password),
    onSuccess: () => {
      clearSession();
      toast('탈퇴했어요. 그동안 이용해 주셔서 고마워요');
    },
  });
  const message =
    run.error instanceof ApiError && run.error.code === 'PASSWORD_MISMATCH'
      ? '비밀번호가 맞지 않아요'
      : run.isError
        ? errorMessage(run.error)
        : undefined;

  const close = () => {
    setPassword('');
    run.reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="회원 탈퇴">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (password) run.mutate();
        }}
      >
        <p className="text-sm text-fg-secondary">탈퇴하면 아래 데이터가 바로 삭제되고 되돌릴 수 없어요. 계속할까요?</p>
        <ul className="my-3 list-disc pl-5 text-sm text-fg-secondary">
          <li>계정 정보 (이메일, 닉네임)</li>
          <li>북마크, 읽은 기록, 관심 태그</li>
          <li>커뮤니티 글 (댓글이 달린 글은 "삭제된 글이에요"로 남아요)</li>
        </ul>
        <p className="mb-4 text-xs text-fg-muted">글 조회수 같은 집계 수치는 개인을 알 수 없는 형태로 남아요.</p>
        <TextInput
          label="비밀번호 확인"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9"
        />
        <FieldError message={message} />
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outlined" width={64} height={36} content="취소" onClick={close} />
          <Button
            type="submit"
            width={72}
            height={36}
            className="rounded-full bg-danger text-on-danger"
            content={run.isPending ? '처리 중' : '탈퇴하기'}
            disabled={!password || run.isPending}
          />
        </div>
      </form>
    </Modal>
  );
}

export function SettingsPage() {
  const { logout } = useAuth();
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">설정</h1>
      <Section title="프로필">
        <NicknameForm />
      </Section>
      <Section title="관심 태그">
        <InterestTags />
      </Section>
      {passkeyAvailable() && <PasskeySection />}
      <Section title="계정">
        <div className="flex gap-2">
          <Button variant="outlined" width={80} height={36} content="로그아웃" onClick={() => logout()} />
          <Button
            variant="outlined"
            width={80}
            height={36}
            className="border-danger-line text-danger"
            content="회원 탈퇴"
            onClick={() => setWithdrawOpen(true)}
          />
        </div>
      </Section>
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}
