import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@onyx/components/button/button';
import { TextInput } from '@/components/common/TextInput';
import { createSource, updateSource, validateFeed } from '@/api/admin';
import type { AdminSource, FeedValidationResult, NewsRegion, SourceInput, SourceKind, SourceType, UpdateSourceInput } from '@/api/types';
import { ErrorState } from '@/components/common/ErrorState';
import { FieldError } from '@/components/common/FieldError';
import { FullPageSpinner } from '@/components/common/FullPageSpinner';
import { errorMessage, fieldErrorMap } from '@/lib/errors';
import { isHttpUrl } from '@/lib/format';
import { ADMIN_KEY, adminSourceQuery } from './queries';
import { M7_API_READY } from '@/lib/features';
import { KIND_LABEL, REGION_LABEL, TYPE_LABEL } from './sourceKind';

export const INTERVAL_MIN = 30;
export const INTERVAL_MAX = 1440;

interface FormValues {
  name: string;
  siteUrl: string;
  feedUrl: string;
  type: SourceType;
  kind: SourceKind;
  region: NewsRegion;
  logoUrl: string;
  crawlIntervalMin: string;
}

const EMPTY: FormValues = {
  name: '',
  siteUrl: '',
  feedUrl: '',
  type: 'COMPANY',
  kind: 'BLOG',
  region: 'DOMESTIC',
  logoUrl: '',
  crawlIntervalMin: '60',
};

function toValues(s: AdminSource): FormValues {
  return {
    name: s.name,
    siteUrl: s.siteUrl,
    feedUrl: s.feedUrl,
    type: s.type,
    kind: s.kind ?? 'BLOG',
    region: s.region ?? 'DOMESTIC',
    logoUrl: s.logoUrl ?? '',
    crawlIntervalMin: String(s.crawlIntervalMin),
  };
}

function toInput(v: FormValues): SourceInput {
  const base = {
    name: v.name.trim(),
    siteUrl: v.siteUrl.trim(),
    feedUrl: v.feedUrl.trim(),
    type: v.kind === 'SECURITY_NEWS' ? 'COMPANY' : v.type,
    kind: v.kind,
    region: v.kind === 'SECURITY_NEWS' ? v.region : undefined,
    logoUrl: v.logoUrl.trim() || null,
    crawlIntervalMin: Number(v.crawlIntervalMin),
  };
  if (M7_API_READY) return base;
  const { kind: _kind, region: _region, ...legacy } = base;
  return legacy;
}

export function validateForm(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!v.name.trim()) errors.name = '이름을 입력해 주세요';
  else if (v.name.trim().length > 100) errors.name = '100자 이하로 입력해 주세요';
  if (!isHttpUrl(v.siteUrl.trim())) errors.siteUrl = 'http(s) URL을 입력해 주세요';
  if (!isHttpUrl(v.feedUrl.trim())) errors.feedUrl = 'http(s) URL을 입력해 주세요';
  if (v.logoUrl.trim() && !isHttpUrl(v.logoUrl.trim())) errors.logoUrl = 'http(s) URL을 입력해 주세요';
  const interval = Number(v.crawlIntervalMin);
  if (!Number.isInteger(interval) || interval < INTERVAL_MIN || interval > INTERVAL_MAX) {
    errors.crawlIntervalMin = `${INTERVAL_MIN}~${INTERVAL_MAX}분 사이 정수로 입력해 주세요`;
  }
  return errors;
}

function diff(initial: SourceInput, next: SourceInput): UpdateSourceInput {
  const out: UpdateSourceInput = {};
  for (const key of Object.keys(next) as (keyof SourceInput)[]) {
    if (key === 'kind') continue;
    if (initial[key] !== next[key]) Object.assign(out, { [key]: next[key] });
  }
  return out;
}

