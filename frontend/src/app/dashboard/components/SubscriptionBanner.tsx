"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface UsageStats {
  status?: string;
  plan_name?: string;
  expires_at?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.foxnoc360.com/api/v1";

export default function SubscriptionBanner() {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Decode JWT role (simplistic)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setRole(payload.role);
    } catch (e) {
      console.error("Failed to decode token", e);
    }

    const fetchUsage = async () => {
      try {
        const res = await fetch(`${API_BASE}/subscriptions/usage`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.status === 401) {
          localStorage.removeItem("token");
          window.location.href = "/login";
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        }
      } catch (err) {
        console.error("Failed to fetch subscription status", err);
      }
    };

    fetchUsage();
  }, []);

  if (!usage || role === "superadmin") return null;

  const status = usage.status || "active";
  
  if (status === "active" && !usage.expires_at) return null;

  // Determine if expiring soon (less than 7 days)
  const isExpiringSoon = status === "expiring_soon";
  const isGracePeriod = status === "grace_period";
  const isSuspended = status === "suspended";

  if (!isExpiringSoon && !isGracePeriod && !isSuspended) return null;

  let bg = "bg-amber-500/10";
  let border = "border-amber-500/20";
  let text = "text-amber-600";
  let label = "Warning";
  let message = "";

  if (isSuspended) {
    bg = "bg-red-500/10";
    border = "border-red-500/20";
    text = "text-red-600";
    label = "Suspended";
    message = "Your subscription has been suspended due to non-payment. Please renew to restore services.";
  } else if (isGracePeriod) {
    bg = "bg-orange-500/10";
    border = "border-orange-500/20";
    text = "text-orange-600";
    label = "Grace Period";
    message = "Your subscription has expired. You are currently in a 7-day grace period. New devices/customers cannot be added.";
  } else if (isExpiringSoon) {
    message = `Your subscription will expire soon (${usage.expires_at ? new Date(usage.expires_at).toLocaleDateString() : "Shortly"}). Renew now to maintain service.`;
  }

  return (
    <div className={`px-6 py-3 border-b transition-colors ${bg} ${border} ${text}`}>
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase text-[10px] tracking-widest px-2 py-0.5 rounded-md border" style={{ borderColor: "currentColor" }}>
            {label}
          </span>
          <p className="text-sm font-medium">{message}</p>
        </div>
        <Link 
          href="/dashboard/subscriptions"
          className="text-xs font-bold underline underline-offset-4 hover:opacity-80 transition-opacity whitespace-nowrap"
        >
          Renew Now →
        </Link>
      </div>
    </div>
  );
}
