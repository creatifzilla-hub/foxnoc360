"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || "Failed to reset password. The link might be expired.");
        return;
      }

      setMessage("Password successfully reset! You can now log in with your new password.");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError("Network error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 transition-colors" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 overflow-hidden shadow-lg" style={{ background: "white", padding: "8px" }}>
            <img src="/logo.png" alt="FoxNOC360" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--text-primary)" }}>Set New Password</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Choose a new password for your account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-2xl transition-colors" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
          {(!token && error) ? (
             <div className="border text-sm rounded-lg px-4 py-3 text-center" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}>
               {error}
             </div>
          ) : (
             <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>New Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 outline-none transition-all"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 outline-none transition-all"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                />
              </div>

              {error && (
                <div className="border text-sm rounded-lg px-4 py-3" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}>
                  {error}
                </div>
              )}
              
              {message && (
                <div className="border text-sm rounded-lg px-4 py-3" style={{ background: "rgba(34, 197, 94, 0.1)", borderColor: "rgba(34, 197, 94, 0.2)", color: "#22c55e" }}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !!message}
                className="w-full text-white font-semibold py-3 rounded-xl transition-all mt-2 disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}

          <div className="text-center mt-6">
              <a href="/login" className="text-sm transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
                  &larr; Back to Login
              </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
