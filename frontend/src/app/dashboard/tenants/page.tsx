"use client";
import CopyText from "../components/CopyText";
import ConfirmDialog from "../components/ConfirmDialog";
import FormModal, { FormField, inputCls, inputStyle } from "../components/FormModal";
import Modal, { ModalHeader, ModalBody } from "../components/Modal";
import Btn, { BtnIcons } from "../components/Btn";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "../components/Sidebar";
import { useRole } from "../../hooks/useRole";
import ActionMenu from "../components/ActionMenu";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Tenant {
  id: string;
  name: string;
  company_email: string;
  status: string;
  created_at: string;
  customer_count: number;
  device_count: number;
  max_devices: number | null;
  plan_name: string | null;
  expires_at: string | null;
}

export default function TenantsPage() {
  const router = useRouter();
  const { isSuperadmin, loading: roleLoading } = useRole();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Route Guard: only superadmins may access this page ──────────────────
  useEffect(() => {
    if (!roleLoading && !isSuperadmin) {
      router.replace("/dashboard");
    }
  }, [roleLoading, isSuperadmin, router]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", company_email: "", admin_password: "", confirm_password: "", status: "active" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Track which dropdown is open (store tenant ID)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const showConfirm = useCallback((title: string, message: string, fn: () => void) => setConfirmDialog({ open: true, title, message, onConfirm: fn }), []);
  const closeConfirm = useCallback(() => setConfirmDialog(null), []);
  
  // Table features state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Tenant; direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const ITEMS_PER_PAGE = 20;

  // Customers Modal State
  const [showCustomersModal, setShowCustomersModal] = useState<{ id: string, name: string } | null>(null);
  const [tenantCustomers, setTenantCustomers] = useState<{ id: string, name: string, contact_email: string, ips: string[] }[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Change Password Modal State
  const [changePasswordModal, setChangePasswordModal] = useState<{id: string, name: string} | null>(null);
  const [changePasswordForm, setChangePasswordForm] = useState({ new_password: "", confirm_password: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".action-dropdown-container")) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const fetchTenants = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTenants(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) {
      if (form.admin_password !== form.confirm_password) {
        alert("Passwords do not match!");
        return;
      }
      if (!/^(?=.*[0-9])(?=.*[a-zA-Z]).{8,}$/.test(form.admin_password)) {
        alert("Password must be at least 8 characters long and contain both letters and numbers.");
        return;
      }
    }
    try {
      const token = localStorage.getItem("token");
      const url = isEditing ? `${API_BASE}/tenants/${form.id}` : `${API_BASE}/tenants`;
      const method = isEditing ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(isEditing ? { name: form.name, company_email: form.company_email } : { name: form.name, company_email: form.company_email, admin_password: form.admin_password }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(`Failed to save ISP: ${errData.detail || "Unknown error"}`);
        return;
      }

      setForm({ id: "", name: "", company_email: "", admin_password: "", confirm_password: "", status: "active" });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setIsEditing(false);
      setShowModal(false);
      fetchTenants();
    } catch (e) {
      console.error(e);
      alert("A network error occurred.");
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changePasswordModal) return;
    
    if (changePasswordForm.new_password !== changePasswordForm.confirm_password) {
      alert("Passwords do not match!");
      return;
    }
    if (!/^(?=.*[0-9])(?=.*[a-zA-Z]).{8,}$/.test(changePasswordForm.new_password)) {
      alert("Password must be at least 8 characters long and contain both letters and numbers.");
      return;
    }

    setChangingPassword(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tenants/${changePasswordModal.id}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: changePasswordForm.new_password }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(`Failed to change password: ${errData.detail || "Unknown error"}`);
        return;
      }

      setChangePasswordModal(null);
      setChangePasswordForm({ new_password: "", confirm_password: "" });
      alert("Password successfully changed!");
    } catch (e) {
      console.error(e);
      alert("A network error occurred.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDelete = async (id: string, skipConfirm = false, skipFetch = false) => {
    if (!skipConfirm) {
      showConfirm(
        "Delete ISP Tenant",
        "Are you sure you want to permanently delete this ISP? All their customers, devices, and data will be removed.",
        () => { closeConfirm(); handleDelete(id, true, skipFetch); }
      );
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tenants/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (!skipFetch) fetchTenants();
        setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      } else { alert("Failed to delete ISP."); }
    } catch (e) { console.error(e); }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tenants/${id}/status?status=${newStatus}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchTenants();
    } catch (e) {
      console.error(e);
    }
  };

  const openEditModal = (t: Tenant) => {
    setForm({ id: t.id, name: t.name, company_email: t.company_email, admin_password: "", confirm_password: "", status: t.status });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsEditing(true);
    setShowModal(true);
  };
  
  const openCreateModal = () => {
    setForm({ id: "", name: "", company_email: "", admin_password: "", confirm_password: "", status: "active" });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsEditing(false);
    setShowModal(true);
  };

  const openCustomersModal = async (tenant: Tenant) => {
    setShowCustomersModal({ id: tenant.id, name: tenant.name });
    setLoadingCustomers(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const [custRes, devRes] = await Promise.all([
        fetch(`${API_BASE}/customers?tenant_id=${tenant.id}`, { headers }),
        fetch(`${API_BASE}/devices?tenant_id=${tenant.id}`, { headers })
      ]);
      
      const customers = custRes.ok ? await custRes.json() : [];
      const devices = devRes.ok ? await devRes.json() : [];
      
      // Map IPs to customers
      const mapped = customers.map((c: { id: string; name: string; contact_email: string }) => ({
        ...c,
        ips: devices
          .filter((d: { customer_id: string; ip_address: string }) => d.customer_id === c.id)
          .map((d: { ip_address: string }) => d.ip_address)
      }));
      setTenantCustomers(mapped);
    } catch (e) {
      console.error(e);
    }
    setLoadingCustomers(false);
  };

  // Sorting
  const sortedTenants = [...tenants].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    
    if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
    if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Filtering
  const filteredTenants = sortedTenants.filter(t => 
    (t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     t.company_email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (activeTab === "active" ? t.status !== "archived" : t.status === "archived")
  );

  // Pagination
  const totalPages = Math.ceil(filteredTenants.length / ITEMS_PER_PAGE);
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  
  // Reset pagination on search filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const requestSort = (key: keyof Tenant) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const renderSortIcon = (key: keyof Tenant) => {
    const isSorted = sortConfig?.key === key;
    return (
      <span className="ml-1 transition-colors" style={{ color: isSorted ? "var(--accent)" : "var(--text-muted)", opacity: isSorted ? 1 : 0.4 }}>
        {isSorted ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    );
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedTenants.map(t => t.id);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    
    const next = new Set(selectedIds);
    if (allSelected) {
      pageIds.forEach(id => next.delete(id));
    } else {
      pageIds.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    showConfirm(
      `Delete ${selectedIds.size} ISP${selectedIds.size > 1 ? "s" : ""}`,
      `Are you sure you want to permanently delete ${selectedIds.size} selected ISP(s)? All their customers, devices, and data will be removed.`,
      async () => {
        closeConfirm();
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/tenants/bulk-delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
          });
          if (res.ok || res.status === 204) {
            setSelectedIds(new Set());
            fetchTenants();
          } else {
            const err = await res.json().catch(() => ({}));
            alert(`Failed: ${err.detail || "Unknown error"}`);
          }
        } catch (e) { console.error(e); alert("Network error."); }
      }
    );
  };

  const handleExport = () => {
    const csvContent = [
      ["ISP Name", "Contact Email", "Status", "Created At"].join(","),
      ...filteredTenants.map(t => [t.name, t.company_email, t.status, new Date(t.created_at).toLocaleDateString()].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "isp_tenants.csv";
    link.click();
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="flex items-center gap-3 text-[22px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              <span className="w-8 h-8 flex items-center justify-center" style={{ color: "var(--accent)" }}>{Icons.building}</span>
              ISPs / Tenants
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Manage ISP organizations and billing</p>
          </div>
          <div className="flex gap-3">
            <Btn
              variant="secondary"
              onClick={handleExport}
              icon={BtnIcons.download}
            >
              Export CSV
            </Btn>
            <Btn
              variant="primary"
              onClick={openCreateModal}
              icon={BtnIcons.plus}
            >
              Add ISP
            </Btn>
          </div>
        </div>
        
        {/* Status Tabs */}
        <div className="flex gap-4 mb-4 border-b" style={{ borderColor: "var(--bg-border)" }}>
          <button
            onClick={() => { setActiveTab("active"); setCurrentPage(1); setSelectedIds(new Set()); }}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === "active" ? "border-orange-500" : "border-transparent"}`}
            style={{ color: activeTab === "active" ? "var(--accent)" : "var(--text-secondary)" }}
          >
            Active Tenants
          </button>
          <button
            onClick={() => { setActiveTab("archived"); setCurrentPage(1); setSelectedIds(new Set()); }}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === "archived" ? "border-orange-500" : "border-transparent"}`}
            style={{ color: activeTab === "archived" ? "var(--accent)" : "var(--text-secondary)" }}
          >
            Archived Tenants
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <input 
              type="text" 
              placeholder="Search ISPs..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="text-sm rounded-lg px-4 py-2 outline-none w-64 transition-colors"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
            />
            {selectedIds.size > 0 && (
              <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                {selectedIds.size} selected
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors bg-red-500 hover:bg-red-600"
              >
                Delete Selected
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive rounded-2xl shadow-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--bg-border)" }}>
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={paginatedTenants.length > 0 && paginatedTenants.every(t => selectedIds.has(t.id))} 
                    onChange={toggleSelectAll} 
                    className="rounded accent-orange-500" 
                    style={{ borderColor: "var(--bg-border)" }}                  />
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('name')}>
                  ISP Name {renderSortIcon('name')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('customer_count')}>
                  Customers {renderSortIcon('customer_count')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('device_count')}>
                  Devices / IPs {renderSortIcon('device_count')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('status')}>
                  Status {renderSortIcon('status')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('plan_name' as any)}>
                  Active Plan {renderSortIcon('plan_name' as any)}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('expires_at' as any)}>
                  Expiration Date {renderSortIcon('expires_at' as any)}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('created_at')}>
                  Created {renderSortIcon('created_at')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right sticky right-0 z-10" style={{ color: "var(--text-muted)", fontSize: "0.7rem", background: "var(--bg-elevated)", borderLeft: "1px solid var(--bg-border)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading...</td></tr>
              ) : paginatedTenants.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center" style={{ color: "var(--text-muted)" }}>No ISPs found.</td></tr>
              ) : (
                paginatedTenants.map((t) => (
                  <tr key={t.id} className="transition-colors" style={{ borderBottom: "1px solid var(--bg-border)" }}>
                    <td className="px-6 py-4 text-center">
                      <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} className="rounded accent-orange-500" style={{ borderColor: "var(--bg-border)" }} />
                    </td>
                    <td className="px-6 py-4 font-medium" style={{ color: "var(--text-primary)" }}>
                      <div>{t.name}</div>
                      <div className="text-xs font-normal" style={{ color: "var(--text-secondary)" }}><CopyText value={t.company_email} /></div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => openCustomersModal(t)}
                        className="text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-105 inline-block"
                        style={{ background: "var(--bg-elevated)", color: "var(--accent)", borderColor: "var(--accent)" }}
                      >
                        {t.customer_count || 0} Customers
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {t.device_count || 0} / {t.max_devices || "∞"} used
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium" 
                            style={{ 
                              background: t.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : t.status === 'archived' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: t.status === 'active' ? '#22c55e' : t.status === 'archived' ? '#eab308' : '#ef4444' 
                            }}>
                        <span className="capitalize">{t.status || 'Active'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {t.plan_name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" 
                              style={{ 
                                background: t.plan_name.toLowerCase().includes('enterprise') ? 'rgba(168, 85, 247, 0.1)' : t.plan_name.toLowerCase().includes('professional') ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                color: t.plan_name.toLowerCase().includes('enterprise') ? '#a855f7' : t.plan_name.toLowerCase().includes('professional') ? '#3b82f6' : '#22c55e'
                              }}>
                          {t.plan_name}
                        </span>
                      ) : (
                        <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>No Plan</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs" style={{ color: "var(--text-muted)" }}>
                      {t.expires_at ? new Date(t.expires_at).toLocaleDateString("en-GB") : "Never"}
                    </td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      {new Date(t.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-right sticky right-0 z-10" style={{ background: "var(--bg-surface)", borderLeft: "1px solid var(--bg-border)" }}>
                      <ActionMenu
                        actions={[
                          { label: "Change Password", onClick: () => { setChangePasswordModal({ id: t.id, name: t.name }); setChangePasswordForm({ new_password: "", confirm_password: "" }); } },
                          { label: "Edit", onClick: () => openEditModal(t) },
                          { 
                            label: t.status === "archived" ? "Activate" : "Archive", 
                            onClick: () => handleUpdateStatus(t.id, t.status === "archived" ? "active" : "archived"),
                            variant: t.status === "archived" ? "success" : "warning"
                          },
                          { label: "Delete", onClick: () => handleDelete(t.id), variant: "danger" }
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 px-4">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredTenants.length)} of {filteredTenants.length} entries
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--bg-border)" }}
              >
                Previous
              </button>
              <span className="px-4 py-1.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--bg-border)" }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customers List Modal */}
      <Modal open={!!showCustomersModal} onClose={() => setShowCustomersModal(null)} width={640}>
        <ModalHeader
          title={`Customers — ${showCustomersModal?.name ?? ""}`}
          subtitle="Customers and assigned IP addresses for this ISP."
          onClose={() => setShowCustomersModal(null)}
        />
        <ModalBody className="max-h-[60vh] overflow-y-auto">
          {loadingCustomers ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            </div>
          ) : tenantCustomers.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>No customers found for this ISP.</div>
          ) : (
            <div className="space-y-4">
              {tenantCustomers.map(c => (
                <div key={c.id} className="p-4 rounded-xl border transition-colors" style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)" }}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{c.name}</h3>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}><CopyText value={c.contact_email} /></p>
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full border" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", borderColor: "rgba(59,130,246,0.2)" }}>
                      {c.ips.length} IPs Assigned
                    </span>
                  </div>
                  {c.ips.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: "var(--bg-border)" }}>
                      {c.ips.map((ip, idx) => (
                        <span key={idx} className="text-xs font-mono px-2 py-1 rounded-md border" style={{ background: "var(--bg-elevated)", borderColor: "var(--bg-border)", color: "var(--text-secondary)" }}>{ip}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ModalBody>
      </Modal>

      {/* Add/Edit ISP Modal */}
      <FormModal
        open={showModal}
        title={isEditing ? "Edit ISP Account" : "Create ISP Account"}
        subtitle={isEditing ? "Update this ISP's details." : "Set up a new ISP tenant account."}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        submitLabel={isEditing ? "Save Changes" : "Create ISP"}
      >
        <FormField label="ISP Name">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
            style={inputStyle}
            placeholder="e.g. Acme Telecom"
          />
        </FormField>
        <FormField label="Company Email">
          <input
            required
            type="email"
            pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            title="Please enter a valid email address"
            value={form.company_email}
            onChange={(e) => setForm({ ...form, company_email: e.target.value })}
            className={inputCls}
            style={inputStyle}
            placeholder="e.g. admin@acme.com"
          />
        </FormField>
        {!isEditing && (
          <>
            <FormField label="Password">
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  minLength={6}
                  value={form.admin_password}
                  onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                  className={`${inputCls} pr-10`}
                  style={inputStyle}
                  placeholder="Enter a secure password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showPassword
                    ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  }
                </button>
              </div>
            </FormField>
            <FormField label="Confirm Password">
              <div className="relative">
                <input
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  minLength={6}
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  className={`${inputCls} pr-10`}
                  style={inputStyle}
                  placeholder="Confirm password"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showConfirmPassword
                    ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  }
                </button>
              </div>
            </FormField>
          </>
        )}
      </FormModal>

      {changePasswordModal && (
        <FormModal
          title={`Change Password for ${changePasswordModal.name}`}
          open={true}
          onClose={() => setChangePasswordModal(null)}
          onSubmit={handleChangePasswordSubmit}
          submitLabel="Save Password"
          loading={changingPassword}
        >
          <FormField label="New Password">
            <input
              type={showPassword ? "text" : "password"}
              required
              className={inputCls}
              style={inputStyle}
              value={changePasswordForm.new_password}
              onChange={(e) => setChangePasswordForm({ ...changePasswordForm, new_password: e.target.value })}
              placeholder="••••••••"
            />
          </FormField>
          <FormField label="Confirm New Password">
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              className={inputCls}
              style={inputStyle}
              value={changePasswordForm.confirm_password}
              onChange={(e) => setChangePasswordForm({ ...changePasswordForm, confirm_password: e.target.value })}
              placeholder="••••••••"
            />
          </FormField>
          <div className="flex items-center gap-2 mt-2">
            <input 
              type="checkbox" 
              id="show-passwords" 
              checked={showPassword}
              onChange={(e) => {
                setShowPassword(e.target.checked);
                setShowConfirmPassword(e.target.checked);
              }}
              className="rounded" 
            />
            <label htmlFor="show-passwords" className="text-xs" style={{ color: "var(--text-secondary)" }}>Show Passwords</label>
          </div>
        </FormModal>
      )}

      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={confirmDialog.onConfirm}
          onCancel={closeConfirm}
        />
      )}
    </div>
  );
}
