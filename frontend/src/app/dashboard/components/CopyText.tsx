"use client";

import { useState } from "react";

interface CopyTextProps {
  value: string;
  display?: string;
  className?: string;
}

export default function CopyText({ value, display, className }: CopyTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 group/copy ${className ?? ""}`}>
      <span>{display ?? value}</span>
      <button
        onClick={handleCopy}
        title={copied ? "Copied!" : `Copy ${value}`}
        className="opacity-0 group-hover/copy:opacity-60 hover:!opacity-100 transition-opacity flex-shrink-0"
        style={{ color: copied ? "#34d399" : "var(--text-muted)", lineHeight: 1 }}
      >
        {copied ? (
          // Checkmark icon
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 8 6 12 14 4" />
          </svg>
        ) : (
          // Copy icon
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="5" width="9" height="9" rx="1.5" />
            <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
          </svg>
        )}
      </button>
    </span>
  );
}
