import type { ReactNode } from 'react';
import { Button } from '@onyx/components/button/button';
import { Modal } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({ open, title, children, confirmLabel, danger, pending, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-fg-secondary">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outlined" width={72} height={36} content="취소" onClick={onClose} />
        <Button
          width={88}
          height={36}
          disabled={pending}
          className={danger ? 'bg-red-600 text-white' : 'bg-brand text-white'}
          content={confirmLabel}
          onClick={onConfirm}
        />
      </div>
    </Modal>
  );
}
