"use client";

import { useEffect, useState } from "react";
import CopyText from "./CopyText";
import { Icons } from "./Sidebar";
import { useRole } from "../../hooks/useRole";
import ActionMenu from "./ActionMenu";
import ResetSLAModal from "./ResetSLAModal";
import Btn, { BtnIcons } from "./Btn";

interface Device {
  id: string;
  device_name: string;
  ip_address: string;
  latest_status: string;
  last_checked: string;
  latency_ms: number | null;
  packet_loss: number | null;
  tenant_name?: string;
  customer_name?: string;
}

interface Interface {
    if_index: number;
    name: string;
    description: string;
    is_monitored: boolean;
    is_wan: boolean;
}

interface Props {
  statusFilter?: "all" | "up" | "down" | "unknown";
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function DevicesTable({ statusFilter = "all" }: Props) {
  const { isSuperadmin } = useRole();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Device; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showConfig, setShowConfig] = useState<{id: string, name: string} | null>(null);
  const [interfaces, setInterfaces] = useState<Interface[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);

  // SLA Reset State
  const [resetModalOpen, setResetModalOpen] = useState<{ id: string, name: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/monitoring/devices-table`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDevices(await res.json());
    } catch (err) {
      console.error("Failed to fetch devices", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Interfaces for discovery
  const handleDiscover = async (deviceId: string, deviceName: string) => {
    setShowConfig({ id: deviceId, name: deviceName });
    setDiscovering(true);
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/snmp/discover/${deviceId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            // Convert to matching schema
            setInterfaces(data);
        }
    } catch (e) { console.error(e); }
    finally { setDiscovering(false); }
  };

  const handleSaveInterfaces = async () => {
      if (!showConfig) return;
      setSaving(true);
      try {
          const token = localStorage.getItem("token");
          await fetch(`${API_BASE}/snmp/interfaces/${showConfig.id}`, {
              method: "POST",
              headers: { 
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json"
               },
              body: JSON.stringify({
                  interfaces: interfaces.map(i => ({
                      if_index: i.if_index,
                      is_monitored: i.is_monitored,
                      is_wan: i.is_wan
                  }))
              })
          });
          setShowConfig(null);
      } catch (e) { console.error(e); }
      finally { setSaving(false); }
  };

  const handleResetSLA = async (ids: string[] | null) => {
      if (!resetModalOpen) return;
      setResetting(true);
      try {
          const token = localStorage.getItem("token");
          // Row level reset usually passes one ID, but we support the new style
          const devId = ids && ids.length > 0 ? ids[0] : resetModalOpen.id;
          const res = await fetch(`${API_BASE}/sla/reset?device_id=${devId}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
              setResetModalOpen(null);
          } else {
              const data = await res.json().catch(() => ({}));
              alert(data.detail || "Failed to reset SLA data.");
          }
      } catch (e) {
          console.error(e);
          alert("Network error while resetting SLA data.");
      } finally {
          setResetting(false);
      }
  };

  const toggleIface = (idx: number, field: "is_monitored" | "is_wan") => {
      setInterfaces(prev => prev.map(i => {
          if (i.if_index !== idx) {
              if (field === "is_wan") return { ...i, is_wan: false }; // Only 1 WAN
              return i;
          }
          return { ...i, [field]: !i[field], is_monitored: field === "is_wan" ? true : !i[field] };
      }));
  };

  let filtered = statusFilter === "all"
    ? [...devices]
    : devices.filter((d) => {
        const status = d.latest_status || "unknown";
        return status === statusFilter;
      });

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(d => 
      d.device_name.toLowerCase().includes(q) ||
      (d.tenant_name && d.tenant_name.toLowerCase().includes(q)) ||
      (d.customer_name && d.customer_name.toLowerCase().includes(q))
    );
  }

  if (sortConfig !== null) {
    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginated = totalRows > 10 ? filtered.slice(startIndex, startIndex + pageSize) : filtered;
  const showPagination = totalRows > 10;

  const handleSort = (key: keyof Device) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const goTo = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  if (loading) {
    return (
      <div className="rounded-xl p-8 text-center text-sm" style={{ background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--bg-border)" }}>
        Loading devices...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl shadow-sm flex flex-col" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
      {/* Table Header with Search */}
      <div className="p-4 border-b flex items-center justify-between gap-4" style={{ borderColor: "var(--bg-border)" }}>
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </span>
          <input 
            type="text"
            placeholder="Search by device, tenant, or customer..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to page 1 on search
            }}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-sm outline-none transition-all border-2 focus:border-accent"
            style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="text-xs font-bold uppercase tracking-widest opacity-40">
          Showing {filtered.length} of {devices.length}
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm">
          <thead style={{ background: "var(--bg-elevated)", borderBottom: "1px solid rgba(128, 128, 128, 0.15)" }}>
            <tr>
              {[
                { label: "Device Name", key: "device_name" as keyof Device },
                // Only show Tenant and Customer columns for superadmins
                ...(isSuperadmin ? [
                  { label: "ISP Tenant", key: "tenant_name" as keyof Device },
                  { label: "Customer", key: "customer_name" as keyof Device }
                ] : []),
                { label: "IP Address", key: "ip_address" as keyof Device },
                { label: "Status", key: "latest_status" as keyof Device },
                { label: "Latency", key: "latency_ms" as keyof Device },
                { label: "Packet Loss", key: "packet_loss" as keyof Device },
                { label: "Last Checked", key: "last_checked" as keyof Device },
              ].map((h) => (
                <th
                  key={h.key}
                  onClick={() => handleSort(h.key)}
                  className="px-6 py-4 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group"
                  style={{ color: "var(--text-muted)" }}
                >
                  <div className="flex items-center gap-1.5">
                    {h.label}
                    <span className="transition-colors" style={{ color: sortConfig?.key === h.key ? "var(--accent)" : "var(--text-muted)", opacity: sortConfig?.key === h.key ? 1 : 0.4 }}>
                      {sortConfig?.key === h.key
                        ? (sortConfig.direction === "asc" ? "↑" : "↓")
                        : "↕"}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right" style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((device) => (
              <tr
                key={device.id}
                className="transition-colors group"
                style={{ borderBottom: "1px solid rgba(128, 128, 128, 0.15)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td className="px-6 py-4 font-semibold" style={{ color: "var(--text-primary)" }}>
                  {device.device_name}
                </td>
                {isSuperadmin && (
                  <>
                    <td className="px-6 py-4 text-xs font-bold" style={{ color: "var(--accent)" }}>
                      {device.tenant_name || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      {device.customer_name || "N/A"}
                    </td>
                  </>
                )}
                <td className="px-6 py-4 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                  <CopyText value={device.ip_address} />
                </td>
                <td className="px-6 py-4">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={
                      device.latest_status === "up"
                        ? { background: "rgba(52,211,153,0.12)", color: "#34d399" }
                        : device.latest_status === "down"
                        ? { background: "rgba(251,113,133,0.12)", color: "#fb7185" }
                        : { background: "rgba(156,163,175,0.12)", color: "var(--text-muted)" }
                    }
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background:
                          device.latest_status === "up" ? "#34d399"
                          : device.latest_status === "down" ? "#fb7185"
                          : "var(--text-muted)",
                      }}
                    />
                    {device.latest_status ? device.latest_status.toUpperCase() : "UNKNOWN"}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
                  {device.latency_ms != null ? `${Number(device.latency_ms).toFixed(1)} ms` : "---"}
                </td>
                <td className="px-6 py-4 font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
                  {device.packet_loss != null ? `${Number(device.packet_loss).toFixed(1)}%` : "0.0%"}
                </td>
                <td className="px-6 py-4 text-xs" style={{ color: "var(--text-muted)" }}>
                  {device.last_checked ? new Date(device.last_checked).toLocaleTimeString() : "Never"}
                </td>
                <td className="px-6 py-4 text-right">
                  <ActionMenu
                     actions={[
                       { label: "Reset SLA Data", onClick: () => setResetModalOpen({ id: device.id, name: device.device_name }), variant: "danger" }
                     ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Discovery & Config Modal ───────────────────────── */}
      {showConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-surface w-full max-w-4xl max-h-[80vh] rounded-[2rem] border overflow-hidden shadow-2xl flex flex-col" style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}>
                  <div className="p-8 border-b flex items-center justify-between" style={{ borderColor: "var(--bg-border)" }}>
                      <div>
                          <h2 className="text-2xl font-black">SNMP Interface Discovery</h2>
                          <p className="text-sm opacity-40 font-bold uppercase tracking-widest">{showConfig.name}</p>
                      </div>
                      <button onClick={() => setShowConfig(null)} className="p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/5 opacity-40 hover:opacity-100 transition-all">✕</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8">
                      {discovering ? (
                          <div className="flex flex-col items-center justify-center py-20 gap-4">
                              <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                              <p className="font-black uppercase tracking-widest text-xs opacity-40">Walking ifTable...</p>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-40 mb-6">Found {interfaces.length} Interfaces</p>
                              <div className="grid grid-cols-1 gap-2">
                                  {interfaces.map(i => (
                                      <div key={i.if_index} className="flex items-center justify-between p-4 rounded-2xl border hover:border-accent/40 transition-all bg-black/5 dark:bg-white/5" style={{ borderColor: "var(--bg-border)" }}>
                                          <div className="flex items-center gap-4">
                                              <span className="text-xs font-mono opacity-30 w-8">{i.if_index}</span>
                                              <div>
                                                  <p className="font-bold text-sm">{i.name}</p>
                                                  <p className="text-[10px] opacity-40">{i.description || "N/A"}</p>
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <button 
                                                onClick={() => toggleIface(i.if_index, "is_wan")}
                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${i.is_wan ? "bg-accent text-white shadow-lg" : "opacity-30 hover:opacity-100"}`}
                                              >
                                                WAN GATEWAY
                                              </button>
                                              <button 
                                                onClick={() => toggleIface(i.if_index, "is_monitored")}
                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${i.is_monitored ? "bg-green-500 text-white shadow-lg" : "opacity-30 hover:opacity-100"}`}
                                              >
                                                {i.is_monitored ? "MONITORING" : "MONITOR"}
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-8 border-t flex justify-end gap-3" style={{ borderColor: "var(--bg-border)", background: "var(--bg-elevated)" }}>
                      <Btn variant="ghost" onClick={() => setShowConfig(null)}>Cancel</Btn>
                      <Btn 
                        variant="primary"
                        onClick={handleSaveInterfaces} 
                        loading={saving}
                      >
                          {saving ? "Saving..." : "Apply Config"}
                      </Btn>
                  </div>
              </div>
          </div>
      )}

      {resetModalOpen && (
        <ResetSLAModal
          deviceName={resetModalOpen.name}
          resetting={resetting}
          onConfirm={handleResetSLA}
          onCancel={() => setResetModalOpen(null)}
        />
      )}

      {/* ── Pagination Footer ────────────────────────────────── */}
      {showPagination && (
        <div
          className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
          style={{ borderTop: "1px solid var(--bg-border)", background: "var(--bg-elevated)" }}
        >
          {/* (Pagination logic remains same but needs to be here) */}
          <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
            <span>{startIndex + 1}–{Math.min(startIndex + pageSize, totalRows)} of {totalRows} devices</span>
          </div>
          <div className="flex items-center gap-1">
             <Btn size="sm" variant="ghost" onClick={() => goTo(1)} disabled={safePage === 1}>««</Btn>
             <Btn size="sm" variant="ghost" onClick={() => goTo(safePage - 1)} disabled={safePage === 1}>‹</Btn>
             <span className="px-4 text-xs font-bold opacity-40">Page {safePage} of {totalPages}</span>
             <Btn size="sm" variant="ghost" onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages}>›</Btn>
             <Btn size="sm" variant="ghost" onClick={() => goTo(totalPages)} disabled={safePage === totalPages}>»»</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
