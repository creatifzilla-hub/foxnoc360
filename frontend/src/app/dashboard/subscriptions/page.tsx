"use client";

import { useState, useEffect, useCallback } from "react";

declare const Razorpay: any;
import ConfirmDialog from "../components/ConfirmDialog";
import { Icons } from "../components/Sidebar";
import { useRole } from "../../hooks/useRole";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Plan {
  id: string;
  name: string;
  max_devices: number;
  max_users: number;
  snmp_enabled: boolean;
  sla_reports: boolean;
  price_per_month: number;
}

interface UsageStats {
  plan_name: string | null;
  devices_used: number;
  devices_limit: number;
  users_used: number;
  users_limit: number;
  snmp_enabled: boolean;
  sla_reports: boolean;
  started_at: string | null;
  expires_at: string | null;
}

interface TenantPlan {
  tenant_id: string;
  tenant_name: string;
  plan_id: string | null;
  plan_name: string | null;
  status: string | null;
  started_at: string | null;
}

interface PlanFormData {
  name: string;
  max_devices: number;
  max_users: number;
  snmp_enabled: boolean;
  sla_reports: boolean;
  price_per_month: number;
}

interface TenantPlanResponse {
  tenant_id: string;
  tenant_name: string;
  plan_id: string | null;
  plan_name: string | null;
  status: string | null;
  started_at: string | null;
  expires_at: string | null;
  duration_months: number | null;
  price_charged: number | null;
  company_email: string | null;
}

interface TenantPlan extends TenantPlanResponse {}

