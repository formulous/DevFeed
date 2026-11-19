import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '@onyx/components/button/button';
import { TextField } from '@onyx/components/input/text-field';
import { createTag, updateTag } from '@/api/admin';
import type { AdminTag, TagInput } from '@/api/types';
import { FieldError } from '@/components/common/FieldError';
import { Modal } from '@/components/common/Modal';
import { errorMessage, fieldErrorMap } from '@/lib/errors';
import { toSlug } from '@/lib/format';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SYNONYMS = 20;

export function parseSynonyms(value: string) {
  return Array.from(new Set(value.split(',').map((s) => s.trim()).filter(Boolean)));
}

interface TagFormModalProps {
  tag: AdminTag | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function TagForm({ tag, onClose, onSaved }: Omit<TagFormModalProps, 'open'>) {
  const [name, setName] = useState(tag?.name ?? '');
  const [slug, setSlug] = useState(tag?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!tag);
  const [category, setCategory] = useState(tag?.category ?? '');
  const [synonyms, setSynonyms] = useState(tag?.synonyms.join(', ') ?? '');
  const [submitted, setSubmitted] = useState(false);

  const input: TagInput = {
    name: name.trim(),
    slug: slug.trim(),
    category: category.trim() || null,
    synonyms: parseSynonyms(synonyms),
  };

  const errors: Partial<Record<keyof TagInput, string>> = {};
  if (!input.name) errors.name = '이름을 입력해야 함';
  if (!SLUG_PATTERN.test(input.slug)) errors.slug = '영문 소문자·숫자·하이픈만 사용 (예: spring-boot)';
  if (input.synonyms.length > MAX_SYNONYMS) errors.synonyms = `동의어는 최대 ${MAX_SYNONYMS}개`;

  const save = useMutation({
    mutationFn: () => (tag ? updateTag(tag.id, input) : createTag(input)),
    onSuccess: onSaved,
  });
  const server = fieldErrorMap(save.error);
  const show = (key: keyof TagInput) => (submitted ? errors[key] : undefined) ?? server[key];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length === 0) save.mutate();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div>
        <TextField
          label="태그 이름"
          value={name}
          maxLength={50}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(toSlug(e.target.value));
          }}
          className="h-9"
        />
        <FieldError message={show('name')} />
      </div>
      <div>
        <TextField
          label="slug"
          value={slug}
          maxLength={60}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          className="h-9"
        />
        <FieldError message={show('slug')} />
      </div>
      <TextField label="분류 (선택)" value={category} maxLength={30} onChange={(e) => setCategory(e.target.value)} className="h-9" />
      <div>
        <TextField
          label="동의어 (쉼표로 구분)"
          value={synonyms}
          onChange={(e) => setSynonyms(e.target.value)}
          placeholder="k8s, 쿠버네티스"
          className="h-9"
        />
        <FieldError message={show('synonyms')} />
      </div>
      {tag === null && <p className="text-xs text-fg-muted">기존 글에는 전체 재태깅을 실행해야 반영됨</p>}
      {save.isError && Object.keys(server).length === 0 && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage(save.error)}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outlined" width={72} height={36} content="취소" onClick={onClose} />
        <Button
          type="submit"
          width={72}
          height={36}
          className="bg-brand text-white"
          disabled={save.isPending}
          content={save.isPending ? '저장 중' : '저장'}
        />
      </div>
    </form>
  );
}

export function TagFormModal({ tag, open, onClose, onSaved }: TagFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={tag ? '태그 수정' : '태그 추가'}>
      <TagForm key={tag?.id ?? 'new'} tag={tag} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