function ValidationPanel({ result }: { result: FeedValidationResult }) {
  if (!result.valid) {
    return <p className="text-sm text-danger">유효하지 않은 피드예요: {result.reason ?? '알 수 없는 오류'}</p>;
  }
  if (result.duplicated) return <p className="text-sm text-danger">같은 피드 URL로 등록된 소스가 이미 있어요</p>;
  return (
    <div className="text-sm text-success">
      <p>
        유효한 {result.format} 피드예요 · {result.feedTitle} · 최근 글 {result.itemCount}건
      </p>
      {result.sampleTitles && result.sampleTitles.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs text-fg-secondary">
          {result.sampleTitles.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RadioRow<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium">{legend}</legend>
      <div className="flex gap-4 text-sm">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-1">
            <input
              type="radio"
              name={name}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="accent-[var(--color-primary)]"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SourceForm({ source }: { source?: AdminSource }) {
  const isNew = !source;
  const initial = source ? toValues(source) : EMPTY;
  const [values, setValues] = useState<FormValues>(initial);
  const [touched, setTouched] = useState(false);
  const [checked, setChecked] = useState<{ url: string; result: FeedValidationResult } | null>(null);
  const navigate = useNavigate();
  const client = useQueryClient();

  const set = (key: keyof FormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const localErrors = validateForm(values);
  const feedUrl = values.feedUrl.trim();
  const feedChanged = isNew || feedUrl !== initial.feedUrl;
  const feedVerified =
    !feedChanged || (checked?.url === feedUrl && checked.result.valid && !checked.result.duplicated);

  const validate = useMutation({
    mutationFn: () => validateFeed(feedUrl),
    onSuccess: (result) => setChecked({ url: feedUrl, result }),
  });

  const save = useMutation({
    mutationFn: () => {
      const input = toInput(values);
      return source ? updateSource(source.id, diff(toInput(initial), input)) : createSource(input);
    },
    onSuccess: (saved) => {
      client.invalidateQueries({ queryKey: ADMIN_KEY });
      navigate(`/admin/sources/${saved.id}`);
    },
  });

  const serverErrors = fieldErrorMap(save.error);
  const errorOf = (key: keyof FormValues) => (touched ? localErrors[key] : undefined) ?? serverErrors[key];
  const unchanged = !isNew && Object.keys(diff(toInput(initial), toInput(values))).length === 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(localErrors).length > 0 || !feedVerified || unchanged) return;
    save.mutate();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-[var(--radius-md)] border border-line bg-surface p-5">
      <div>
        <TextInput label="이름" value={values.name} onChange={set('name')} maxLength={100} className="h-9" />
        <FieldError message={errorOf('name')} />
      </div>
      <div>
        <TextInput label={values.kind === 'SECURITY_NEWS' ? '사이트 URL' : '블로그 URL'} value={values.siteUrl} onChange={set('siteUrl')} inputMode="url" className="h-9" />
        <FieldError message={errorOf('siteUrl')} />
      </div>
      <div>
        <div className="flex items-end gap-2">
          <TextInput
            label="피드 URL (RSS/Atom)"
            value={values.feedUrl}
            onChange={set('feedUrl')}
            inputMode="url"
            className="h-9"
          />
          <Button
            type="button"
            width={64}
            height={36}
            variant="outlined"
            content={validate.isPending ? '검증 중' : '검증'}
            disabled={!isHttpUrl(feedUrl) || validate.isPending}
            onClick={() => validate.mutate()}
            className="shrink-0"
          />
        </div>
        <FieldError message={errorOf('feedUrl')} />
        <div className="mt-2" aria-live="polite">
          {validate.isError ? (
            <p className="text-sm text-danger">{errorMessage(validate.error)}</p>
          ) : checked && checked.url === feedUrl ? (
            <ValidationPanel result={checked.result} />
          ) : feedChanged && isHttpUrl(feedUrl) ? (
            <p className="text-xs text-fg-muted">저장하려면 피드 URL을 먼저 검증해 주세요</p>
          ) : null}
        </div>
      </div>
      {!M7_API_READY ? null : isNew ? (
        <RadioRow
          legend="종류"
          name="kind"
          options={(['BLOG', 'SECURITY_NEWS'] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          value={values.kind}
          onChange={(kind) => setValues((v) => ({ ...v, kind }))}
        />
      ) : (
        <div>
          <p className="mb-1 text-xs font-medium">종류</p>
          <p className="text-sm">
            {KIND_LABEL[values.kind]} <span className="text-xs text-fg-muted">(등록 후에는 바꿀 수 없어요)</span>
          </p>
        </div>
      )}
      {values.kind === 'BLOG' ? (
        <RadioRow
          legend="유형"
          name="type"
          options={(['COMPANY', 'PERSONAL'] as const).map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
          value={values.type}
          onChange={(type) => setValues((v) => ({ ...v, type }))}
        />
      ) : (
        <RadioRow
          legend="지역"
          name="region"
          options={(['DOMESTIC', 'OVERSEAS'] as const).map((r) => ({ value: r, label: REGION_LABEL[r] }))}
          value={values.region}
          onChange={(region) => setValues((v) => ({ ...v, region }))}
        />
      )}
      <div>
        <TextInput label="로고 URL (선택)" value={values.logoUrl} onChange={set('logoUrl')} inputMode="url" className="h-9" />
        <FieldError message={errorOf('logoUrl')} />
      </div>
      <div className="max-w-[200px]">
        <TextInput
          label="수집 주기"
          value={values.crawlIntervalMin}
          onChange={set('crawlIntervalMin')}
          inputMode="numeric"
          suffix="분"
          className="h-9"
        />
        <FieldError message={errorOf('crawlIntervalMin')} />
      </div>

      {save.isError && Object.keys(serverErrors).length === 0 && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(save.error)}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Link
          to={source ? `/admin/sources/${source.id}` : '/admin'}
          className="flex h-9 items-center rounded-[var(--radius-sm)] border border-line px-4 text-xs"
        >
          취소
        </Link>
        <Button
          type="submit"
          width={72}
          height={36}
          className="rounded-full bg-inverse text-on-inverse"
          content={save.isPending ? '저장 중' : '저장'}
          disabled={save.isPending || !feedVerified || unchanged}
        />
      </div>
    </form>
  );
}

export function SourceFormPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const source = useQuery({ ...adminSourceQuery(id ?? 0), enabled: id !== null });

  return (
    <section className="max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">{id === null ? '소스 등록' : '소스 수정'}</h1>
      {id === null ? (
        <SourceForm />
      ) : source.isPending ? (
        <FullPageSpinner />
      ) : source.isError ? (
        <ErrorState message={source.error.message} onRetry={() => source.refetch()} />
      ) : (
        <SourceForm key={source.data.updatedAt} source={source.data} />
      )}
    </section>
  );
}
