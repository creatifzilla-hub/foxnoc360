"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "../components/Sidebar";
import { useSubscription } from "../../hooks/useSubscription";
import { useRole } from "../../hooks/useRole";
import ActionMenu from "../components/ActionMenu";
import ResetSLAModal from "../components/ResetSLAModal";
import Btn, { BtnIcons } from "../components/Btn";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.foxnoc360.com/api/v1";

interface Device {
  id: string;
  name: string;
  ip_address: string;
  status: string;
}

interface SLAReportResponse {
  device_id: string;
  uptime_percentage: number;
  total_downtime_seconds: number;
  incident_count: number;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  avg_latency: number;
  max_latency: number;
  avg_packet_loss: number;
  is_compliant: boolean;
  incidents: {
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
  }[];
}
interface GeneratedReport {
  id: string;
  name: string;
  deviceId: string;
  deviceName: string;
  startDate: string;
  endDate: string;
  timestamp: string;
}

export default function SLAReportsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [slaData, setSlaData] = useState<SLAReportResponse | null>(null);
  const [history, setHistory] = useState<GeneratedReport[]>([]);
  const { subscription, loading: subLoading } = useSubscription();
  const { isSuperadmin } = useRole();
  const [currentPage, setCurrentPage] = useState(1);
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });

  const isLocked = !isSuperadmin && subscription && !subscription.sla_reports && !subLoading;

  // SLA Reset State
  const [resetModalOpen, setResetModalOpen] = useState<{ id: string | "global", name: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDevices(await res.json());
    } catch (err) {
      console.error("Failed to load devices:", err);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    // Load history from localStorage
    const savedHistory = localStorage.getItem("sla_report_history");
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error("Failed to parse history", e);
        setHistory([]);
      }
    }
  }, [loadDevices]);

  const saveToHistory = (report: Omit<GeneratedReport, "id" | "timestamp">) => {
    const newHistory: GeneratedReport[] = [
      {
        ...report,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
      ...history,
    ].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem("sla_report_history", JSON.stringify(newHistory));
  };

  const deleteFromHistory = (id: string) => {
    const newHistory = history.filter((h) => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem("sla_report_history", JSON.stringify(newHistory));
  };

  const applyPreset = (preset: string) => {
    const now = new Date();
    let start = new Date();
    const end = new Date();

    switch (preset) {
      case "last7":
        start.setDate(now.getDate() - 7);
        break;
      case "last30":
        start.setDate(now.getDate() - 30);
        break;
      case "thisMonth":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end.setDate(0); // Last day of previous month
        break;
      case "last3Months":
        start.setMonth(now.getMonth() - 3);
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const fetchSLAReport = async () => {
    if (!selectedDevice || !startDate || !endDate) {
      setError("Please select a device and date range.");
      return;
    }
    setLoading(true);
    setError("");
    setSlaData(null);
    try {
      const token = localStorage.getItem("token");
      // Always use UTC-explicit ISO strings to avoid local timezone shifting the range
      const params = new URLSearchParams({
        start_date: `${startDate}T00:00:00.000Z`,
        end_date: `${endDate}T23:59:59.999Z`,
      });
      const res = await fetch(`${API_BASE}/sla/device-report/${selectedDevice}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setSlaData(data);
        const device = devices.find(d => d.id === selectedDevice);
        saveToHistory({
          name: `SLA_${device?.name || "Report"}_${startDate}_to_${endDate}`,
          deviceId: selectedDevice,
          deviceName: device?.name || "Unknown",
          startDate,
          endDate,
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Failed to fetch SLA report. Please verify connection and parameters.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Unable to connect to the monitoring server.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSLA = async (ids: string[] | null) => {
      setResetting(true);
      try {
          const token = localStorage.getItem("token");
          let url = `${API_BASE}/sla/reset`;
          if (ids && ids.length > 0) {
              url += `?device_ids=${ids.join(",")}`;
          } else if (resetModalOpen && resetModalOpen.id !== "global") {
              url += `?device_id=${resetModalOpen.id}`;
          }
              
          const res = await fetch(url, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
              alert("SLA data has been reset successfully.");
              setResetModalOpen(null);
              // optionally clear selected report if it was the one reset
              if (ids && ids.includes(selectedDevice)) {
                  setSlaData(null);
              }
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

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: string) => {
    const isSorted = sortConfig?.key === key;
    return (
      <span className="ml-1 transition-colors" style={{ color: isSorted ? "var(--accent)" : "var(--text-muted)", opacity: isSorted ? 1 : 0.4 }}>
        {isSorted ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    );
  };

  const sortedHistory = Array.isArray(history) ? [...history].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = (a as any)[sortConfig.key] || "";
    const bVal = (b as any)[sortConfig.key] || "";
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  }) : [];

  const paginatedHistory = sortedHistory.slice(0, 10);

  const downloadPDF = async (reportId?: string) => {
    let devId = selectedDevice;
    let sDate = startDate;
    let eDate = endDate;

    if (reportId) {
      const report = history.find(h => h.id === reportId);
      if (report) {
        devId = report.deviceId;
        sDate = report.startDate;
        eDate = report.endDate;
      }
    }

    if (!devId || !sDate || !eDate) return;
    
    const token = localStorage.getItem("token");
    // UTC-explicit to avoid timezone shift
    const params = new URLSearchParams({
      start_date: `${sDate}T00:00:00.000Z`,
      end_date: `${eDate}T23:59:59.999Z`,
    });

    const res = await fetch(`${API_BASE}/sla/pdf-report/${devId}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const device = devices.find(d => d.id === devId);
      a.download = `SLA_Report_${device?.name || "Export"}_${sDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert("Failed to download PDF. Please try generating the report again.");
    }
  };

  const [sharing, setSharing] = useState<string | null>(null);

  const shareReport = async (reportId?: string) => {
    let devId = selectedDevice;
    let sDate = startDate;
    let eDate = endDate;

    if (reportId) {
      const report = history.find(h => h.id === reportId);
      if (report) {
        devId = report.deviceId;
        sDate = report.startDate;
        eDate = report.endDate;
      }
    }

    if (!devId || !sDate || !eDate) return;
    
    setSharing(reportId || "current");
    try {
      const token = localStorage.getItem("token");
      // UTC-explicit to avoid timezone shift
      const params = new URLSearchParams({
        start_date: `${sDate}T00:00:00.000Z`,
        end_date: `${eDate}T23:59:59.999Z`,
      });

      const res = await fetch(`${API_BASE}/sla/share-report/${devId}?${params}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Report shared successfully!");
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Failed to share report via email.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error while sharing report.");
    } finally {
      setSharing(null);
    }
  };

  const uptimeColor = (pct: number) =>
    pct >= 99.9 ? "#22c55e" : pct >= 99.0 ? "#f59e0b" : "#ef4444";

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="flex items-center gap-3 text-[28px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              <span className="w-8 h-8 flex items-center justify-center" style={{ color: "var(--accent)" }}>{Icons.report}</span>
              SLA Reports
            </h1>
            <p className="text-sm opacity-80" style={{ color: "var(--text-secondary)" }}>
              Generate enterprise-grade uptime SLA reports and track performance history
            </p>
          </div>
          <div>
          <Btn 
            variant="danger"
            onClick={() => setResetModalOpen({ id: "global", name: "All Devices" })}
            icon={BtnIcons.warning}
            title="Reset SLA metrics for the entire scope"
          >
            Reset SLA Data
          </Btn>
          </div>
        </div>

        {isLocked && (
          <div className="rounded-3xl p-10 mb-8 text-center border shadow-2xl animate-in fade-in slide-in-from-top-6 duration-700" style={{ background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)", borderColor: "rgba(255, 95, 0, 0.3)" }}>
            <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <span className="text-5xl">🔒</span>
            </div>
            <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Premium Reporting</h2>
            <p className="max-w-lg mx-auto mb-10 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Detailed SLA uptime tracking and professional PDF reporting are reserved for our <strong>Professional</strong> and <strong>Enterprise</strong> partners. 
              Upgrade to deliver verified reliability data to your clients.
            </p>
            <div className="flex flex-col sm:flex-row gap-5 justify-center">
              <Btn
                as="a"
                href="/dashboard/subscriptions"
                variant="primary"
                size="lg"
                className="px-10 shadow-xl shadow-orange-500/30"
              >
                Explore Plans
              </Btn>
              <Btn
                variant="secondary"
                size="lg"
                className="px-10"
                onClick={() => window.history.back()}
              >
                Return to Dashboard
              </Btn>
            </div>
          </div>
        )}

        <div className={`transition-all duration-700 space-y-8 ${isLocked ? 'opacity-30 blur-[4px] pointer-events-none grayscale select-none' : ''}`}>
          {/* Main Action Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Section */}
            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-3xl p-8 shadow-xl border backdrop-blur-md" style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <span className="w-2 h-6 rounded-full bg-orange-500"></span>
                  Generate Report
                </h2>

                <div className="space-y-5">
                  {/* Device Selector */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-60">Target Device</label>
                    <select
                      value={selectedDevice}
                      onChange={(e) => setSelectedDevice(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all appearance-none cursor-pointer"
                      style={{ background: "var(--bg-base)", border: "2px solid var(--bg-border)", color: "var(--text-primary)" }}
                    >
                      <option value="">Select a device...</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.ip_address})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Presets */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-60">Quick Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "last7", label: "7 Days" },
                        { id: "last30", label: "30 Days" },
                        { id: "thisMonth", label: "This Month" },
                        { id: "lastMonth", label: "Last Month" },
                      ].map(preset => (
                        <Btn
                          key={preset.id}
                          variant="ghost"
                          size="sm"
                          onClick={() => applyPreset(preset.id)}
                        >
                          {preset.label}
                        </Btn>
                      ))}
                    </div>
                  </div>

                  {/* Custom Dates */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-60">Custom Period</label>
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none border-2 transition-all focus:border-orange-500"
                          style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                        />
                        <span className="absolute right-3 top-3.5 opacity-30 text-xs">START</span>
                      </div>
                      <div className="relative">
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none border-2 transition-all focus:border-orange-500"
                          style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                        />
                        <span className="absolute right-3 top-3.5 opacity-30 text-xs">END</span>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="text-red-400 text-xs leading-relaxed font-medium bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 animate-pulse">
                      ⚠️ {error}
                    </div>
                  )}

                  <Btn
                    variant="primary"
                    block
                    size="lg"
                    onClick={fetchSLAReport}
                    loading={loading}
                    icon={!loading ? BtnIcons.generate : undefined}
                  >
                    {loading ? "Analyzing Data..." : "Generate Report"}
                  </Btn>
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div className="lg:col-span-2">
              {!slaData && !loading && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center opacity-40" style={{ borderColor: "var(--bg-border)" }}>
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-bold mb-2">No Report Selected</h3>
                  <p className="max-w-xs text-sm">Select a device and date range then click generate to view performance metrics here.</p>
                </div>
              )}

              {loading && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--accent)", borderStyle: "solid" }}>
                  <div className="mb-6 relative">
                    <div className="w-20 h-20 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">📈</div>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Processing Monitoring Logs</h3>
                  <p className="max-w-xs text-sm" style={{ color: "var(--text-secondary)" }}>Aggregating uptime percentage and calculating latency averages...</p>
                </div>
              )}

              {slaData && !loading && (
                <div className="rounded-3xl p-8 shadow-xl border animate-in slide-in-from-right-4 duration-500 overflow-hidden relative" style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}>
                  {/* Watermark Logo */}
                  <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none select-none grayscale w-64 h-64 border-[40px] border-orange-500 rounded-full"></div>
                  
                  <div className="flex justify-between items-start mb-8 relative">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full mb-3 inline-block">Report Preview</span>
                      <h2 className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>{devices.find(d => d.id === selectedDevice)?.name}</h2>
                      <p className="text-sm opacity-60 mt-1 font-mono tracking-tighter">
                        {startDate} → {endDate} • {devices.find(d => d.id === selectedDevice)?.ip_address}
                      </p>
                    </div>
                    <div className="flex gap-2">
                       <Btn
                         variant="primary"
                         onClick={() => shareReport()}
                         loading={sharing === "current"}
                         icon={BtnIcons.share}
                       >
                         {sharing === "current" ? "Sharing..." : "Share via Email"}
                       </Btn>
                       <Btn
                         variant="secondary"
                         onClick={() => downloadPDF()}
                         icon={BtnIcons.download}
                         className="!bg-emerald-600 !text-white !border-none shadow-xl shadow-emerald-600/20"
                       >
                         Download PDF
                       </Btn>
                    </div>
                  </div>

                  {/* Main Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="md:col-span-2 rounded-2xl p-6 relative overflow-hidden group" style={{ background: "var(--bg-base)" }}>
                      <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity bg-orange-500"></div>
                      <p className="text-xs font-bold uppercase opacity-50 mb-2">Uptime Percentage</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black font-mono tracking-tighter" style={{ color: uptimeColor(slaData.uptime_percentage) }}>
                          {slaData.uptime_percentage.toFixed(4)}%
                        </span>
                      </div>
                      <div className="mt-4 w-full h-2 rounded-full bg-black/10 dark:bg-white/10">
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${slaData.uptime_percentage}%`, background: uptimeColor(slaData.uptime_percentage) }}></div>
                      </div>
                    </div>

                    {[
                      { label: "Total Downtime", value: formatDuration(slaData.total_downtime_seconds), icon: "⏱", sub: `${slaData.incident_count} events` },
                      { label: "Network Health", value: slaData.uptime_percentage >= 99.9 ? "OPTIMAL" : "AT RISK", color: uptimeColor(slaData.uptime_percentage), icon: "🌟" }
                    ].map((m, i) => (
                      <div key={i} className="rounded-2xl p-6 border group hover:border-orange-500 transition-colors" style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)" }}>
                        <div className="text-2xl mb-2">{m.icon}</div>
                        <p className="text-[10px] font-black uppercase opacity-40 tracking-wider mb-1">{m.label}</p>
                        <p className="text-xl font-black" style={{ color: m.color || "var(--text-primary)" }}>{m.value}</p>
                        {m.sub && <p className="text-[10px] uppercase font-bold opacity-30">{m.sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                      { label: "Avg Latency", value: `${slaData.avg_latency} ms` },
                      { label: "Max Latency", value: `${slaData.max_latency} ms` },
                      { label: "Packet Loss", value: `${slaData.avg_packet_loss}%` },
                      { label: "Total Checks", value: slaData.total_checks }
                    ].map((m, i) => (
                      <div key={i} className="p-4 rounded-xl border-l-4 border-orange-500/30" style={{ background: "var(--bg-base)" }}>
                        <p className="text-[10px] font-bold opacity-50 mb-1">{m.label}</p>
                        <p className="text-base font-bold">{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Timeline */}
                  <div className="border-t pt-8" style={{ borderColor: "var(--bg-border)" }}>
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                       Recent Outages
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-500">{slaData.incidents?.length || 0}</span>
                    </h3>
                    <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {slaData.incidents && slaData.incidents.length > 0 ? (
                        slaData.incidents.map((inc: any, idx: number) => (
                          <div key={idx} className="flex gap-4 p-5 rounded-2xl border-2 transition-all hover:translate-x-1" style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)" }}>
                            <div className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center bg-red-500/10 text-red-500">
                              <span className="text-2xl">⚠️</span>
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <p className="font-bold text-sm">Critical Failure</p>
                                <p className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">
                                  {new Date(inc.started_at).toLocaleString()}
                                </p>
                              </div>
                              <div className="md:text-right">
                                <p className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Recovery Time</p>
                                <p className="text-xs font-bold text-red-500">{formatDuration(inc.duration_seconds)} total outage</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-10 text-center border-2 border-dashed rounded-3xl" style={{ borderColor: "var(--bg-border)" }}>
                          <span className="text-3xl mb-3 block">✅</span>
                          <p className="text-sm font-bold opacity-60">Flawless Network Performance Tracked</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History Section */}
          <div className="flex justify-between items-center mb-6 px-2">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-emerald-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Report History
            </h2>
            <span className="text-xs font-bold opacity-40">SHOWING LAST 10 SESSIONS</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border shadow-sm" style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}>
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--bg-elevated)" }}>
                <tr className="border-b" style={{ borderColor: "var(--bg-border)" }}>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('deviceName')}>
                    Report Identifier {renderSortIcon('deviceName')}
                  </th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-center cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('timestamp')}>
                    Generated On {renderSortIcon('timestamp')}
                  </th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.length > 0 ? (
                  paginatedHistory.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: "var(--bg-border)" }}>
                      <td className="px-6 py-4">
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>{h.deviceName}</p>
                        <p className="text-[10px] font-mono opacity-50">{h.startDate} to {h.endDate}</p>
                      </td>
                      <td className="px-6 py-4 text-center" style={{ color: "var(--text-secondary)" }}>
                        {new Date(h.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ActionMenu
                          actions={[
                            { label: sharing === h.id ? "Sharing..." : "Share via Email", onClick: () => shareReport(h.id), variant: "success" },
                            { label: "Download PDF", onClick: () => downloadPDF(h.id), variant: "success" },
                            { label: "Delete Report", onClick: () => deleteFromHistory(h.id), variant: "danger" }
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center" style={{ color: "var(--text-muted)" }}>
                      No history records found. Start generating reports to track them here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

          </div>
        </div>
      </div>
      
      {resetModalOpen && (
        <ResetSLAModal
          availableDevices={resetModalOpen.id === "global" ? devices : []}
          deviceName={resetModalOpen.name}
          resetting={resetting}
          onConfirm={handleResetSLA}
          onCancel={() => setResetModalOpen(null)}
        />
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--bg-border); border-radius: 10px; }
      `}</style>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds === undefined || seconds === null) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || !parts.length) parts.push(`${s}s`);
  return parts.join(" ");
}
