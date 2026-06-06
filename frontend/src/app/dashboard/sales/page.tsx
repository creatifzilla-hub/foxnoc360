"use client";

import { useEffect, useState, useMemo } from "react";
import { Icons } from "../components/Sidebar";
import DashboardCharts from "../components/DashboardCharts"; // We can reuse chart components if generic
import Btn, { BtnIcons } from "../components/Btn";
import LeadsManager from "../components/LeadsManager";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface SalesStats {
  total_leads: number;
  conversion_rate: number;
  leads_per_stage: Record<string, number>;
  follow_ups_due: number;
  missed_follow_ups: number;
  top_agents: { name: string; conversions: number }[];
  recent_leads: any[];
  area_distribution: Record<string, number>;
}

export default function SalesDashboard() {
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/sales/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const handleDrilldown = (filterString: string) => {
      setActiveFilter(filterString);
      setTimeout(() => {
          const el = document.getElementById("leads-manager-table");
          if (el) {
             const y = el.getBoundingClientRect().top + window.scrollY - 30;
             window.scrollTo({ top: y, behavior: 'smooth' });
          }
      }, 100);
  };

  const cards = [
    { label: "Total Pipeline", value: stats?.total_leads ?? 0, filter: "all", icon: Icons.sales, color: "#ff5f00", bg: "rgba(255,95,0,0.1)" },
    { label: "Conversion Rate", value: `${stats?.conversion_rate.toFixed(1) || 0}%`, filter: "installed", icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="w-full h-full">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
    ), color: "#34d399", bg: "rgba(52, 211, 153, 0.1)" },
    { label: "Follow-ups Today", value: stats?.follow_ups_due ?? 0, filter: "follow_ups_today", icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="w-full h-full">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ), color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
    { label: "Missed Follow-ups", value: stats?.missed_follow_ups ?? 0, filter: "missed_follow_ups", icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="w-full h-full">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    ), color: "#fb7185", bg: "rgba(251, 113, 133, 0.1)" },
  ];

  if (loading) return <div className="p-8 text-center opacity-50 font-bold">Loading Sales Intelligence...</div>;

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Sales Dashboard</h1>
            <p className="text-sm opacity-60">Lead conversion, pipeline health and agent performance at a glance.</p>
          </div>
          <div className="flex gap-3">
             <Btn variant="secondary" onClick={() => window.location.href = '/dashboard/sales/leads'}>Leads Table</Btn>
             <Btn variant="primary" icon={BtnIcons.plus} onClick={() => window.location.href = '/dashboard/sales/leads?action=add'}>New Lead</Btn>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((c, i) => {
            const isActive = activeFilter === c.filter;
            return (
              <div 
                  key={i} 
                  onClick={() => handleDrilldown(c.filter)} 
                  className="p-6 rounded-3xl border cursor-pointer hover:scale-[1.02] transition-all duration-300" 
                  style={{ 
                      background: "var(--bg-surface)", 
                      borderColor: isActive ? `${c.color}80` : "var(--bg-border)",
                      borderWidth: isActive ? "2px" : "1px",
                      boxShadow: isActive ? `0 10px 30px -10px ${c.color}20` : "none"
                  }}
              >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: c.bg, color: c.color }}>
                <div className="w-6 h-6">{c.icon}</div>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-1">{c.label}</p>
              <p className="text-3xl font-black">{c.value}</p>
            </div>
            );
          })}
        </div>

        {/* Main Connected Funnel (Full Width Structure) */}
        <div className="w-full">
             {(() => {
                const pipelineSequence = ['new', 'contacted', 'feasibility', 'installation', 'installed'];
                const funnelStages = [
                  { id: 'new', label: 'New', hex: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'border-blue-500', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> },
                  { id: 'contacted', label: 'Contacted', hex: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'border-orange-500', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
                  { id: 'feasibility', label: 'Survey', hex: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', border: 'border-yellow-500', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg> },
                  { id: 'installation', label: 'Install', hex: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'border-orange-500', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
                  { id: 'installed', label: 'Completed', hex: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'border-emerald-500', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
                ];
                
                const stageMetrics = pipelineSequence.map((id, i) => {
                   const count = stats?.leads_per_stage[id] || 0;
                   const prevCount = i === 0 ? count : (stats?.leads_per_stage[pipelineSequence[i-1]] || 0);
                   const dropoff = Math.max(0, prevCount - count);
                   const dropoffPct = prevCount > 0 && dropoff > 0 ? (dropoff / prevCount) * 100 : 0;
                   const convPct = prevCount > 0 ? (count / prevCount) * 100 : (count > 0 ? 100 : 0);
                   return { id, count, prevCount, dropoff, dropoffPct, convPct };
                });
                
                const maxDropoffCard = stageMetrics.slice(0, 4).reduce((max, obj) => obj.dropoffPct > max.dropoffPct ? obj : max, stageMetrics[0]);
                const winRate = stats?.total_leads ? ((stats?.leads_per_stage['installed'] || 0) / stats.total_leads * 100).toFixed(1) : 0;
                
                return (
                  <div className="flex flex-col w-full">


                     {/* Connected Horizontal Flow */}
                     <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch">
                         {stageMetrics.map((m, i) => {
                            const stage = funnelStages.find(s => s.id === m.id)!;
                            const isBiggestDrop = m.dropoffPct > 0 && m.id === maxDropoffCard.id;
                            const isActive = activeFilter === m.id;
                                                        return (
                               <div 
                                    key={m.id} 
                                    onClick={() => handleDrilldown(m.id)} 
                                    className="flex-1 flex flex-col bg-[var(--bg-surface)] rounded-2xl p-6 border cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                                    style={{ 
                                        borderTopColor: stage.hex,
                                        borderRightColor: isActive ? `${stage.hex}80` : "var(--bg-border)",
                                        borderBottomColor: isActive ? `${stage.hex}80` : "var(--bg-border)",
                                        borderLeftColor: isActive ? `${stage.hex}80` : "var(--bg-border)",
                                        borderWidth: isActive ? "2px" : "1px", 
                                        borderTopWidth: "4px", 
                                        boxShadow: isActive ? `0 10px 30px -10px ${stage.hex}20` : "none" 
                                    }}
                               >
                                  
                                  <div className="flex justify-between items-start mb-4">
                                     <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: stage.bg, color: stage.hex }}>
                                       {stage.icon}
                                     </div>
                                     {isBiggestDrop && (
                                       <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded uppercase tracking-wider">High Drop</span>
                                     )}
                                  </div>

                                  {/* Stage Label Block */}
                                  <div className="flex flex-col items-start gap-1 mb-1">
                                     <div className="flex items-center gap-2">
                                       <span className="text-xs font-bold uppercase tracking-widest opacity-40">{stage.label}</span>
                                     </div>
                                  </div>
                                  
                                  {/* Metric Number */}
                                  <div className="mb-4 flex items-center gap-2">
                                     <p className="text-3xl font-black">{m.count}</p>
                                  </div>

                                  {/* Flow Math Bottom Dividers */}
                                  <div className="flex flex-col gap-2 pt-4" style={{ borderTop: "1px solid var(--bg-border)" }}>
                                     {i > 0 ? (
                                        <>
                                           <div className="flex justify-between items-center text-[10px]">
                                              <span className="opacity-40 font-medium">Conversion</span>
                                              <span className={`font-bold ${m.convPct >= 50 ? 'text-emerald-500' : m.convPct > 0 ? 'text-orange-500' : 'opacity-80'}`}>{m.convPct.toFixed(0)}%</span>
                                           </div>
                                           <div className="flex justify-between items-center text-[10px]">
                                              <span className="opacity-40 font-medium">Drop-off</span>
                                              <span className={`font-bold ${m.dropoffPct > 0 ? 'text-red-500' : 'opacity-80'}`}>
                                                 {m.dropoffPct > 0 ? `↓ ${m.dropoffPct.toFixed(0)}%` : '-'}
                                              </span>
                                           </div>
                                        </>
                                     ) : (
                                        <div className="flex justify-between items-center text-[10px] opacity-40 font-medium">
                                           <span>Entry Stage 100%</span>
                                           <span>0%</span>
                                        </div>
                                     )}
                                  </div>
                               </div>
                            )
                         })}
                     </div>
                  </div>
                )
             })()}
        </div>

        {/* Embedded Dynamic Leads Tracker */}
        <div className="mt-8">
            <h2 className="text-xl font-bold mb-4 tracking-tight" style={{ color: "var(--text-primary)" }}>Intelligence Table</h2>
            <LeadsManager embedded defaultStatusFilter={activeFilter} />
        </div>

      </div>
    </div>
  )
}