function PlanCard({
  plan,
  isCurrentPlan,
  onSelect,
  onEdit,
  onDelete
}: {
  plan: Plan;
  isCurrentPlan: boolean;
  onSelect: (id: string) => void;
  onEdit: (plan: Plan) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`p-6 relative flex flex-col rounded-2xl ${plan.name === "Professional" ? "shadow-lg" : "shadow-sm"}`} style={{ background: "var(--bg-surface)", border: plan.name === "Professional" ? "1px solid var(--accent)" : "1px solid var(--bg-border)" }}>
      {plan.name === "Professional" && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "var(--accent)" }}>
          Most Popular
        </span>
      )}
      <div className="flex justify-end gap-2 mb-2">
        <button onClick={() => onEdit(plan)} className="text-xs transition-colors" style={{ color: "var(--accent)" }} onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.5)"} onMouseLeave={e => e.currentTarget.style.filter = "none"}>Edit</button>
        <button onClick={() => onDelete(plan.id)} disabled={isCurrentPlan} className={`text-xs transition-colors ${isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ color: "#ef4444" }} onMouseEnter={e => !isCurrentPlan && (e.currentTarget.style.filter = "brightness(1.5)")} onMouseLeave={e => !isCurrentPlan && (e.currentTarget.style.filter = "none")}>Delete</button>
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{plan.name}</h3>
        <div className="mt-2 flex items-end gap-1">
          <span className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
            {plan.price_per_month === 0 ? "Free" : `₹${plan.price_per_month}`}
          </span>
          {plan.price_per_month > 0 && (
            <span className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>/month</span>
          )}
        </div>
      </div>

      <ul className="space-y-2 mb-6 flex-1">
        {[
          { label: `${plan.max_devices.toLocaleString()} Devices`, ok: true },
          { label: `${plan.max_users} Customers`, ok: true },
          { label: "PDF SLA Reports", ok: plan.sla_reports },
          { label: "Email & WhatsApp Alerts", ok: true },
        ].map((f) => (
          <li key={f.label} className="flex items-center gap-2 text-sm">
            <span className="font-bold" style={{ color: f.ok ? "var(--accent)" : "var(--text-muted)" }}>
              {f.ok ? "✓" : "✗"}
            </span>
            <span style={{ color: f.ok ? "var(--text-secondary)" : "var(--text-muted)" }}>{f.label}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan.id)}
        disabled={isCurrentPlan}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: isCurrentPlan ? "var(--bg-border)" : "var(--accent)",
          color: isCurrentPlan ? "var(--text-muted)" : "white",
          cursor: isCurrentPlan ? "default" : "pointer"
        }}
        onMouseEnter={e => !isCurrentPlan && ((e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.1)")}
        onMouseLeave={e => !isCurrentPlan && ((e.currentTarget as HTMLButtonElement).style.filter = "none")}
      >
        {isCurrentPlan ? "Current Plan ✓" : `Switch to ${plan.name}`}
      </button>
    </div>
  );
}

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [tenantPlans, setTenantPlans] = useState<TenantPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const { isSuperadmin: roleIsSuperadmin, loading: roleLoading } = useRole();
  const [assigningTenantId, setAssigningTenantId] = useState<string | null>(null);
  const [tenantSearchTerm, setTenantSearchTerm] = useState("");
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewDuration, setRenewDuration] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; confirmLabel?: string; variant?: "danger" | "warning" | "info"; onConfirm: () => void } | null>(null);
  const showConfirm = useCallback((title: string, message: string, fn: () => void, confirmLabel = "Confirm", variant: "danger" | "warning" | "info" = "danger") => setConfirmDialog({ open: true, title, message, onConfirm: fn, confirmLabel, variant }), []);
  const closeConfirm = useCallback(() => setConfirmDialog(null), []);
  const [tenantPage, setTenantPage] = useState(0);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [manageTenant, setManageTenant] = useState<TenantPlan | null>(null);
  const [extendTenant, setExtendTenant] = useState<TenantPlan | null>(null);
  const [assignTenant, setAssignTenant] = useState<TenantPlan | null>(null);
  const [extendMonths, setExtendMonths] = useState(1);
  const [assignForm, setAssignForm] = useState({
    plan_id: "",
    duration_months: 1
  });
  const [manageForm, setManageForm] = useState({
    plan_id: "",
    duration_months: 1,
    price_charged: 0,
    expires_at: "",
    status: "active"
  });
  const ITEMS_PER_PAGE = 20;

  const [form, setForm] = useState<PlanFormData>({
    name: "",
    max_devices: 50,
    max_users: 5,
    snmp_enabled: false,
    sla_reports: false,
    price_per_month: 0.0,
  });

  const fetchData = async (isSA = isSuperadmin) => {
    setLoading(true);
    try {
      const plansRes = await fetch(`${API_BASE}/subscriptions/plans`);
      if (plansRes.ok) setPlans(await plansRes.json());

      const token = localStorage.getItem("token");
      if (token) {
        if (!isSA) {
          const res = await fetch(`${API_BASE}/subscriptions/usage`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem("token");
          window.location.href = "/login";
          return;
        }
          if (res.ok) setUsage(await res.json());
        } else {
          // Superadmin: load all tenant subscriptions with pagination
          const taRes = await fetch(`${API_BASE}/subscriptions/admin/tenant-subscriptions?skip=${tenantPage * ITEMS_PER_PAGE}&limit=${ITEMS_PER_PAGE}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (taRes.ok) setTenantPlans(await taRes.json());
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roleLoading) {
      setIsSuperadmin(roleIsSuperadmin);
      fetchData(roleIsSuperadmin);
    }
  }, [roleLoading, roleIsSuperadmin, tenantPage]);

  const handleSeedPlans = async () => {
    setSeeding(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/subscriptions/seed-default-plans`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Seeded: ${data.seeded.join(", ") || "none (already present)"}`);
        fetchData();
      }
    } finally {
      setSeeding(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    const token = localStorage.getItem("token");
    if (!token) return;

    // 1. If plan is Free, use direct activation
    if (!plan || plan.price_per_month === 0) {
      try {
        const res = await fetch(`${API_BASE}/subscriptions/renew`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ plan_id: planId, duration_months: renewDuration })
        });
        if (res.ok) {
          setMessage("Free subscription activated!");
          fetchData();
        }
      } catch (err) {
        console.error("Free activation failed", err);
      }
      return;
    }

    // 2. For Paid Plans, use Razorpay
    try {
      // Create Order on Backend
      const orderRes = await fetch(`${API_BASE}/payments/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan_id: planId, duration_months: renewDuration })
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        alert(`Order creation failed: ${err.detail || "Unknown error"}`);
        return;
      }

      const orderData = await orderRes.json();

      // RAZORPAY SIMULATION BYPASS
      if (orderData.is_simulated) {
        showConfirm(
          "Test Mode Payment",
          "You are in Simulation Mode. This will simulate a successful payment and activate your plan without a real transaction.",
          async () => {
            closeConfirm();
            const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_order_id: orderData.order_id,
                razorpay_payment_id: "pay_simulated_" + Date.now(),
                razorpay_signature: "sig_simulated",
                plan_id: planId,
                duration_months: renewDuration
              })
            });

            if (verifyRes.ok) {
              setMessage("Success! Simulated payment complete and subscription updated.");
              fetchData();
            } else {
              alert("Verification failed even in simulation.");
            }
          },
          "Proceed with Simulation",
          "info"
        );
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: orderData.company_name,
        description: `Subscription: ${plan.name} (${renewDuration} Month(s))`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          // Verify Payment on Backend
          const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: planId,
              duration_months: renewDuration
            })
          });

          if (verifyRes.ok) {
            setMessage("Payment successful! Subscription activated.");
            fetchData();
          } else {
            alert("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: usage?.plan_name || "",
          email: "", 
        },
        theme: {
          color: "#3b82f6",
        },
      };

      const rzp = new Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error("Razorpay workflow failed", err);
      alert("Something went wrong with the payment gateway.");
    }
  };

  const handleDeletePlan = async (id: string) => {
    showConfirm(
      "Delete Subscription Plan",
      "Are you sure you want to delete this plan? ISP tenants currently on this plan may be affected.",
      async () => {
        closeConfirm();
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/subscriptions/plans/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setMessage("Plan deleted successfully");
            fetchData();
          } else {
            const errorData = await res.json();
            alert(`Failed to delete plan: ${errorData.detail || 'Unknown error'}`);
          }
        } catch (err) {
          console.error(err);
          alert("A network error occurred while deleting the plan.");
        }
      }
    );
  };

  const handleOpenCreateModal = () => {
    setEditingPlanId(null);
    setForm({ name: "", max_devices: 50, max_users: 5, snmp_enabled: false, sla_reports: false, price_per_month: 0.0 });
    setShowModal(true);
  };

  const handleOpenEditModal = (plan: Plan) => {
    setEditingPlanId(plan.id);
    setForm({ name: plan.name, max_devices: plan.max_devices, max_users: plan.max_users, snmp_enabled: plan.snmp_enabled, sla_reports: plan.sla_reports, price_per_month: plan.price_per_month });
    setShowModal(true);
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const url = editingPlanId ? `${API_BASE}/subscriptions/plans/${editingPlanId}` : `${API_BASE}/subscriptions/plans`;
      const method = editingPlanId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage(editingPlanId ? "Plan updated successfully!" : "Plan created successfully!");
        setShowModal(false);
        fetchData();
      } else {
        alert("Failed to save plan.");
      }
    } catch (error) {
      console.error(error);
      alert("A network error occurred.");
    }
  };

  const handleOpenAssignModal = (tenant: TenantPlan) => {
    setAssignTenant(tenant);
    setAssignForm({ plan_id: tenant.plan_id || "", duration_months: 1 });
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTenant) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/subscriptions/admin/tenant-subscriptions/${assignTenant.tenant_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(assignForm),
      });
      if (res.ok) {
        setMessage("Tenant plan assigned successfully!");
        setShowAssignModal(false);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to assign: ${err.detail || "Unknown error"}`);
      }
    } catch (e) {
      alert("A network error occurred.");
    }
  };

  const handleRenewTenantPlan = async (tenantId: string) => {
    const tenant = tenantPlans.find(t => t.tenant_id === tenantId);
    if (!tenant || !tenant.plan_id) return;

    showConfirm(
      "Renew Subscription",
      `Renew the '${tenant.plan_name}' plan for '${tenant.tenant_name}' for 1 month?`,
      async () => {
        closeConfirm();
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/subscriptions/admin/tenant-subscriptions/${tenantId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ plan_id: tenant.plan_id, duration_months: 1 }),
          });
          if (res.ok) {
            setMessage("Tenant plan renewed successfully!");
            fetchData();
          } else {
            const err = await res.json().catch(() => ({}));
            alert(`Failed to renew plan: ${err.detail || "Unknown error"}`);
          }
        } catch (e) {
          console.error(e);
          alert("A network error occurred.");
        }
      },
      "Renew Plan",
      "info"
    );
  };

  const handleRemovePlan = async (tenantId: string, tenantName: string) => {
    showConfirm(
      "Remove Subscription",
      `Remove the subscription plan from '${tenantName}'? They will have no active plan and may lose access to premium features.`,
      async () => {
        closeConfirm();
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/subscriptions/admin/tenant-subscriptions/${tenantId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok || res.status === 204) {
            setMessage(`Removed plan from ${tenantName}.`);
            fetchData();
          } else {
            const err = await res.json().catch(() => ({}));
            alert(`Failed: ${err.detail || "Unknown error"}`);
          }
        } catch (e) {
          alert("A network error occurred.");
        }
      }
    );
  };

  const handleOpenManageModal = (tenant: TenantPlan) => {
    setManageTenant(tenant);
    setManageForm({
      plan_id: tenant.plan_id || "",
      duration_months: tenant.duration_months || 1,
      price_charged: tenant.price_charged || 0,
      expires_at: tenant.expires_at ? new Date(tenant.expires_at).toISOString().split('T')[0] : "",
      status: tenant.status || "active"
    });
    setShowManageModal(true);
  };

  const handleManageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageTenant) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/subscriptions/admin/tenant-subscriptions/${manageTenant.tenant_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...manageForm,
          expires_at: manageForm.expires_at ? new Date(manageForm.expires_at).toISOString() : null
        }),
      });
      if (res.ok) {
        setMessage("Subscription updated successfully!");
        setShowManageModal(false);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to update: ${err.detail || "Unknown error"}`);
      }
    } catch (e) {
      alert("A network error occurred.");
    }
  };

  const handleOpenExtendModal = (tenant: TenantPlan) => {
    setExtendTenant(tenant);
    setExtendMonths(1);
    setShowExtendModal(true);
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendTenant) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/subscriptions/admin/extend/${extendTenant.tenant_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ months: extendMonths }),
      });
      if (res.ok) {
        setMessage("Subscription extended successfully!");
        setShowExtendModal(false);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to extend: ${err.detail || "Unknown error"}`);
      }
    } catch (e) {
      alert("A network error occurred.");
    }
  };

  const handleToggleStatus = async (tenant: TenantPlan) => {
    const newStatus = (tenant.status === "suspended" || tenant.status === "disabled") ? "active" : "disabled";
    const action = newStatus === "active" ? "Enable" : "Disable";
    showConfirm(
      `${action} Access`,
      `Are you sure you want to ${action.toLowerCase()} access for '${tenant.tenant_name}'?`,
      async () => {
        closeConfirm();
        try {
          const token = localStorage.getItem("token");
          // Re-use assign_tenant_plan endpoint with status update
          const res = await fetch(`${API_BASE}/subscriptions/admin/tenant-subscriptions/${tenant.tenant_id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ 
              plan_id: tenant.plan_id, 
              status: newStatus 
            }),
          });
          if (res.ok) {
            setMessage(`Tenant access ${newStatus === "active" ? "enabled" : "disabled"}.`);
            fetchData();
          } else {
            alert("Failed to update status.");
          }
        } catch (e) {
          alert("A network error occurred.");
        }
      },
      `${action} Access`,
      newStatus === "active" ? "info" : "danger"
    );
  };

  const handleRenewSubmit = async () => {
    if (!usage?.plan_name) return;
    const plan = plans.find(p => p.name === usage.plan_name);
    if (!plan) return;

    // Use common selection logic (handles Free vs Paid/Razorpay)
    handleSelectPlan(plan.id);
    setShowRenewModal(false);
  };

  const usagePct = (used: number, limit: number) =>
    limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  const filteredTenantPlans = tenantPlans.filter(t =>
    t.tenant_name.toLowerCase().includes(tenantSearchTerm.toLowerCase()) ||
    (t.plan_name && t.plan_name.toLowerCase().includes(tenantSearchTerm.toLowerCase()))
  );

  const planColor = (name: string | null) => {
    if (!name) return { bg: "rgba(156,163,175,0.1)", color: "#9ca3af" };
    if (name.toLowerCase().includes("enterprise")) return { bg: "rgba(168,85,247,0.12)", color: "#a855f7" };
    if (name.toLowerCase().includes("professional") || name.toLowerCase().includes("pro")) return { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" };
    return { bg: "rgba(52,211,153,0.12)", color: "#34d399" };
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="flex items-center gap-3 text-[22px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              <span className="w-8 h-8 flex items-center justify-center" style={{ color: "var(--accent)" }}>{Icons.creditcard}</span>
              Subscription Plans
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Manage billing plans and features map</p>
          </div>
          {isSuperadmin && (
            <div className="flex gap-3">
              <button
                onClick={handleSeedPlans}
                disabled={seeding}
                className="text-sm font-medium px-4 py-2 rounded-lg transition-colors border shadow-sm"
                style={{ background: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--bg-border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--bg-surface)"}
              >
                {seeding ? "Seeding..." : "⚡ Seed Default Plans"}
              </button>
              <button
                onClick={handleOpenCreateModal}
                className="text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors hover:scale-105"
                style={{ background: "var(--accent)" }}
              >
                + Create Plan
              </button>
            </div>
          )}
        </div>

        {message && (
          <div className="mb-6 bg-green-400/10 border border-green-400/20 text-green-400 text-sm rounded-lg px-4 py-3">
            {message}
          </div>
        )}

        {/* ISP Current Usage (non-superadmin only) */}
        {usage && !isSuperadmin && (
          <div className="rounded-2xl p-6 mb-8 shadow-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
            <h2 className="font-semibold text-lg mb-5" style={{ color: "var(--text-primary)" }}>
              Current Usage
              {usage.plan_name && (
                <span className="ml-3 text-sm font-normal px-2.5 py-1 rounded-full" style={{ color: "var(--accent)", background: "var(--bg-elevated)", border: "1px solid var(--accent)" }}>
                  {usage.plan_name} Plan
                </span>
              )}
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
                  <span>Devices</span>
                  <span>{usage.devices_used} / {usage.devices_limit}</span>
                </div>
                <div className="w-full rounded-full h-2.5" style={{ background: "var(--bg-elevated)" }}>
                  <div className="h-2.5 rounded-full transition-all duration-700" style={{ width: `${usagePct(usage.devices_used, usage.devices_limit)}%`, backgroundColor: usagePct(usage.devices_used, usage.devices_limit) > 80 ? "#f59e0b" : "var(--accent)" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
                  <span>Customers</span>
                  <span>{usage.users_used} / {usage.users_limit}</span>
                </div>
                <div className="w-full rounded-full h-2.5" style={{ background: "var(--bg-elevated)" }}>
                  <div className="h-2.5 rounded-full transition-all duration-700" style={{ width: `${usagePct(usage.users_used, usage.users_limit)}%`, background: "#a855f7" }} />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mt-6 pt-5 border-t" style={{ borderColor: "var(--bg-border)" }}>
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Subscription Started</p>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {usage.started_at ? new Date(usage.started_at).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Expiration Date</p>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {usage.expires_at ? new Date(usage.expires_at).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : "Never (Auto-renews)"}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              {[
                { label: "PDF SLA Reports", enabled: usage.sla_reports },
              ].map((f) => (
                <span key={f.label} className="text-xs font-medium px-3 py-1.5 rounded-full border" style={{ color: f.enabled ? "var(--text-primary)" : "var(--text-muted)", background: f.enabled ? "var(--bg-elevated)" : "transparent", borderColor: "var(--bg-border)", opacity: f.enabled ? 1 : 0.6 }}>
                  {f.enabled ? "✓" : "✗"} {f.label}
                </span>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowRenewModal(true)}
                className="text-white text-sm font-semibold px-6 py-2 rounded-xl transition-all hover:scale-105 shadow-md flex items-center gap-2"
                style={{ background: "var(--accent)" }}
              >
                <div className="w-5 h-5">{Icons.creditcard}</div>
                Renew or Extend Subscription
              </button>
            </div>
          </div>
        )}

        {/* Duration Selector */}
        {!isSuperadmin && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex p-1 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)" }}>
              {[
                { months: 1, label: "Monthly", discount: 0 },
                { months: 3, label: "3 Months", discount: 5 },
                { months: 6, label: "6 Months", discount: 10 },
              ].map((d) => (
                <button
                  key={d.months}
                  onClick={() => {
                    console.log("Setting duration to", d.months);
                    setRenewDuration(d.months);
                  }}
                  className="px-6 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: renewDuration === d.months ? "var(--accent)" : "transparent",
                    color: renewDuration === d.months ? "white" : "var(--text-secondary)",
                    boxShadow: renewDuration === d.months ? "0 2px 4px rgba(0,0,0,0.2)" : "none",
                  }}
                >
                  {d.label}
                  {d.discount > 0 && (
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${renewDuration === d.months ? "bg-white/20 text-white" : "bg-green-500/10 text-green-500"}`}>-{d.discount}%</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Plans Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
            <p className="text-lg mb-2">No subscription plans found.</p>
            <p className="text-sm">Click &quot;Seed Default Plans&quot; to populate the three default tiers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              // Calculate dynamic price based on duration
              const discount = renewDuration === 3 ? 0.05 : renewDuration === 6 ? 0.10 : 0;
              const perMonth = plan.price_per_month * (1 - discount);
              const totalPrice = perMonth * renewDuration;

              return (
                <div key={plan.id} className={`p-6 relative flex flex-col rounded-2xl ${plan.name === "Professional" ? "shadow-lg" : "shadow-sm"}`} style={{ background: "var(--bg-surface)", border: plan.name === "Professional" ? "1px solid var(--accent)" : "1px solid var(--bg-border)" }}>
                  {plan.name === "Professional" && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "var(--accent)" }}>
                      Most Popular
                    </span>
                  )}
                  {isSuperadmin && (
                    <div className="flex justify-end gap-2 mb-2">
                      <button onClick={() => handleOpenEditModal(plan)} className="text-xs transition-colors" style={{ color: "var(--accent)" }} onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.5)"} onMouseLeave={e => e.currentTarget.style.filter = "none"}>Edit</button>
                      <button onClick={() => handleDeletePlan(plan.id)} disabled={usage?.plan_name === plan.name} className={`text-xs transition-colors ${usage?.plan_name === plan.name ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ color: "#ef4444" }} onMouseEnter={e => usage?.plan_name !== plan.name && (e.currentTarget.style.filter = "brightness(1.5)")} onMouseLeave={e => usage?.plan_name !== plan.name && (e.currentTarget.style.filter = "none")}>Delete</button>
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{plan.name}</h3>
                    <div className="mt-2 flex flex-col">
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
                          {plan.price_per_month === 0 ? "Free" : `₹${perMonth.toLocaleString()}`}
                        </span>
                        {plan.price_per_month > 0 && (
                          <span className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>/month</span>
                        )}
                      </div>
                      {renewDuration > 1 && plan.price_per_month > 0 && (
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          Total: ₹{totalPrice.toLocaleString()} for {renewDuration} months
                        </p>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {[
                      { label: `${plan.max_devices.toLocaleString()} Devices`, ok: true },
                      { label: `${plan.max_users} Customers`, ok: true },
                      { label: "PDF SLA Reports", ok: plan.sla_reports },
                      { label: "Email & WhatsApp Alerts", ok: true },
                    ].map((f) => (
                      <li key={f.label} className="flex items-center gap-2 text-sm">
                        <span className="font-bold" style={{ color: f.ok ? "var(--accent)" : "var(--text-muted)" }}>
                          {f.ok ? "✓" : "✗"}
                        </span>
                        <span style={{ color: f.ok ? "var(--text-secondary)" : "var(--text-muted)" }}>{f.label}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={usage?.plan_name === plan.name && renewDuration === 1}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: (usage?.plan_name === plan.name && renewDuration === 1) ? "var(--bg-border)" : "var(--accent)",
                      color: (usage?.plan_name === plan.name && renewDuration === 1) ? "var(--text-muted)" : "white",
                      cursor: (usage?.plan_name === plan.name && renewDuration === 1) ? "default" : "pointer"
                    }}
                    onMouseEnter={e => (usage?.plan_name !== plan.name || renewDuration > 1) && ((e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.1)")}
                    onMouseLeave={e => (usage?.plan_name !== plan.name || renewDuration > 1) && ((e.currentTarget as HTMLButtonElement).style.filter = "none")}
                  >
                    {usage?.plan_name === plan.name 
                      ? (renewDuration > 1 ? `Renew for ${renewDuration} Months` : "Current Plan ✓") 
                      : (plan.price_per_month > (plans.find(p => p.name === usage?.plan_name)?.price_per_month || 0) ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`)}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Superadmin: Tenant Subscription Management ── */}
        {isSuperadmin && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>ISP Tenant Subscriptions</h2>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Assign, update, or remove subscription plans for any ISP tenant</p>
              </div>
              <input
                type="text"
                placeholder="Search tenants..."
                value={tenantSearchTerm}
                onChange={e => setTenantSearchTerm(e.target.value)}
                className="text-sm rounded-lg px-4 py-2 outline-none w-56 transition-colors"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
              />
            </div>

            <div className="rounded-3xl shadow-xl shadow-black/5" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)", overflow: "visible" }}>
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--bg-border)" }}>
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-left" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Tenant</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-left" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Plan</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-left" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Start Date</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-left" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Months</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-left" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Expiration Date</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-left" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Status</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-right sticky right-0 z-10" style={{ color: "var(--text-muted)", fontSize: "0.7rem", background: "var(--bg-base)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenantPlans.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-10 text-center" style={{ color: "var(--text-muted)" }}>No tenants found.</td></tr>
                  ) : filteredTenantPlans.map((t) => {
                    const pc = planColor(t.plan_name);
                    const isAssigning = assigningTenantId === t.tenant_id;
                    const menuOpen = activeMenu === t.tenant_id;
                    return (
                      <tr key={t.tenant_id} className="border-b transition-colors" style={{ borderColor: "var(--bg-border)" }}>
                        <td className="px-6 py-4">
                          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.tenant_name}</div>
                          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t.company_email || t.tenant_id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: pc.bg, color: pc.color }}>
                            {t.plan_name || "No Plan"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                          {t.started_at ? new Date(t.started_at).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {t.duration_months || 0}
                        </td>
                        <td className="px-6 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                          {t.expires_at ? new Date(t.expires_at).toLocaleDateString("en-GB") : "Never"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            t.status === "active" ? "bg-green-500/10 text-green-500" :
                            (t.status === "expired" || t.status === "suspended" || t.status === "disabled") ? "bg-red-500/10 text-red-500" :
                            "bg-gray-500/10 text-gray-500"
                          }`}>
                            {t.status || "Unknown"}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right sticky right-0 ${menuOpen ? "z-50" : "z-10"}`} style={{ background: "var(--bg-surface)", position: "sticky" }}>
                          <div className="relative">
                            <button 
                              onClick={() => setActiveMenu(menuOpen ? null : t.tenant_id)}
                              className="p-1 px-2 rounded hover:bg-black/5 transition-colors"
                              style={{ color: "var(--text-muted)" }}
                            >
                              •••
                            </button>
                            
                            {menuOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-2xl z-50 py-2 border text-left" style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}>
                                <button onClick={() => { handleOpenManageModal(t); setActiveMenu(null); }} className="w-full px-4 py-2 text-xs hover:bg-black/5 transition-colors flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                                  Manage
                                </button>
                                <button onClick={() => { handleOpenAssignModal(t); setActiveMenu(null); }} className="w-full px-4 py-2 text-xs hover:bg-black/5 transition-colors flex items-center gap-2" style={{ color: "var(--accent)" }}>
                                  Assign Plan
                                </button>
                                <button onClick={() => { handleOpenExtendModal(t); setActiveMenu(null); }} className="w-full px-4 py-2 text-xs hover:bg-black/5 transition-colors flex items-center gap-2" style={{ color: "var(--accent)" }}>
                                  Extend
                                </button>
                                <button onClick={() => { handleToggleStatus(t); setActiveMenu(null); }} className="w-full px-4 py-2 text-xs hover:bg-black/5 transition-colors flex items-center gap-2" style={{ color: (t.status === "suspended" || t.status === "disabled") ? "#22c55e" : "#ef4444" }}>
                                  {(t.status === "suspended" || t.status === "disabled") ? "Enable Access" : "Disable Access"}
                                </button>
                                {t.plan_id && (
                                  <button onClick={() => { handleRemovePlan(t.tenant_id, t.tenant_name); setActiveMenu(null); }} className="w-full px-4 py-2 text-xs hover:bg-black/5 transition-colors border-t mt-1 pt-2" style={{ color: "#ef4444", borderColor: "var(--bg-border)" }}>Cancel Plan</button>
                                )}
                                </div>
                              </>
                            )}
                            </div>
                          </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Showing page {tenantPage + 1}
              </p>
              <div className="flex gap-2">
                <button 
                  disabled={tenantPage === 0}
                  onClick={() => setTenantPage(p => Math.max(0, p - 1))}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50"
                  style={{ background: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--bg-border)" }}
                >
                  Previous
                </button>
                <button 
                  disabled={filteredTenantPlans.length < ITEMS_PER_PAGE}
                  onClick={() => setTenantPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50"
                  style={{ background: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--bg-border)" }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {editingPlanId ? "Edit Plan" : "Create Plan"}
            </h2>
            <form onSubmit={handlePlanSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Plan Name</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl px-4 py-2.5 outline-none transition-colors" style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }} placeholder="e.g. Enterprise" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Max Devices</label>
                  <input type="number" min="0" required value={form.max_devices} onChange={(e) => setForm({ ...form, max_devices: parseInt(e.target.value) || 0 })} className="w-full rounded-xl px-4 py-2.5 outline-none transition-colors" style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Max Customers</label>
                  <input type="number" min="0" required value={form.max_users} onChange={(e) => setForm({ ...form, max_users: parseInt(e.target.value) || 0 })} className="w-full rounded-xl px-4 py-2.5 outline-none transition-colors" style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Price per Month (₹)</label>
                <input type="number" min="0" step="0.01" required value={form.price_per_month} onChange={(e) => setForm({ ...form, price_per_month: parseFloat(e.target.value) || 0 })} className="w-full rounded-xl px-4 py-2.5 outline-none transition-colors" style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }} />
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={form.sla_reports} onChange={(e) => setForm({ ...form, sla_reports: e.target.checked })} className="w-4 h-4 rounded border-gray-600 accent-orange-500" />
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Enable PDF SLA Reports</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 font-medium py-2.5 rounded-xl transition-all" style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }} onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"} onMouseLeave={e => e.currentTarget.style.filter = "none"}>Cancel</button>
                <button type="submit" className="flex-1 text-white font-medium py-2.5 rounded-xl transition-all" style={{ background: "var(--accent)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"} onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}>
                  {editingPlanId ? "Save Changes" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showManageModal && manageTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Manage Subscription: {manageTenant.tenant_name}</h2>
            <form onSubmit={handleManageSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-secondary">Subscription Plan</label>
                  <select 
                    required 
                    value={manageForm.plan_id} 
                    onChange={e => setManageForm({...manageForm, plan_id: e.target.value})}
                    className="w-full rounded-xl px-4 py-2.5 outline-none bg-base border-border"
                    style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                  >
                    <option value="">— Select Plan —</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-secondary">Status</label>
                  <select 
                    value={manageForm.status} 
                    onChange={e => setManageForm({...manageForm, status: e.target.value})}
                    className="w-full rounded-xl px-4 py-2.5 outline-none bg-base border-border"
                    style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended / Disabled</option>
                    <option value="grace_period">Grace Period</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-secondary">Duration (Months)</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={manageForm.duration_months} 
                    onChange={e => setManageForm({...manageForm, duration_months: parseInt(e.target.value) || 1})}
                    className="w-full rounded-xl px-4 py-2.5 outline-none bg-base border-border"
                    style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-secondary">Price Charged (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={manageForm.price_charged} 
                    onChange={e => setManageForm({...manageForm, price_charged: parseFloat(e.target.value) || 0})}
                    className="w-full rounded-xl px-4 py-2.5 outline-none bg-base border-border"
                    style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-secondary">Expiration Date (Override)</label>
                <input 
                  type="date" 
                  value={manageForm.expires_at} 
                  onChange={e => setManageForm({...manageForm, expires_at: e.target.value})}
                  className="w-full rounded-xl px-4 py-2.5 outline-none bg-base border-border text-primary"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                />
                <p className="text-[10px] mt-1 text-muted">Leave empty to auto-calculate based on duration.</p>
              </div>

              <div className="p-4 rounded-xl space-y-2 text-xs" style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)" }}>
                <div className="flex justify-between">
                  <span className="text-secondary">Start Date:</span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{manageTenant.started_at ? new Date(manageTenant.started_at).toLocaleString("en-GB") : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Current Expiration:</span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{manageTenant.expires_at ? new Date(manageTenant.expires_at).toLocaleString("en-GB") : "Never"}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowManageModal(false)} 
                  className="flex-1 font-medium py-2.5 rounded-xl transition-all"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
                  onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"}
                  onMouseLeave={e => e.currentTarget.style.filter = "none"}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 text-white font-medium py-2.5 rounded-xl transition-all"
                  style={{ background: "var(--accent)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}
                >
                  Update Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showAssignModal && assignTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
            <div className="text-center">
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Assign Subscription</h2>
              <p className="text-sm text-secondary mt-1">Tenant: {assignTenant.tenant_name}</p>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-secondary">Select Plan</label>
                <select 
                  required
                  value={assignForm.plan_id} 
                  onChange={e => setAssignForm({...assignForm, plan_id: e.target.value})}
                  className="w-full rounded-xl px-4 py-2.5 outline-none bg-base border-border text-primary"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                >
                  <option value="">— Select Plan —</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.price_per_month.toLocaleString()}/mo)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-secondary">Duration (Months)</label>
                <input 
                  type="number" 
                  min="1" 
                  value={assignForm.duration_months} 
                  onChange={e => setAssignForm({...assignForm, duration_months: parseInt(e.target.value) || 1})}
                  className="w-full rounded-xl px-4 py-2.5 outline-none bg-base border-border text-primary"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAssignModal(false)} 
                  className="flex-1 font-medium py-2.5 rounded-xl transition-all"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
                  onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"}
                  onMouseLeave={e => e.currentTarget.style.filter = "none"}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 text-white font-medium py-2.5 rounded-xl transition-all"
                  style={{ background: "var(--accent)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}
                >
                  Assign Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExtendModal && extendTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
            <div className="text-center">
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Extend Subscription</h2>
              <p className="text-sm text-secondary mt-1">Tenant: {extendTenant.tenant_name}</p>
            </div>

            <form onSubmit={handleExtendSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-secondary">Additional Months</label>
                <input 
                  type="number" 
                  min="1" 
                  required
                  value={extendMonths} 
                  onChange={e => setExtendMonths(parseInt(e.target.value) || 1)}
                  className="w-full rounded-xl px-4 py-2.5 outline-none bg-base border-border text-primary"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowExtendModal(false)} 
                  className="flex-1 font-medium py-2.5 rounded-xl transition-all"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
                  onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"}
                  onMouseLeave={e => e.currentTarget.style.filter = "none"}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 text-white font-medium py-2.5 rounded-xl transition-all"
                  style={{ background: "var(--accent)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}
                >
                  Extend Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showRenewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl p-7 w-full max-w-md shadow-2xl space-y-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white" style={{ background: "var(--accent)" }}>
                <div className="w-8 h-8">{Icons.creditcard}</div>
              </div>
              <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Renew Subscription</h2>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Choose your extension duration and save more.</p>
            </div>

            <div className="space-y-3">
              {[
                { months: 1, discount: 0, label: "1 Month" },
                { months: 3, discount: 10, label: "3 Months" },
                { months: 6, discount: 20, label: "6 Months" },
              ].map((d) => {
                const plan = plans.find(p => p.name === usage?.plan_name);
                const basePrice = plan?.price_per_month || 0;
                const totalPrice = basePrice * d.months * (1 - d.discount / 100);
                const isSelected = renewDuration === d.months;
                
                return (
                  <button
                    key={d.months}
                    onClick={() => setRenewDuration(d.months)}
                    className="w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group"
                    style={{ 
                      background: isSelected ? "var(--bg-base)" : "transparent", 
                      borderColor: isSelected ? "var(--accent)" : "var(--bg-border)" 
                    }}
                  >
                    <div>
                      <span className="block font-bold" style={{ color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}>{d.label}</span>
                      {d.discount > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-tight text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded ml-0">
                          SAVE {d.discount}%
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="block text-lg font-bold" style={{ color: "var(--text-primary)" }}>₹{totalPrice.toFixed(1)}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Total payment</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowRenewModal(false)}
                className="flex-1 font-medium py-3 rounded-xl transition-all"
                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
              >
                Cancel
              </button>
              <button 
                onClick={handleRenewSubmit}
                className="flex-1 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
                style={{ background: "var(--accent)" }}
              >
                Confirm Renewal
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel || "Confirm"}
          variant={confirmDialog.variant || "danger"}
          onConfirm={confirmDialog.onConfirm}
          onCancel={closeConfirm}
        />
      )}
    </div>
  );
}
