import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { FiKey, FiPlus } from 'react-icons/fi';
import { deletePasskey, fetchPasskeys, renamePasskey } from '@/api/passkeys';
import type { Passkey } from '@/api/types';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { FieldError } from '@/components/common/FieldError';
import { useToast } from '@/components/common/Toast';
import { errorMessage, fieldErrorMap } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { createPasskey, isPasskeyCancel } from '@/lib/passkey';
import { relativeTime } from '@/lib/time';

export const PASSKEY_MAX = 10;
const KEY = ['me', 'passkeys'] as const;

const smallButton =
  'rounded-full border border-line px-3 py-1 text-xs font-medium text-fg-secondary hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50';

function RenameForm({ passkey, onDone }: { passkey: Passkey; onDone: () => void }) {
  const client = useQueryClient();
  const toast = useToast();
  const [value, setValue] = useState(passkey.name);
  const trimmed = value.trim();
  const local = trimmed.length < 1 || trimmed.length > 40 ? '이름은 1~40자로 입력해 주세요' : undefined;
  const save = useMutation({
    mutationFn: () => renamePasskey(passkey.id, trimmed),
    onSuccess: (updated) => {
      client.setQueryData<{ items: Passkey[] }>(KEY, (d) => d && { items: d.items.map((p) => (p.id === updated.id ? updated : p)) });
      toast('패스키 이름을 바꿨어요');
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (local) return;
    if (trimmed === passkey.name) onDone();
    else save.mutate();
  };
  const serverError = fieldErrorMap(save.error).name ?? (save.isError ? errorMessage(save.error) : undefined);
  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-wrap items-start gap-2">
      <div className="min-w-0 flex-1">
        <input
          aria-label="패스키 이름"
          value={value}
          maxLength={40}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-full rounded-md border border-line bg-input px-2.5 text-sm text-fg focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        />
        <FieldError message={local ?? serverError} />
      </div>
      <button type="submit" disabled={!!local || save.isPending} className={smallButton}>
        저장
      </button>
      <button type="button" onClick={onDone} className={smallButton}>
        취소
      </button>
    </form>
  );
}

export function PasskeySection() {
  const client = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: KEY, queryFn: ({ signal }) => fetchPasskeys(signal), select: (d) => d.items });
  const [editing, setEditing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<Passkey | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: createPasskey,
    onMutate: () => setMessage(null),
    onSuccess: (created) => {
      client.setQueryData<{ items: Passkey[] }>(KEY, (d) => ({ items: [created, ...(d?.items ?? [])] }));
      toast('패스키를 추가했어요');
    },
    onError: (err) => {
      if (!isPasskeyCancel(err)) setMessage(errorMessage(err));
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deletePasskey(id),
    onSuccess: (_, id) => {
      client.setQueryData<{ items: Passkey[] }>(KEY, (d) => d && { items: d.items.filter((p) => p.id !== id) });
      toast('패스키를 삭제했어요');
    },
    onError: (err) => setMessage(errorMessage(err)),
  });

  const items = list.data ?? [];
  const full = items.length >= PASSKEY_MAX;

  return (
    <section className="rounded-[var(--radius-md)] border border-line bg-surface p-5" aria-labelledby="passkey-title">
      <div className="mb-1 flex items-center gap-2">
        <h2 id="passkey-title" className="mr-auto text-base font-semibold">
          패스키
        </h2>
        <button
          type="button"
          onClick={() => add.mutate()}
          disabled={add.isPending || full || list.isPending}
          className="flex items-center gap-1 rounded-full bg-inverse px-3 py-1.5 text-xs font-medium text-on-inverse hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiPlus size={14} aria-hidden />
          {add.isPending ? '만드는 중' : '패스키 추가'}
        </button>
      </div>
      <p className="mb-3 text-xs text-fg-muted">
        지문·얼굴·기기 PIN으로 비밀번호 없이 로그인해요. 최대 {PASSKEY_MAX}개, 모두 지워도 이메일 로그인은 그대로예요
      </p>
      {message && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {message}
        </p>
      )}
      {list.isPending ? (
        <p className="text-sm text-fg-muted">불러오는 중이에요</p>
      ) : list.isError ? (
        <p className="text-sm text-fg-secondary">{errorMessage(list.error)}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-fg-secondary">아직 패스키가 없어요</p>
      ) : (
        <ul className="divide-y divide-line" aria-label="패스키 목록">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <FiKey size={16} className="shrink-0 text-fg-muted" aria-hidden />
              {editing === p.id ? (
                <RenameForm passkey={p} onDone={() => setEditing(null)} />
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{p.name}</p>
                    <p className="text-xs text-fg-muted">
                      만든 날 {formatDateTime(p.createdAt).slice(0, 5)} · {p.lastUsedAt ? `마지막 사용 ${relativeTime(p.lastUsedAt)}` : '사용 전'}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" className={smallButton} onClick={() => setEditing(p.id)} aria-label={`${p.name} 이름 바꾸기`}>
                      이름 바꾸기
                    </button>
                    <button type="button" className={smallButton} onClick={() => setRemoving(p)} aria-label={`${p.name} 삭제`}>
                      삭제
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        open={removing !== null}
        title="패스키 삭제"
        confirmLabel="삭제"
        danger
        pending={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id);
          setRemoving(null);
        }}
      >
        {removing?.name} 패스키를 삭제할까요? 이 기기에서 패스키로 로그인할 수 없게 돼요. 이메일 로그인은 그대로 쓸 수 있어요.
      </ConfirmModal>
    </section>
  );
}
