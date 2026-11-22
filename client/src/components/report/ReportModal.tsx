import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Button } from '@onyx/components/button/button';
import { ApiError } from '@/api/http';
import { createReport, REPORT_DETAIL_MAX } from '@/api/community';
import type { ReportReason, ReportTargetType } from '@/api/types';
import { FieldError } from '@/components/common/FieldError';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { cn } from '@/lib/cn';
import { REPORT_REASONS } from '@/lib/community';
import { formatNumber } from '@/lib/format';

export interface ReportTargetRef {
  type: ReportTargetType;
  id: number;
}

interface ReportModalProps {
  target: ReportTargetRef | null;
  onClose: () => void;
  onReported: (target: ReportTargetRef) => void;
}

export function reportErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'REPORT_DUPLICATED') return '이미 신고했어요';
    if (error.code === 'REPORT_OWN_CONTENT') return '내 글이나 댓글은 신고할 수 없어요';
    if (error.code === 'NOT_FOUND') return '이미 삭제된 글이나 댓글이에요';
    if (error.code === 'VALIDATION_FAILED') return error.body.fieldErrors?.[0]?.message ?? error.message;
    return error.message;
  }
  return '신고하지 못했어요. 잠시 후 다시 시도해 주세요';
}

export function ReportModal({ target, onClose, onReported }: ReportModalProps) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const detailId = useId();
  const trimmed = detail.trim();

  useEffect(() => {
    if (target) {
      setReason(null);
      setDetail('');
    }
  }, [target]);

  const run = useMutation({
    mutationFn: (t: ReportTargetRef) =>
      createReport({ targetType: t.type, targetId: t.id, reason: reason!, detail: reason === 'OTHER' ? trimmed : undefined }),
    onSuccess: (_, t) => {
      toast('신고했어요. 관리자가 확인할게요');
      onReported(t);
      onClose();
    },
    onError: (error, t) => {
      if (error instanceof ApiError && error.code === 'REPORT_DUPLICATED') {
        onReported(t);
        onClose();
        toast('이미 신고했어요');
      }
    },
  });

  const detailInvalid = reason === 'OTHER' && (trimmed.length < 1 || trimmed.length > REPORT_DETAIL_MAX);
  const close = () => {
    run.reset();
    onClose();
  };
  const message = run.isError && !(run.error instanceof ApiError && run.error.code === 'REPORT_DUPLICATED') ? reportErrorMessage(run.error) : undefined;

  return (
    <Modal open={target !== null} onClose={close} title={target?.type === 'POST' ? '글 신고' : '댓글 신고'}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (target && reason && !detailInvalid) run.mutate(target);
        }}
      >
        <fieldset>
          <legend className="mb-2 text-sm text-fg-secondary">신고 사유를 골라 주세요. 서로 다른 3명이 신고하면 바로 숨겨져요.</legend>
          <div className="space-y-1">
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-hover">
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-[var(--color-inverse)]"
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        {reason === 'OTHER' && (
          <div className="mt-2">
            <label htmlFor={detailId} className="sr-only">
              기타 사유
            </label>
            <textarea
              id={detailId}
              value={detail}
              maxLength={REPORT_DETAIL_MAX}
              rows={3}
              placeholder="어떤 문제인지 적어 주세요"
              onChange={(e) => setDetail(e.target.value)}
              className="w-full resize-none rounded-[var(--radius-sm)] border border-line bg-input px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
            />
            <p className={cn('text-right text-xs tabular-nums', trimmed.length > REPORT_DETAIL_MAX ? 'text-danger' : 'text-fg-muted')}>
              {formatNumber(trimmed.length)}/{REPORT_DETAIL_MAX}
            </p>
          </div>
        )}
        <FieldError message={message} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outlined" width={64} height={36} content="취소" onClick={close} />
          <Button
            type="submit"
            width={72}
            height={36}
            className="rounded-full bg-danger text-on-danger"
            content={run.isPending ? '보내는 중' : '신고하기'}
            disabled={!reason || detailInvalid || run.isPending}
          />
        </div>
      </form>
    </Modal>
  );
}
