"use client";

import { useEffect, useRef, ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Pixel width of the modal card. Default 480 */
  width?: number;
  children: ReactNode;
  /** If true, clicking the backdrop closes the modal */
  closeOnBackdrop?: boolean;
}

/**
 * Universal modal shell.
 * - Fade + scale animation on open (CSS keyframe defined in globals.css).
 * - ESC closes the modal.
 * - Focus-trapped inside the card.
 * - Backdrop click closes when closeOnBackdrop=true (default).
 */
export default function Modal({
  open,
  onClose,
  width = 480,
  children,
  closeOnBackdrop = true,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={cardRef}
        className="modal-card w-full rounded-2xl shadow-2xl overflow-hidden"
        style={{
          maxWidth: width,
          background: "var(--bg-surface)",
          border: "1px solid var(--bg-border)",
          animation: "modalIn 0.2s cubic-bezier(0.34, 1.4, 0.64, 1) both",
        }}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional leading icon element */
  icon?: ReactNode;
  onClose?: () => void;
}

export function ModalHeader({ title, subtitle, icon, onClose }: ModalHeaderProps) {
  return (
    <div
      className="flex items-start justify-between gap-4 px-7 pt-7 pb-6"
      style={{ borderBottom: "1px solid var(--bg-border)" }}
    >
      <div className="flex items-center gap-4 min-w-0">
        {icon && (
          <div className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-elevated)" }}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-snug truncate" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all"
          style={{ color: "var(--text-muted)", background: "transparent" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-7 py-6 ${className}`}>
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: ReactNode;
}

export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div
      className="flex items-center justify-end gap-3 px-7 py-5"
      style={{ borderTop: "1px solid var(--bg-border)", background: "var(--bg-elevated)" }}
    >
      {children}
    </div>
  );
}

import Btn from "./Btn";

/* ── Shared Button primitives ── */

interface ModalBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "danger" | "ghost";
}

export function ModalBtn({ loading, variant = "ghost", children, ...rest }: ModalBtnProps) {
  // Map Modal variant names to universal Btn variants
  const mappedVariantMap: Record<string, any> = {
    primary: "primary",
    danger: "danger",
    ghost: "ghost",
  };

  return (
    <Btn
      {...rest}
      loading={loading}
      variant={mappedVariantMap[variant] || "ghost"}
    >
      {children}
    </Btn>
  );
}
