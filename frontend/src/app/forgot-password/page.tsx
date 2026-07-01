"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.foxnoc360.com/api/v1";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || "Request failed. Please try again.");
        return;
      }

      setMessage("If an account with that email exists, a reset link has been sent.");
      setEmail("");
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
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--text-primary)" }}>Forgot Password</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Enter your email to receive a reset link</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-2xl transition-colors" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@foxnoc360.com"
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
              disabled={loading}
              className="w-full text-white font-semibold py-3 rounded-xl transition-all mt-2 disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            
            <div className="text-center mt-4">
                <a href="/login" className="text-sm transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
                    &larr; Back to Login
                </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
