import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '@onyx/components/button/button';
import { completeOnboarding, INTEREST_MAX, INTEREST_MIN, saveInterestTags } from '@/api/me';
import { useAuth } from '@/auth/AuthProvider';
import { safeRedirect } from '@/auth/guards';
import { useToast } from '@/components/common/Toast';
import { errorMessage } from '@/lib/errors';
import { interestTagsQuery } from './queries';
import { TagPicker } from './TagPicker';

export function OnboardingPage() {
  const { updateMe } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const toast = useToast();
  const current = useQuery(interestTagsQuery);
  const [selected, setSelected] = useState<number[] | null>(null);
  const picked = selected ?? [];

  useEffect(() => {
    if (current.data && selected === null) setSelected(current.data.map((t) => t.id));
  }, [current.data, selected]);

  const target = params.get('redirect') ? safeRedirect(params.get('redirect')) : '/for-you';
  const done = (hasInterestTags: boolean) => {
    client.invalidateQueries({ queryKey: ['posts', 'recommendations'] });
    updateMe({ onboardingCompleted: true, ...(hasInterestTags ? { hasInterestTags: true } : {}) });
    navigate(target, { replace: true });
  };

  const save = useMutation({
    mutationFn: () => saveInterestTags(picked),
    onSuccess: (data) => {
      client.setQueryData(interestTagsQuery.queryKey, data);
      done(true);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const skip = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => done(false),
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  const toggle = (id: number) =>
    setSelected((prev) => {
      const list = prev ?? [];
      return list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
    });

  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      <h1 className="text-xl font-bold">관심 있는 기술을 골라주셈</h1>
      <p className="mb-5 mt-1 text-sm text-fg-secondary">
        {INTEREST_MIN}개 이상 고르면 추천이 정확해짐 (최대 {INTEREST_MAX}개)
      </p>
      <TagPicker selected={picked} max={INTEREST_MAX} onToggle={toggle} />
      <div className="mt-6 flex items-center gap-2">
        <span className="mr-auto text-sm tabular-nums text-fg-secondary" aria-live="polite">
          선택 {picked.length}/{INTEREST_MAX}
        </span>
        <Button
          variant="text"
          width={72}
          height={36}
          content="건너뛰기"
          disabled={skip.isPending || save.isPending}
          onClick={() => skip.mutate()}
        />
        <Button
          width={72}
          height={36}
          className="bg-brand text-white"
          content={save.isPending ? '저장 중' : '완료'}
          disabled={picked.length < INTEREST_MIN || save.isPending || skip.isPending}
          onClick={() => save.mutate()}
        />
      </div>
    </section>
  );
}
