"use client";

import { useState, useEffect } from "react";
import { Icons } from "../components/Sidebar";
import { useRole } from "../../hooks/useRole";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.foxnoc360.com/api/v1";

interface BillingRecord {
  id: string;
  tenant_name?: string;
  plan_name: string;
  amount: number;
  gst: number;
  total: number;
  date: string;
  status: string;
}

export default function BillingPage() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSuperadmin, loading: roleLoading } = useRole();
  const [viewMode, setViewMode] = useState<"personal" | "platform">("personal");

  useEffect(() => {
    if (!roleLoading) {
        if (isSuperadmin) {
            setViewMode("platform");
        } else {
            setViewMode("personal");
        }
    }
  }, [isSuperadmin, roleLoading]);

  const fetchBilling = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const endpoint = viewMode === "platform" ? "/payments/admin/all-history" : "/payments/history";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (err) {
      console.error("Failed to load billing history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roleLoading) {
        fetchBilling();
    }
  }, [viewMode, roleLoading]);

  const downloadInvoice = async (recordId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/billing/invoice/${recordId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Invoice_CreatifZilla_${recordId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert("Failed to generate invoice. Use recorded payments only.");
      }
    } catch (err) {
      alert("Network error while downloading invoice.");
    }
  };

  const downloadTaxReport = () => {
    alert("Tax reports for the current financial year are being generated. Please check back in 24 hours.");
  };

  if (roleLoading) return null;

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-[22px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              <span className="w-8 h-8 flex items-center justify-center" style={{ color: "var(--accent)" }}>{Icons.billing}</span>
              Subscriptions & Billing
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {viewMode === "platform" 
                ? "Platform-wide financial oversight and ISP transaction history." 
                : "View history, download GST invoices, and manage tax reports."
              }
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isSuperadmin && (
                <div className="flex p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--bg-border)] shadow-sm">
                    <button 
                        onClick={() => setViewMode("personal")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "personal" ? "bg-[var(--accent)] text-white shadow-md" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                    >
                        My Bills
                    </button>
                    <button 
                        onClick={() => setViewMode("platform")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "platform" ? "bg-[var(--accent)] text-white shadow-md" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                    >
                        ISP Invoices
                    </button>
                </div>
            )}
            <button 
                onClick={downloadTaxReport}
                className="px-5 py-2.5 rounded-xl border border-[var(--bg-border)] text-sm font-bold flex items-center gap-2 transition-all hover:bg-[var(--bg-surface)]"
                style={{ color: "var(--text-primary)" }}
            >
                <div className="w-5 h-5">{Icons.report}</div>
                Tax Summary
            </button>
          </div>
        </div>

        {/* GST Notice */}
        <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-4">
          <div className="pt-1 text-orange-500 w-5 h-5">{Icons.creditcard}</div>
          <div>
            <h4 className="text-sm font-bold text-orange-500">GST Compliance Active</h4>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              All subscriptions are billed from <strong>CreatifZilla Private Limited</strong>. 
              A standard 18% GST is applied to all transactions as per Indian Tax laws.
            </p>
          </div>
        </div>

        {/* Billing Table */}
        <div className="rounded-3xl overflow-hidden shadow-xl shadow-black/5" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
          {loading ? (
             <div className="p-20 text-center text-[var(--text-muted)] flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                <span className="text-sm font-medium">Crunching financial data...</span>
             </div>
          ) : (
          <table className="w-full text-left">
            <thead style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--bg-border)" }}>
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {viewMode === "platform" ? "ISP / Tenant" : "Plan & Period"}
                </th>
                {viewMode === "platform" && <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Plan</th>}
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Base Amount</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>GST (18%)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total Paid</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right" style={{ color: "var(--text-muted)" }}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--bg-border)]">
              {records.length > 0 ? records.map(record => (
                <tr key={record.id} className="hover:bg-[var(--bg-base)]/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="font-bold" style={{ color: "var(--text-primary)" }}>
                        {viewMode === "platform" ? record.tenant_name : `${record.plan_name} Plan`}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Billed on {record.date}</div>
                  </td>
                  {viewMode === "platform" && (
                      <td className="px-6 py-5 font-medium" style={{ color: "var(--text-primary)" }}>
                          <span className="px-2 py-0.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold uppercase tracking-widest border border-[var(--accent)]/20">
                            {record.plan_name}
                          </span>
                      </td>
                  )}
                  <td className="px-6 py-5 font-medium" style={{ color: "var(--text-primary)" }}>₹{record.amount.toLocaleString()}</td>
                  <td className="px-6 py-5 font-medium" style={{ color: "var(--text-secondary)" }}>+₹{record.gst.toLocaleString()}</td>
                  <td className="px-6 py-5">
                    <span className="font-bold text-lg" style={{ color: "var(--accent)" }}>₹{record.total.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      record.status === 'Captured' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {record.status === 'Captured' && (
                      <button 
                        onClick={() => downloadInvoice(record.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-border)] transition-all font-bold text-xs shadow-sm"
                        style={{ color: "var(--text-primary)", border: "1px solid var(--bg-border)" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12 12 16.5m0 0L16.5 12M12 16.5V3" />
                        </svg>
                        Invoice
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={viewMode === "platform" ? 7 : 6} className="px-6 py-12 text-center" style={{ color: "var(--text-muted)" }}>
                    No payment history found for this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>

        {/* Legal Disclaimer */}
        <div className="text-[10px] text-center max-w-2xl mx-auto leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Legal Entity: CreatifZilla Private Limited. Registered Address: Financial District, New Delhi, India. 
          For any billing disputes or custom corporate invoicing requirements, please contact accounts@foxnoc360.com.
        </div>
      </div>
    </div>
  );
}
