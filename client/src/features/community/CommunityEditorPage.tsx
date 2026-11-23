import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FiX } from 'react-icons/fi';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '@onyx/components/button/button';
import { ApiError } from '@/api/http';
import { BODY_MAX, BODY_MIN, createCommunityPost, TAG_MAX, TITLE_MAX, TITLE_MIN, updateCommunityPost } from '@/api/community';
import type { CommunityCategory, CommunityPost, CommunityPostInput, PostWriteReason, TagRef } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { EmptyState } from '@/components/common/EmptyState';
import { FieldError } from '@/components/common/FieldError';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { LazyMarkdown } from '@/components/markdown/LazyMarkdown';
import { tagsQuery } from '@/features/feed/queries';
import { TagPicker } from '@/features/me/TagPicker';
import { POSTS_KEY } from '@/hooks/usePostActions';
import { refreshProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/cn';
import { CATEGORIES, parseCategory, writeBlockedMessage } from '@/lib/community';
import { errorMessage, fieldErrorMap } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { communityPostPath, PATHS } from '@/lib/routes';
import { communityPostKey, communityPostQuery, writeStatusQuery } from './queries';
import { clearDraft, draftKey, readDraft, useDraftSaver } from './useDraft';

const INDENT = '\t';

function sameInput(a: CommunityPostInput, b: CommunityPostInput) {
  return a.category === b.category && a.title === b.title && a.body === b.body && a.tagIds.join(',') === b.tagIds.join(',');
}

function indentLines(value: string, start: number, end: number, outdent: boolean) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  if (!outdent && start === end) {
    return { value: value.slice(0, start) + INDENT + value.slice(end), start: start + 1, end: start + 1 };
  }
  const block = value.slice(lineStart, end);
  const lines = block.split('\n');
  let first = 0;
  let total = 0;
  const next = lines.map((line, i) => {
    if (!outdent) {
      if (i === 0) first = INDENT.length;
      total += INDENT.length;
      return INDENT + line;
    }
    const m = /^(\t| {1,4})/.exec(line);
    const cut = m ? m[0].length : 0;
    if (i === 0) first = -cut;
    total -= cut;
    return line.slice(cut);
  });
  return {
    value: value.slice(0, lineStart) + next.join('\n') + value.slice(end),
    start: Math.max(lineStart, start + first),
    end: end + total,
  };
}

function useTick(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);
  return now;
}

interface Blocked {
  reason: PostWriteReason | null;
  availableAt: string | null;
}

interface EditorProps {
  initial: CommunityPostInput;
  initialTags: TagRef[];
  post: CommunityPost | null;
}

