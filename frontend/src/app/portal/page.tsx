"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.foxnoc360.com/api/v1";

interface Device {
  id: string;
  name: string;
  ip_address: string;
  location?: string;
  status: string;
  customer_name?: string;
}

interface CustomerInfo {
  id: string;
  name: string;
  contact_email: string;
  devices: Device[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    up:          { label: "Online",  color: "#22c55e", bg: "rgba(34,197,94,0.12)",   dot: "#22c55e" },
    down:        { label: "Offline", color: "#ef4444", bg: "rgba(239,68,68,0.12)",   dot: "#ef4444" },
    unknown:     { label: "Unknown", color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  dot: "#f59e0b" },
    maintenance: { label: "Maintenance", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", dot: "#8b5cf6" },
  };
  const s = map[status] ?? map["unknown"];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: s.color, background: s.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

export default function CustomerPortalPage() {
  const [email, setEmail]       = useState("");
  const [info, setInfo]         = useState<CustomerInfo | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [searched, setSearched] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo(null);
    setSearched(true);

    try {
      const res = await fetch(`${API_BASE}/portal/status?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
      } else if (res.status === 404) {
        setError("No account found for this email address.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Unable to reach the server. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const upCount   = info?.devices.filter(d => d.status === "up").length ?? 0;
  const downCount = info?.devices.filter(d => d.status === "down").length ?? 0;
  const totalCount = info?.devices.length ?? 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-8 py-4 border-b"
        style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-sm" style={{ background: "white" }}>
            <img src="/logo.png" alt="FoxNOC360" className="w-full h-full object-contain p-1" />
          </div>
          <span className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
            FoxNOC360 Customer Portal
          </span>
        </div>
        <a
          href="/login"
          className="text-sm font-medium px-4 py-2 rounded-xl transition-all"
          style={{ color: "var(--accent)" }}
        >
          ISP Admin Login →
        </a>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          {/* Title */}
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 text-3xl shadow-lg"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}
            >
              📡
            </div>
            <h1 className="text-[22px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Service Status
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Enter your registered email to check your device and connection status.
            </p>
          </div>

          {/* Search Form */}
          <form
            onSubmit={handleLookup}
            className="flex gap-3 mb-6"
          >
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--bg-border)",
                color: "var(--text-primary)",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--bg-border)")}
            />
            <button
              type="submit"
              disabled={loading}
              className="text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all disabled:opacity-60"
              style={{ background: "var(--accent)" }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = "var(--accent-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Checking…
                </span>
              ) : "Check Status"}
            </button>
          </form>

          {/* Error */}
          {searched && error && (
            <div
              className="rounded-xl px-4 py-3 text-sm text-center mb-6"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}
            >
              {error}
            </div>
          )}

          {/* Results */}
          {info && (
            <div className="space-y-4">
              {/* Customer chip */}
              <div
                className="rounded-2xl p-5 flex items-center gap-4"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                  style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}
                >
                  {info.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{info.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{info.contact_email}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg" style={{ color: upCount === totalCount ? "#22c55e" : "#f59e0b" }}>
                    {totalCount > 0 ? `${Math.round((upCount / totalCount) * 100)}%` : "—"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Uptime</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Devices", value: totalCount, color: "var(--text-primary)" },
                  { label: "Online",  value: upCount,   color: "#22c55e" },
                  { label: "Offline", value: downCount, color: "#ef4444" },
                ].map(s => (
                  <div
                    key={s.label}
                    className="rounded-xl p-4 text-center"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}
                  >
                    <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Devices list */}
              {info.devices.length > 0 ? (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ border: "1px solid var(--bg-border)", background: "var(--bg-surface)" }}
                >
                  <div
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ borderBottom: "1px solid var(--bg-border)", color: "var(--text-muted)" }}
                  >
                    Your Devices
                  </div>
                  {info.devices.map((device, i) => (
                    <div
                      key={device.id}
                      className="px-5 py-4 flex items-center justify-between"
                      style={{
                        borderBottom: i < info.devices.length - 1 ? "1px solid var(--bg-border)" : "none",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                          style={{ background: "var(--bg-elevated)" }}
                        >
                          🖧
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {device.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {device.ip_address}{device.location ? ` · ${device.location}` : ""}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={device.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-xl px-4 py-6 text-center text-sm"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)", color: "var(--text-muted)" }}
                >
                  No devices registered under your account yet.
                </div>
              )}

              {/* Footer note */}
              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                For support, contact your Internet Service Provider.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer
        className="text-center py-4 text-xs"
        style={{ color: "var(--text-muted)", borderTop: "1px solid var(--bg-border)" }}
      >
        Powered by FoxNOC360 · ISP Monitoring Platform
      </footer>
    </div>
  );
}
