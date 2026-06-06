"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size    = "sm" | "md" | "lg";

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  /** Makes the button take full width */
  block?: boolean;
  /** Element to render as (default: 'button') */
  as?: any;
  [key: string]: any;
}

const variantMap: Record<Variant, { base: string; style: React.CSSProperties; hover: React.CSSProperties }> = {
  primary: {
    base: "text-white font-semibold",
    style: { background: "var(--accent)", color: "#fff" },
    hover: { filter: "brightness(1.1)" },
  },
  secondary: {
    base: "font-semibold",
    style: { background: "var(--bg-surface)", color: "var(--text-primary)", border: "1.5px solid var(--bg-border)" },
    hover: { background: "var(--bg-elevated)" },
  },
  danger: {
    base: "text-white font-semibold",
    style: { background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", boxShadow: "0 4px 12px rgba(239,68,68,.25)" },
    hover: { filter: "brightness(1.08)" },
  },
  ghost: {
    base: "font-medium",
    style: { background: "transparent", color: "var(--text-secondary)", border: "1.5px solid var(--bg-border)" },
    hover: { background: "var(--bg-base)" },
  },
};

const sizeMap: Record<Size, string> = {
  sm:  "text-xs   px-3.5  py-1.5   gap-1.5 rounded-xl",
  md:  "text-sm   px-4.5  py-2.5   gap-2   rounded-xl",
  lg:  "text-sm   px-5    py-3     gap-2   rounded-2xl",
};

/**
 * Standard CTA button for the entire product.
 * Accepts `variant`, `size`, `icon`, `loading`, and `block` props.
 * All other <button> props (onClick, disabled, type, etc.) are forwarded.
 */
export default function Btn({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  block = false,
  as: Component = "button",
  children,
  disabled,
  className = "",
  ...rest
}: BtnProps) {
  const v = variantMap[variant];
  const isDisabled = disabled || loading;

  return (
    <Component
      {...rest}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center",
        sizeMap[size],
        v.base,
        "transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
        isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95",
        block ? "w-full" : "",
        className,
      ].join(" ")}
      style={v.style}
      onMouseEnter={!isDisabled ? (e: any) => Object.assign(e.currentTarget.style, v.hover) : undefined}
      onMouseLeave={!isDisabled ? (e: any) => Object.assign(e.currentTarget.style, v.style) : undefined}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0 w-4 h-4 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      ) : null}
      {children && <span className="leading-none">{children}</span>}
    </Component>
  );
}

/* ── Shared SVG icons used in CTAs ────────────────────────── */
export const BtnIcons = {
  plus: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5z" />
    </svg>
  ),
  download: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
    </svg>
  ),
  upload: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0L5.205 6.735a.75.75 0 0 0 1.09 1.03L9.25 4.636v8.614z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
    </svg>
  ),
  share: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.475l6.733-3.366A2.52 2.52 0 0 1 13 4.5z" />
    </svg>
  ),
  refresh: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
    </svg>
  ),
  generate: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06Zm9.9 0a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.06a.75.75 0 0 1 1.06 0ZM3 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 8Zm11 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 14 8Zm-6.828 2.828a.75.75 0 0 1 0 1.061L6.11 12.95a.75.75 0 0 1-1.06-1.06l1.06-1.062a.75.75 0 0 1 1.061 0Zm3.594-3.317a.75.75 0 0 1 1.06.01l3.25 3.25a.75.75 0 1 1-1.06 1.06l-2.088-2.088-2.576 2.576a.75.75 0 0 1-1.06-1.06l3.474-3.748Z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
    </svg>
  ),
  trash: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
    </svg>
  ),
  check: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
    </svg>
  ),
};
