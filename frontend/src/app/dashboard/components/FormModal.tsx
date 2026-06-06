"use client";

import { ReactNode } from "react";
import Modal, { ModalHeader, ModalFooter, ModalBtn } from "./Modal";

interface FormModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  cancelLabel?: string;
  width?: number;
  children: ReactNode;
}

/**
 * A pre-wired form modal.
 * Wraps children in a <form> and wires submit to onSubmit.
 * Footer has Cancel (ghost) + Submit (primary) buttons.
 */
export default function FormModal({
  open,
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  width = 500,
  children,
}: FormModalProps) {
  return (
    <Modal open={open} onClose={onClose} width={width}>
      <ModalHeader title={title} subtitle={subtitle} onClose={onClose} />

      <form onSubmit={onSubmit}>
        {/* Body */}
        <div className="px-7 py-6 space-y-5">{children}</div>

        <ModalFooter>
          <ModalBtn type="button" variant="ghost" onClick={onClose}>
            {cancelLabel}
          </ModalBtn>
          <ModalBtn type="submit" variant="primary">
            {submitLabel}
          </ModalBtn>
        </ModalFooter>
      </form>
    </Modal>
  );
}

/* Shared form field primitives */
interface FieldProps {
  label: string;
  children: ReactNode;
}

export function FormField({ label, children }: FieldProps) {
  return (
    <div>
      <label
        className="block text-sm font-medium mb-1.5"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputCls = "w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--accent)]/30";
export const inputStyle: React.CSSProperties = {
  background: "var(--bg-base)",
  border: "1px solid var(--bg-border)",
  color: "var(--text-primary)",
};
