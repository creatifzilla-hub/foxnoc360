"use client";

import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBtn } from "./Modal";

type Variant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantIcons: Record<Variant, React.ReactNode> = {
  danger: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" className="w-5 h-5">
      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" className="w-5 h-5">
      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="var(--accent)" className="w-5 h-5">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022zM12 9a.75.75 0 1 0 0-1.5A.75.75 0 0 0 12 9z" clipRule="evenodd" />
    </svg>
  ),
};

const variantIconBg: Record<Variant, string> = {
  danger:  "rgba(239,68,68,0.1)",
  warning: "rgba(245,158,11,0.1)",
  info:    "rgba(255,95,0,0.1)",
};

const variantBtnType: Record<Variant, "danger" | "primary"> = {
  danger:  "danger",
  warning: "danger",
  info:    "primary",
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} width={460}>
      <ModalHeader
        title={title}
        icon={
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: variantIconBg[variant] }}
          >
            {variantIcons[variant]}
          </div>
        }
        onClose={onCancel}
      />

      <ModalBody>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
      </ModalBody>

      <ModalFooter>
        <ModalBtn variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </ModalBtn>
        <ModalBtn variant={variantBtnType[variant]} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </ModalBtn>
      </ModalFooter>
    </Modal>
  );
}
