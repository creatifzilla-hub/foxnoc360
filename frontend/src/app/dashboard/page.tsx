"use client";

import { useEffect, useState } from "react";
import { Icons } from "./components/Sidebar";
import DashboardCharts from "./components/DashboardCharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
import DevicesTable from "./components/DevicesTable";
import { useSubscription } from "../hooks/useSubscription";
import { useRole } from "../hooks/useRole";

interface DashboardStats {
  total_devices: number;
  devices_up: number;
  devices_down: number;
  devices_unknown: number;
  uptime_percentage: number;
  avg_latency_ms: number;
  alerts_count: number;
  sla_score: number;
  recent_events: {
    device_name: string;
    status: string;
    latency_ms: number | null;
    checked_at: string;
  }[];
  uptime_history: { time: string; value: number }[];
  latency_history: { time: string; value: number }[];
}

const metricCards = (stats: DashboardStats | null) => [
  {
    label: "Overall Uptime",
    value: stats ? `${stats.uptime_percentage}%` : "--",
    subtext: "Platform status",
    icon: Icons.signal,
    color: "hsl(142, 70%, 50%)",
    bg: "hsla(142, 70%, 50%, 0.1)",
  },
  {
    label: "Devices Up",
    value: stats?.devices_up ?? "--",
    subtext: "Currently Online",
    icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-full h-full">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    color: "#34d399",
    bg: "rgba(52, 211, 153, 0.1)",
  },
  {
    label: "Devices Down",
    value: stats?.devices_down ?? "--",
    subtext: "Immediate Attention",
    icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-full h-full">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    color: "#fb7185",
    bg: "rgba(251, 113, 133, 0.1)",
  },
  {
    label: "Inventory Status",
    value: stats?.total_devices ?? "--",
    subtext: "Total monitored",
    icon: Icons.device,
    color: "hsl(217, 91%, 60%)",
    bg: "hsla(217, 91%, 60%, 0.1)",
  },
];

const cardStyle = (color: string, bg: string): React.CSSProperties => ({
  border: "1px solid var(--bg-border)",
  background: "var(--bg-surface)",
  backdropFilter: "blur(10px)",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
});

