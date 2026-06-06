"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const value = {
    toast: addToast,
    success: (msg: string) => addToast(msg, "success"),
    error: (msg: string) => addToast(msg, "error"),
    info: (msg: string) => addToast(msg, "info"),
    warning: (msg: string) => addToast(msg, "warning"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border pointer-events-auto animate-in slide-in-from-right-10 duration-300"
            style={{ 
                background: "var(--bg-surface)", 
                borderColor: "var(--bg-border)",
                maxWidth: "320px",
                minWidth: "260px"
            }}
          >
            <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{ 
                background: t.type === 'success' ? '#22c55e10' : t.type === 'error' ? '#ef444410' : '#3b82f610',
                color: t.type === 'success' ? '#22c55e' : t.type === 'error' ? '#ef4444' : '#3b82f6'
            }}>
                {t.type === 'success' && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                )}
                {t.type === 'error' && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                )}
                {(t.type === 'info' || t.type === 'warning') && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )}
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t.message}</p>
            </div>
            <button 
                onClick={() => removeToast(t.id)}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg opacity-40 hover:opacity-100 transition-opacity"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
