"use client";

import { useEffect } from "react";
import { useRole } from "../hooks/useRole";
import Btn from "./components/Btn";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { isSuperadmin, loading } = useRole();

  useEffect(() => {
    // Log the error for our own internal monitoring if needed
    console.error("Dashboard Runtime Error:", error);
  }, [error]);

  if (loading) return null;

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center" style={{ background: "var(--bg-base)" }}>
       <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
       </div>
       <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
       <p className="text-sm opacity-60 mb-8 max-w-md">Our team has been notified. Please try refreshing the page or contact support if the issue persists.</p>
       
       <div className="flex gap-3">
          <Btn variant="primary" onClick={() => reset()}>Try Again</Btn>
          <Btn variant="secondary" onClick={() => window.location.href = '/dashboard'}>Return Home</Btn>
       </div>

       {isSuperadmin && (
          <div className="mt-12 w-full max-w-2xl text-left p-4 rounded-xl border font-mono text-[10px] overflow-auto max-h-64" style={{ background: "var(--bg-elevated)", borderColor: "var(--bg-border)", color: "#f87171" }}>
             <div className="font-bold uppercase tracking-widest mb-2 opacity-50">Log for Superadmin ONLY</div>
             <div className="whitespace-pre-wrap">{error.stack || error.message}</div>
          </div>
       )}
    </div>
  );
}
