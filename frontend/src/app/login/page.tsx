"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", password);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || "Login failed. Check your credentials.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError("Login timed out. Is the backend server responding?");
      } else {
        setError("Network error. Make sure the backend is reachable at " + API_BASE);
      }
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
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--text-primary)" }}>FoxNOC360</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>ISP SLA Monitoring Platform</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-2xl transition-colors" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
          <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Sign in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
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
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Password</label>
                <a href="/forgot-password" className="text-sm transition-colors hover:opacity-80" style={{ color: "var(--accent)" }}>Forgot Password?</a>
              </div>
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

            {error && (
              <div className="border text-sm rounded-lg px-4 py-3" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-3 rounded-xl transition-all mt-2"
              style={{ background: "var(--accent)" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