function Editor({ initial, initialTags, post }: EditorProps) {
  const { me } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const key = me ? draftKey(me.id, post?.id ?? null) : null;
  const [restored] = useState(() => (key ? readDraft(key) : null));
  const usable = restored && !sameInput(restored, initial) ? restored : null;
  const [form, setForm] = useState<CommunityPostInput>(usable ?? initial);
  const [notice, setNotice] = useState(usable !== null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [picking, setPicking] = useState(false);
  const [draftTags, setDraftTags] = useState<number[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [touched, setTouched] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);
  const escaped = useRef(false);
  const ids = { title: useId(), body: useId(), bodyHelp: useId() };
  const tags = useQuery(tagsQuery);
  const isNew = post === null;
  const status = useQuery({ ...writeStatusQuery, enabled: isNew });
  const dirty = !sameInput(form, initial);
  useDraftSaver(key, form, dirty);

  const tagNames = useMemo(() => {
    const map = new Map<number, string>(initialTags.map((t) => [t.id, t.name]));
    for (const t of tags.data ?? []) map.set(t.id, t.name);
    return map;
  }, [tags.data, initialTags]);

  const serverBlock: Blocked | null =
    blocked ?? (isNew && status.data && !status.data.allowed ? { reason: status.data.reason, availableAt: status.data.availableAt } : null);
  const now = useTick(serverBlock?.reason === 'COOLDOWN' || serverBlock?.reason === 'DAILY_LIMIT');

  useEffect(() => {
    if (!serverBlock?.availableAt) return;
    const wait = Date.parse(serverBlock.availableAt) - Date.now();
    if (wait > 6 * 3_600_000) return;
    const t = setTimeout(() => {
      setBlocked(null);
      client.invalidateQueries({ queryKey: writeStatusQuery.queryKey });
    }, Math.max(0, wait) + 500);
    return () => clearTimeout(t);
  }, [serverBlock?.availableAt, client]);

  useLayoutEffect(() => {
    const sel = pendingSel.current;
    if (sel && bodyRef.current) {
      bodyRef.current.setSelectionRange(sel[0], sel[1]);
      pendingSel.current = null;
    }
  });

  const title = form.title.trim();
  const bodyLen = form.body.trim().length;
  const local = {
    title: title.length < TITLE_MIN || title.length > TITLE_MAX ? `제목은 ${TITLE_MIN}~${TITLE_MAX}자로 입력해 주세요` : undefined,
    body: bodyLen < BODY_MIN || form.body.length > BODY_MAX ? `본문은 ${BODY_MIN}~${formatNumber(BODY_MAX)}자로 입력해 주세요` : undefined,
  };
  const valid = !local.title && !local.body;

  const save = useMutation({
    mutationFn: async (input: CommunityPostInput) => {
      if (isNew) return createCommunityPost(input);
      const changed: Partial<CommunityPostInput> = {};
      if (input.category !== initial.category) changed.category = input.category;
      if (input.title !== initial.title) changed.title = input.title;
      if (input.body !== initial.body) changed.body = input.body;
      if (input.tagIds.join(',') !== initial.tagIds.join(',')) changed.tagIds = input.tagIds;
      return updateCommunityPost(post.id, changed);
    },
    onSuccess: (saved) => {
      if (key) clearDraft(key);
      client.setQueryData(communityPostKey(saved.id, 'member'), saved);
      client.invalidateQueries({ queryKey: POSTS_KEY });
      client.invalidateQueries({ queryKey: writeStatusQuery.queryKey });
      refreshProfile(client);
      toast(isNew ? '글을 올렸어요' : '글을 고쳤어요');
      navigate(communityPostPath(saved.id), { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'POST_WRITE_LIMITED') {
        setBlocked({ reason: (error.body.reason as PostWriteReason) ?? null, availableAt: error.body.availableAt ?? null });
        client.invalidateQueries({ queryKey: writeStatusQuery.queryKey });
      }
    },
  });

  const serverFields = fieldErrorMap(save.error);
  const saveError =
    save.isError && !(save.error instanceof ApiError && (save.error.code === 'POST_WRITE_LIMITED' || save.error.code === 'VALIDATION_FAILED'))
      ? save.error instanceof ApiError && save.error.code === 'COMMUNITY_POST_CLOSED'
        ? '숨겨진 글은 고칠 수 없어요'
        : errorMessage(save.error)
      : undefined;

  const set = <K extends keyof CommunityPostInput>(k: K, v: CommunityPostInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setTouched(true);
    if (!valid || save.isPending || serverBlock) return;
    save.mutate({ ...form, title });
  };

  const onBodyKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      escaped.current = true;
      return;
    }
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) {
      escaped.current = false;
      return;
    }
    if (escaped.current) {
      escaped.current = false;
      return;
    }
    e.preventDefault();
    const el = e.currentTarget;
    const r = indentLines(form.body, el.selectionStart, el.selectionEnd, e.shiftKey);
    pendingSel.current = [r.start, r.end];
    set('body', r.value);
  };

  const discardDraft = () => {
    if (key) clearDraft(key);
    setForm(initial);
    setNotice(false);
  };

  const cancelTarget = post ? communityPostPath(post.id) : PATHS.community;
  const cancel = () => (dirty ? setLeaving(true) : navigate(cancelTarget));

  return (
    <form
      noValidate
      className="mx-auto max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h1 className="text-xl font-bold">{isNew ? '글 쓰기' : '글 고치기'}</h1>

      {notice && (
        <p role="status" className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-subtle px-3 py-2 text-sm text-fg-secondary">
          임시 저장한 내용을 불러왔어요
          <button type="button" className="font-medium text-fg hover:underline" onClick={discardDraft}>
            버리기
          </button>
        </p>
      )}

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium">말머리</legend>
        <div role="radiogroup" aria-label="말머리" className="inline-flex rounded-lg bg-subtle p-0.5">
          {CATEGORIES.map((c) => {
            const on = form.category === c.api;
            return (
              <button
                key={c.api}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set('category', c.api)}
                className={cn(
                  'h-8 rounded-md px-4 text-sm transition-colors',
                  on ? 'bg-surface font-semibold text-fg shadow-sm ring-1 ring-inset ring-line-strong' : 'text-fg-secondary hover:text-fg',
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        {!isNew && initial.category === 'QUESTION' && form.category !== 'QUESTION' && post?.acceptedCommentId && (
          <p className="mt-1.5 text-xs text-warn">질문이 아닌 말머리로 바꾸면 채택이 풀려요</p>
        )}
      </fieldset>

      <div className="mt-5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor={ids.title} className="text-sm font-medium">
            제목
          </label>
          <span className={cn('text-xs tabular-nums', title.length > TITLE_MAX ? 'text-danger' : 'text-fg-muted')}>
            {title.length}/{TITLE_MAX}
          </span>
        </div>
        <input
          id={ids.title}
          value={form.title}
          maxLength={TITLE_MAX + 20}
          onChange={(e) => set('title', e.target.value.replace(/\n/g, ' '))}
          placeholder="제목을 입력해 주세요"
          className="h-10 w-full rounded-[var(--radius-sm)] border border-line bg-input px-3 text-[15px] focus:border-line-strong focus:outline-none"
        />
        <FieldError message={(touched ? local.title : undefined) ?? serverFields.title} />
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span id={`${ids.body}-label`} className="text-sm font-medium">
            본문
          </span>
          <div role="tablist" aria-label="본문 보기" className="inline-flex rounded-lg bg-subtle p-0.5">
            {(['write', 'preview'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'h-7 rounded-md px-3 text-[13px]',
                  tab === t ? 'bg-surface font-semibold text-fg shadow-sm ring-1 ring-inset ring-line-strong' : 'text-fg-secondary hover:text-fg',
                )}
              >
                {t === 'write' ? '작성' : '미리보기'}
              </button>
            ))}
          </div>
        </div>
        {tab === 'write' ? (
          <textarea
            id={ids.body}
            ref={bodyRef}
            aria-labelledby={`${ids.body}-label`}
            aria-describedby={ids.bodyHelp}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            onKeyDown={onBodyKey}
            rows={18}
            spellCheck={false}
            placeholder={'마크다운으로 써 주세요\n\n```java\n// 코드 블록은 언어를 적으면 색이 입혀져요\n```'}
            className="scrollbar-thin block min-h-[320px] w-full resize-y rounded-[var(--radius-sm)] border border-line bg-input px-3 py-2.5 font-mono text-[13px] leading-relaxed [tab-size:4] focus:border-line-strong focus:outline-none"
          />
        ) : (
          <div
            role="tabpanel"
            aria-label="미리보기"
            className="min-h-[320px] rounded-[var(--radius-sm)] border border-line bg-surface px-4 py-3"
          >
            {form.body.trim() ? <LazyMarkdown source={form.body} /> : <p className="text-sm text-fg-muted">미리 볼 내용이 없어요</p>}
          </div>
        )}
        <div id={ids.bodyHelp} className="mt-1.5 flex flex-wrap items-start justify-between gap-2 text-xs text-fg-muted">
          <span>마크다운 일부 지원 · 이미지·HTML은 글자로만 보여요 · Tab 들여쓰기 (Esc 후 Tab은 다음 칸으로)</span>
          <span className={cn('tabular-nums', form.body.length > BODY_MAX && 'text-danger')}>
            {formatNumber(form.body.length)}/{formatNumber(BODY_MAX)}
          </span>
        </div>
        <FieldError message={(touched ? local.body : undefined) ?? serverFields.body} />
      </div>

      <div className="mt-5">
        <span className="mb-1.5 block text-sm font-medium">태그 (최대 {TAG_MAX}개)</span>
        <ul className="flex flex-wrap items-center gap-2" aria-label="고른 태그">
          {form.tagIds.map((id) => (
            <li key={id}>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-sm text-brand">
                #{tagNames.get(id) ?? id}
                <button
                  type="button"
                  aria-label={`${tagNames.get(id) ?? id} 태그 빼기`}
                  onClick={() => set('tagIds', form.tagIds.filter((v) => v !== id))}
                >
                  <FiX size={12} />
                </button>
              </span>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setDraftTags(form.tagIds);
                setPicking(true);
              }}
              className="rounded-full border border-dashed border-line px-3 py-1 text-sm text-fg-secondary hover:border-line-strong hover:text-brand"
            >
              + 태그 추가
            </button>
          </li>
        </ul>
        <FieldError message={serverFields.tagIds} />
      </div>

      <div className="mt-8 border-t border-line pt-4">
        {serverBlock ? (
          <p role="alert" className="mb-3 rounded-[var(--radius-md)] bg-subtle px-3 py-2.5 text-sm text-fg-secondary">
            {writeBlockedMessage(serverBlock.reason, serverBlock.availableAt, now)}
          </p>
        ) : (
          isNew &&
          status.data?.remainingToday != null && (
            <p className="mb-3 text-xs text-fg-muted">오늘 {status.data.remainingToday}개 더 쓸 수 있어요</p>
          )
        )}
        <FieldError message={saveError} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outlined" width={64} height={36} content="취소" onClick={cancel} />
          {!serverBlock && (
            <Button
              type="submit"
              width={isNew ? 80 : 64}
              height={36}
              className="rounded-full bg-inverse text-on-inverse"
              content={save.isPending ? '보내는 중' : isNew ? '올리기' : '저장'}
              disabled={save.isPending || (isNew && status.isPending) || (!isNew && !dirty)}
            />
          )}
        </div>
      </div>

      <Modal
        open={picking}
        onClose={() => setPicking(false)}
        title="태그 고르기"
        variant="sheet"
        footer={
          <>
            <span className="mr-auto text-sm tabular-nums text-fg-secondary">
              선택 {draftTags.length}/{TAG_MAX}
            </span>
            <Button variant="outlined" width={64} height={36} content="취소" onClick={() => setPicking(false)} />
            <Button
              width={64}
              height={36}
              className="rounded-full bg-inverse text-on-inverse"
              content="적용"
              onClick={() => {
                set('tagIds', draftTags);
                setPicking(false);
              }}
            />
          </>
        }
      >
        <TagPicker
          selected={draftTags}
          max={TAG_MAX}
          onToggle={(id) => setDraftTags((d) => (d.includes(id) ? d.filter((v) => v !== id) : [...d, id]))}
        />
      </Modal>
      <ConfirmModal
        open={leaving}
        title="작성 취소"
        confirmLabel="나가기"
        onClose={() => setLeaving(false)}
        onConfirm={() => {
          if (key) clearDraft(key);
          navigate(cancelTarget);
        }}
      >
        쓰던 내용이 사라져요. 나갈까요?
      </ConfirmModal>
    </form>
  );
}

function defaultCategory(value: string | null): CommunityCategory {
  return parseCategory(value)?.api ?? 'QUESTION';
}

export function CommunityNewPage() {
  const [params] = useSearchParams();
  const initial = useMemo<CommunityPostInput>(
    () => ({ category: defaultCategory(params.get('category')), title: '', body: '', tagIds: [] }),
    [params],
  );
  return <Editor initial={initial} initialTags={[]} post={null} />;
}

export function CommunityEditPage() {
  const { id } = useParams();
  const postId = Number(id);
  const { status } = useAuth();
  const valid = Number.isInteger(postId) && postId > 0;
  const query = useQuery({ ...communityPostQuery(postId, status), enabled: valid && status === 'member' });
  const post = query.data;
  const initial = useMemo<CommunityPostInput | null>(
    () => (post ? { category: post.community.category, title: post.title, body: post.body ?? '', tagIds: post.tags.map((t) => t.id) } : null),
    [post],
  );

  if (!valid || query.isError || (post && (!post.mine || post.status !== 'VISIBLE'))) {
    return (
      <EmptyState
        title="고칠 수 없는 글이에요"
        description="삭제됐거나 숨겨졌거나 내가 쓴 글이 아니에요"
        action={
          <Link to={PATHS.community} className="text-sm font-medium text-brand">
            자유 게시판으로
          </Link>
        }
      />
    );
  }
  if (!post || !initial) return <p className="mx-auto max-w-3xl text-sm text-fg-muted">불러오는 중이에요</p>;
  return <Editor key={post.id} initial={initial} initialTags={post.tags} post={post} />;
}
