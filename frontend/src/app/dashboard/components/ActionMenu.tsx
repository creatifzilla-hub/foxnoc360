"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Btn from "./Btn";

interface Action {
  label: string;
  onClick: () => void;
  variant?: "danger" | "default" | "success" | "warning";
  disabled?: boolean;
}

interface ActionMenuProps {
  actions: Action[];
}

export default function ActionMenu({ actions }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
    } else {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        setCoords({
          top: rect.bottom,
          left: rect.right,
        });
      }
      setIsOpen(true);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", () => setIsOpen(false));
      window.addEventListener("resize", () => setIsOpen(false));
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", () => setIsOpen(false));
      window.removeEventListener("resize", () => setIsOpen(false));
    };
  }, [isOpen]);

  const menuContent = isOpen && (
    <div
      ref={menuRef}
      className="fixed w-36 origin-top-right rounded-xl shadow-lg ring-1 transition-all z-[9999]"
      style={{
        top: `${coords.top + 4}px`,
        left: `${coords.left - 144}px`, // 144 is w-36 width
        background: "var(--bg-surface)",
        borderColor: "var(--bg-border)",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div className="py-1">
        {actions.map((action, idx) => (
          <button
            key={idx}
            disabled={action.disabled}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (action.disabled) return;
              action.onClick();
              setIsOpen(false);
            }}
            className={`block w-full text-left px-4 py-2 text-sm transition-colors ${action.disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            style={{
              color: action.variant === "danger" 
                ? "#ef4444" 
                : action.variant === "success" 
                ? "#22c55e" 
                : action.variant === "warning"
                ? "#eab308"
                : "var(--text-primary)"
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Btn
        as="button"
        ref={buttonRef}
        onClick={toggleMenu}
        variant="ghost"
        size="sm"
        className="!p-1.5 !rounded-lg"
        title="Actions"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" style={{ color: "var(--text-secondary)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
        </svg>
      </Btn>
      {typeof document !== "undefined" && createPortal(menuContent, document.body)}
    </>
  );
}