type FilterStatus = "all" | "up" | "down" | "unknown";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [period, setPeriod] = useState<number>(7); // Default 7 days
  const { subscription } = useSubscription();
  const { isSuperadmin } = useRole();

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/monitoring/dashboard?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [period]); // Refetch when period changes

  const cards = metricCards(stats);

  const handleCardClick = (label: string) => {
    let newFilter: FilterStatus = "all";
    if (label === "Devices Up") newFilter = "up";
    else if (label === "Devices Down") newFilter = "down";
    else if (label === "Inventory Status") newFilter = "all";
    else if (label === "Overall Uptime") newFilter = "all";

    setFilter(newFilter);
    setSelectedMetric(label);
    
    // UX: Scroll to table
    const tableElement = document.getElementById("devices-inventory-table");
    if (tableElement) {
        // Offset slightly for better visibility
        const yOffset = -20; 
        const y = tableElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header with Period Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="flex items-center gap-3 text-[26px] font-black tracking-tighter" style={{ color: "var(--text-primary)" }}>
              <span className="w-10 h-10 flex items-center justify-center rounded-2xl bg-accent/10" style={{ color: "var(--accent)" }}>{Icons.overview}</span>
              Dashboard Overview
            </h1>
            <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                <p className="text-sm font-medium opacity-60" style={{ color: "var(--text-secondary)" }}>
                    Aggregated performance intelligence for the last
                </p>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 shadow-sm" style={{ borderColor: "var(--bg-border)" }}>
                    <select 
                        value={period}
                        onChange={(e) => setPeriod(Number(e.target.value))}
                        className="bg-transparent text-xs font-black focus:outline-none cursor-pointer text-accent uppercase tracking-tighter hover:opacity-80 transition-opacity"
                        style={{ color: "var(--accent)" }}
                    >
                        <option value={7} className="bg-slate-900 text-white">7 Days</option>
                        <option value={30} className="bg-slate-900 text-white">30 Days</option>
                        <option value={90} className="bg-slate-900 text-white">90 Days</option>
                    </select>
                </div>
                <p className="text-sm font-medium opacity-60" style={{ color: "var(--text-secondary)" }}>
                    across all active inventory
                </p>
            </div>
          </div>
          



            <div className="flex gap-2">
                <a href="/dashboard/devices" className="text-sm font-bold px-5 py-2.5 rounded-2xl transition-all border border-white/5 bg-white/5 hover:bg-white/10" style={{ color: "var(--text-primary)" }}>
                  Devices
                </a>
                <a href="/dashboard/sla-reports" className="text-white text-sm font-black px-5 py-2.5 rounded-2xl transition-all hover:scale-105 shadow-xl shadow-accent/20" style={{ background: "var(--accent)" }}>
                  SLA Reports
                </a>
            </div>
          </div>

        {/* Device Limit Warning Banner - Only show if limit is reached */}
        {!isSuperadmin && subscription && stats && subscription.max_devices > 0 && stats.total_devices >= subscription.max_devices && (
           <div className="mb-6 p-4 rounded-2xl flex items-center justify-between border animate-in slide-in-from-top duration-500 shadow-xl shadow-red-500/5" 
                style={{ background: "rgba(251, 113, 133, 0.1)", borderColor: "rgba(251, 113, 133, 0.2)" }}>
             <div className="flex items-center gap-3">
               <span className="text-xl">⚠️</span>
               <div>
                 <p className="text-sm font-bold" style={{ color: "#fb7185" }}>Device Limit Reached</p>
                 <p className="text-xs opacity-70">Your {subscription.plan_name} plan is limited to {subscription.max_devices} devices. You cannot add more devices at this time.</p>
               </div>
             </div>
             <button 
               onClick={() => window.location.href = '/dashboard/subscriptions'}
               className="text-white text-xs font-bold px-4 py-2 rounded-xl transition-all hover:scale-105 shadow-lg shadow-red-500/20"
               style={{ background: "#fb7185" }}
             >
               Upgrade Plan
             </button>
           </div>
        )}

        {/* Customer Limit Warning Banner - Only show if limit is reached */}
        {!isSuperadmin && subscription && stats && subscription.max_customers > 0 && subscription.customers_used >= subscription.max_customers && (
           <div className="mb-6 p-4 rounded-2xl flex items-center justify-between border animate-in slide-in-from-top duration-500 shadow-xl shadow-red-500/5" 
                style={{ background: "rgba(251, 113, 133, 0.1)", borderColor: "rgba(251, 113, 133, 0.2)" }}>
             <div className="flex items-center gap-3">
               <span className="text-xl">⚠️</span>
               <div>
                 <p className="text-sm font-bold" style={{ color: "#fb7185" }}>Customer Limit Reached</p>
                 <p className="text-xs opacity-70">Your {subscription.plan_name} plan is limited to {subscription.max_customers} customers. You cannot add more customers at this time.</p>
               </div>
             </div>
             <button 
               onClick={() => window.location.href = '/dashboard/subscriptions'}
               className="text-white text-xs font-bold px-4 py-2 rounded-xl transition-all hover:scale-105 shadow-lg shadow-red-500/20"
               style={{ background: "#fb7185" }}
             >
               Upgrade Plan
             </button>
           </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, i) => {
            const isSelected = selectedMetric === card.label;
            
            return (
              <div
                key={i}
                onClick={() => handleCardClick(card.label)}
                className={`group relative rounded-3xl p-6 text-left transition-all duration-300 hover:scale-[1.02] shadow-xl border cursor-pointer`}
                style={{
                    ...cardStyle(card.color, card.bg),
                    borderColor: isSelected ? `${card.color}80` : "var(--bg-border)",
                    borderWidth: isSelected ? "2px" : "1px",
                    boxShadow: isSelected ? `0 10px 30px -10px ${card.color}20` : "none"
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: card.bg, color: card.color }}>
                    <div className="w-6 h-6">{card.icon}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5">Live</span>
                  </div>
                </div>
                <h3 className="text-xs font-bold opacity-60 uppercase tracking-tighter" style={{ color: "var(--text-muted)" }}>
                  {card.label}
                </h3>
                <p className="mt-1 text-3xl font-black" style={{ color: "var(--text-primary)" }}>
                  {card.value}
                </p>
                <p className="text-[10px] font-medium mt-1 opacity-40">{card.subtext}</p>
              </div>
            );
          })}
        </div>

        {/* Charts & Analytics */}
        <DashboardCharts stats={stats} />

        {/* Devices Section */}
        <div id="devices-inventory-table" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Active Devices & IPs Overview
            </h2>
            {filter !== "all" && (
              <button 
                onClick={() => {
                    setFilter("all");
                    setSelectedMetric(null);
                }}
                className="text-xs font-bold uppercase tracking-wider text-orange-500 hover:underline"
              >
                Clear Filter
              </button>
            )}
          </div>
          <DevicesTable statusFilter={filter} />
        </div>

      </div>
    </div>
  );
}
