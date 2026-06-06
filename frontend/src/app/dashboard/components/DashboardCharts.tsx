"use client";

import React, { useMemo, useState } from "react";
import { Icons } from "./Sidebar";

interface ChartProps {
  stats: {
    total_devices: number;
    devices_up: number;
    devices_down: number;
    devices_unknown: number;
    uptime_percentage: number;
    avg_latency_ms: number;
    recent_events: {
      device_name: string;
      status: string;
      latency_ms: number | null;
      checked_at: string;
    }[];
    uptime_history: { time: string; value: number }[];
    latency_history: { time: string; value: number }[];
    sla_score: number;
  } | null;
}

/**
 * Custom SVG area chart for Uptime history
 */

/**
 * Custom SVG Doughnut Chart
 */
const StatusDoughnut = ({ up, down, unknown, total }: { up: number; down: number; unknown: number; total: number }) => {
  const radius = 70;
  const strokeWidth = 18;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const data = useMemo(() => {
    if (total === 0) return [];
    return [
      { value: up, color: "#34d399", label: "Up" },
      { value: down, color: "#fb7185", label: "Down" },
      { value: unknown, color: "var(--text-muted)", label: "Unknown" },
    ].filter(d => d.value > 0);
  }, [up, down, unknown, total]);

  let cumulativeOffset = 0;

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        {/* Background track */}
        <circle
          stroke="var(--bg-elevated)"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {data.map((item, i) => {
          const dash = (item.value / total) * circumference;
          const offset = circumference - cumulativeOffset;
          cumulativeOffset += dash;
          return (
            <circle
              key={i}
              stroke={item.color}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference}`}
              style={{ strokeDashoffset: - (circumference - offset), transition: "stroke-dashoffset 1s ease-in-out" }}
              strokeLinecap={item.value === total ? "butt" : "round"}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              className="drop-shadow-sm"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>{total}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Devices</span>
      </div>
    </div>
  );
};

const SLAGauge = ({ score }: { score: number }) => {
  const radius = 95;
  const stroke = 14;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center p-6 bg-surface rounded-3xl border shadow-xl shadow-black/5 h-full" style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}>
      <div className="w-full mb-6">
        <h3 className="text-xs font-black uppercase tracking-widest opacity-40">Global SLA Score</h3>
      </div>

      <div className="relative mb-6">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            stroke="var(--bg-border)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke="#f59e0b"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + " " + circumference}
            style={{ strokeDashoffset, transition: "stroke-dashoffset 1s ease-in-out" }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-black text-amber-500">{score}%</span>
          <span className="text-[10px] font-bold opacity-30 uppercase">Uptime Score</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.1em]">Target: 99.9%</p>
      </div>
    </div>
  );
};

/**
 * Custom SVG Area Chart for Latency Trend
 */
const LatencyTrend = ({ data }: { data: { time: string; value: number }[] }) => {
  const width = 500;
  const height = 120; // Reduced (-30)
  const padding = 20;
  const topPad = 35; // For tooltips

  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    const maxVal = Math.max(...data.map(d => d.value ?? 0), 10);
    
    return data.map((d, i) => {
      const date = new Date(d.time);
      const label = data.length > 48 
        ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        x: (i / (Math.max(data.length - 1, 1))) * (width - 2 * padding) + padding,
        y: (height - padding) - ((d.value || 0) / maxVal) * (height - padding - topPad),
        value: d.value,
        time: label
      };
    });
  }, [data]);

  const areaPath = useMemo(() => {
    if (points.length < 2) return "";
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ");
    // Close the path for the area fill
    return `${pathData} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  }, [points]);

  const linePath = useMemo(() => {
    if (points.length < 2) return "";
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ");
  }, [points]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="relative w-full h-[130px]">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* X Axis line */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--bg-border)" strokeWidth="1" />
        
        {/* The Area */}
        <path d={areaPath} fill="url(#areaGradient)" className="transition-all duration-700 ease-out" />
        
        {/* The Line */}
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-700" />
        
        {/* Interactive points */}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 6 : 4}
              fill="var(--bg-surface)"
              stroke="var(--accent)"
              strokeWidth="2"
              className="cursor-pointer transition-all"
            />
            {/* Tooltip on hover */}
            {hoveredIndex === i && (
              <foreignObject x={p.x - 55} y={p.y - 55} width="110" height="50">
                <div className="bg-slate-900 border-2 border-white/10 text-white p-2 rounded-2xl text-sm shadow-2xl backdrop-blur-md flex items-center justify-center font-black h-12">
                  {p.value?.toFixed(1)}ms
                </div>
              </foreignObject>
            )}
          </g>
        ))}

        {/* Latency X-Axis Labels */}
        {points.filter((_, i) => i % Math.ceil(points.length / 5) === 0).map((p, i) => (
          <text key={i} x={p.x} y={height - 2} fontSize="14" fontWeight="black" fill="var(--text-primary)" opacity="0.6" textAnchor="middle">
            {p.time}
          </text>
        ))}
      </svg>
    </div>
  );
};

export default function DashboardCharts({ stats }: ChartProps) {
  if (!stats) return (
    <div className="h-[250px] flex items-center justify-center opacity-50">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 rounded-full border-4 border-t-accent border-r-transparent border-b-transparent border-l-transparent animate-spin mb-4" />
        <span className="text-xs font-bold uppercase tracking-widest">Loading Analytics...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700 zoom-in-95">
      {/* Prime row: SLA and Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Global SLA Gauge */}
        <SLAGauge score={stats.sla_score} />

        {/* Status Distribution Card */}
        <div className="bg-surface rounded-3xl p-6 border shadow-xl shadow-black/5 flex flex-col items-center" style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}>
          <div className="w-full flex justify-between items-center mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-40">Status Distribution</h3>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#34d399]/10 text-[#34d399] text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
              Online
            </div>
          </div>
          
          <div className="h-[140px] flex items-center justify-center">
            <StatusDoughnut 
              up={stats.devices_up} 
              down={stats.devices_down} 
              unknown={stats.devices_unknown} 
              total={stats.total_devices} 
            />
          </div>
          
          <div className="grid grid-cols-3 gap-2 w-full mt-6">
            {[
              { label: "Up", val: stats.devices_up, color: "#34d399" },
              { label: "Down", val: stats.devices_down, color: "#fb7185" },
              { label: "Lost", val: stats.devices_unknown, color: "var(--text-muted)" },
            ].map((inf, i) => (
              <div key={i} className="text-center p-2 rounded-2xl bg-black/5 dark:bg-white/5">
                <div className="text-[10px] font-bold opacity-40 mb-1">{inf.label}</div>
                <div className="text-sm font-black" style={{ color: inf.color }}>{inf.val}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Real-time Performance (ms) Metrics Hidden for now */}
    </div>
  );
}
