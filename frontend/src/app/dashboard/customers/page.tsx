"use client";
import CopyText from "../components/CopyText";
import ConfirmDialog from "../components/ConfirmDialog";
import FormModal, { FormField, inputCls, inputStyle } from "../components/FormModal";
import Btn, { BtnIcons } from "../components/Btn";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "../components/Sidebar";
import ActionMenu from "../components/ActionMenu";
import { useRole } from "../../hooks/useRole";
import { useToast } from "../components/Toast";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Customer {
  id: string;
  name: string;
  contact_email: string;
  status?: string;
  created_at: string;
  tenant_name?: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", contact_email: "", status: "active" });
  const [isEditing, setIsEditing] = useState(false);
  
  // Subscription limits
  const [maxCustomers, setMaxCustomers] = useState(0);
  const [planName, setPlanName] = useState("");
  const { isSuperadmin } = useRole();
  
  // Table features state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Customer; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const showConfirm = useCallback((title: string, message: string, fn: () => void) => setConfirmDialog({ open: true, title, message, onConfirm: fn }), []);
  const closeConfirm = useCallback(() => setConfirmDialog(null), []);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCustomers(await res.json());

      // Fetch Profile for limits
      const profRes = await fetch(`${API_BASE}/profile/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (profRes.ok) {
        const prof = await profRes.json();
        setMaxCustomers(prof.max_customers || 0);
        setPlanName(prof.plan_name || "");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const url = isEditing ? `${API_BASE}/customers/${form.id}` : `${API_BASE}/customers`;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: form.name, contact_email: form.contact_email }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        const errMessage = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail || errData);
        alert(`Failed to save customer: ${errMessage}`);
        return;
      }
      
      setForm({ id: "", name: "", contact_email: "", status: "active" });
      setIsEditing(false);
      setShowModal(false);
      fetchCustomers();
    } catch (e) {
      console.error(e);
      alert("A network error occurred.");
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      "Delete Customer",
      "Are you sure you want to delete this customer? This action cannot be undone.",
      async () => {
        closeConfirm();
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/customers/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            fetchCustomers();
            setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
          } else { alert("Failed to delete Customer."); }
        } catch (e) { console.error(e); }
      }
    );
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/customers/${id}/status?status=${newStatus}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchCustomers();
    } catch (e) {
      console.error(e);
    }
  };

  const openEditModal = (c: Customer) => {
    setForm({ id: c.id, name: c.name, contact_email: c.contact_email || "", status: c.status || "active" });
    setIsEditing(true);
    setShowModal(true);
  };
  
  const openCreateModal = () => {
    setForm({ id: "", name: "", contact_email: "", status: "active" });
    setIsEditing(false);
    setShowModal(true);
  };

  // Sorting
  const sortedCustomers = [...customers].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Filtering
  const filteredCustomers = sortedCustomers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.contact_email && c.contact_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.tenant_name && c.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination
  const totalRows = filteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + pageSize);

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | string)[] = [];
    if (safePage <= 4) { pages.push(1, 2, 3, 4, 5, '...', totalPages); }
    else if (safePage >= totalPages - 3) { pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages); }
    else { pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages); }
    return pages;
  };
  const goTo = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  // Reset pagination on search filter or page size change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, pageSize]);

  const requestSort = (key: keyof Customer) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Customer) => {
    const isSorted = sortConfig?.key === key;
    return (
      <span className="ml-1 transition-colors" style={{ color: isSorted ? "var(--accent)" : "var(--text-muted)", opacity: isSorted ? 1 : 0.4 }}>
        {isSorted ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    );
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedCustomers.map(c => c.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    
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

  const { success, error: toastError } = useToast();

  const handleBulkDelete = async () => {
    showConfirm(
      `Delete ${selectedIds.size} Customer${selectedIds.size > 1 ? "s" : ""}`,
      `Are you sure you want to permanently delete ${selectedIds.size} selected customer(s)? All their devices and data will also be removed.`,
      async () => {
        closeConfirm();
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/customers/bulk-delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
          });
          if (res.ok || res.status === 204) {
            success(`${selectedIds.size} customers deleted.`);
            setSelectedIds(new Set());
            fetchCustomers();
          } else {
            const err = await res.json().catch(() => ({}));
            toastError(`Bulk delete failed: ${err.detail || res.statusText}`);
          }
        } catch (e) {
          console.error(e);
          toastError("A network error occurred.");
        }
      }
    );
  };

  const handleExport = () => {
    const csvContent = [
      ["Customer Name", "Contact Email", "Status", "Created At"].join(","),
      ...filteredCustomers.map(c => [c.name, c.contact_email || "", c.status || "active", new Date(c.created_at).toLocaleDateString()].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "customers.csv";
    link.click();
  };

  const isLimitReached = maxCustomers > 0 && customers.length >= maxCustomers;
  const showUpgradeBanner = isLimitReached && !isSuperadmin;

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-6xl mx-auto">
        {showUpgradeBanner && (
          <div className="mb-6 p-4 rounded-2xl flex items-center justify-between border animate-in slide-in-from-top duration-500 shadow-xl shadow-red-500/5" 
               style={{ background: "rgba(251, 113, 133, 0.1)", borderColor: "rgba(251, 113, 133, 0.2)" }}>
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-sm font-bold" style={{ color: "#fb7185" }}>Customer Limit Reached</p>
                <p className="text-xs opacity-70">Your {planName} plan is limited to {maxCustomers} customers. You cannot add more customers at this time.</p>
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

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="flex items-center gap-3 text-[22px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              <span className="w-8 h-8 flex items-center justify-center" style={{ color: "var(--accent)" }}>{Icons.users}</span>
              Customers
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Manage business clients and their contact emails</p>
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
              disabled={isLimitReached && !isSuperadmin}
              icon={!(isLimitReached && !isSuperadmin) ? BtnIcons.plus : undefined}
            >
              {isLimitReached && !isSuperadmin ? 'Limit Reached' : 'Add Customer'}
            </Btn>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <input 
              type="text" 
              placeholder="Search Customers..." 
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
               <Btn variant="secondary" size="sm" icon={BtnIcons.trash} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20" onClick={handleBulkDelete}>
                  Delete {selectedIds.size}
               </Btn>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive rounded-2xl shadow-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--bg-border)" }}>
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input type="checkbox" checked={paginatedCustomers.length > 0 && selectedIds.size === paginatedCustomers.length} onChange={toggleSelectAll} className="rounded accent-orange-500" style={{ borderColor: "var(--bg-border)" }} />
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('name')}>
                  Customer Name {renderSortIcon('name')}
                </th>
                {isSuperadmin && (
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('tenant_name' as keyof Customer)}>
                    ISP Tenant {renderSortIcon('tenant_name' as keyof Customer)}
                  </th>
                )}
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('contact_email')}>
                  Contact Email {renderSortIcon('contact_email')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('status')}>
                  Status {renderSortIcon('status')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('created_at')}>
                  Created {renderSortIcon('created_at')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isSuperadmin ? 7 : 6} className="px-6 py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading...</td></tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr><td colSpan={isSuperadmin ? 7 : 6} className="px-6 py-8 text-center" style={{ color: "var(--text-muted)" }}>No customers found.</td></tr>
              ) : (
                paginatedCustomers.map((c) => (
                  <tr key={c.id} className="transition-colors" style={{ borderBottom: "1px solid var(--bg-border)" }}>
                    <td className="px-6 py-4 text-center">
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded accent-orange-500" style={{ borderColor: "var(--bg-border)" }} />
                    </td>
                    <td className="px-6 py-4 font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</td>
                    {isSuperadmin && (
                      <td className="px-6 py-4 text-xs font-bold" style={{ color: "var(--accent)" }}>{c.tenant_name || "N/A"}</td>
                    )}
                    <td className="px-6 py-4" style={{ color: "var(--accent)" }}><CopyText value={c.contact_email || ""} /></td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium" 
                            style={{ 
                              background: (!c.status || c.status === 'active') ? 'rgba(34, 197, 94, 0.1)' : c.status === 'archived' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: (!c.status || c.status === 'active') ? '#22c55e' : c.status === 'archived' ? '#eab308' : '#ef4444' 
                            }}>
                        <span className="capitalize">{c.status || 'Active'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs" style={{ color: "var(--text-muted)" }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <ActionMenu
                        actions={[
                          { label: "Edit", onClick: () => openEditModal(c) },
                          { 
                            label: c.status === "archived" ? "Activate" : "Archive", 
                            onClick: () => handleUpdateStatus(c.id, c.status === "archived" ? "active" : "archived"),
                            variant: c.status === "archived" ? "success" : "warning"
                          },
                          { label: "Delete", onClick: () => handleDelete(c.id), variant: "danger" }
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
        {totalRows > 10 && (
          <div
            className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 mt-2 rounded-xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)" }}
          >
            {/* Left: count + per-page */}
            <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              <span>{startIndex + 1}–{Math.min(startIndex + pageSize, totalRows)} of {totalRows} customers</span>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Rows/page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="text-sm rounded-lg px-2 py-1 outline-none cursor-pointer"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                >
                  {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {/* Right: page nav */}
            <div className="flex items-center gap-1">
              <button onClick={() => goTo(1)} disabled={safePage === 1} className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40" style={{ color: "var(--text-secondary)" }} onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = "var(--bg-surface)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>««</button>
              <button onClick={() => goTo(safePage - 1)} disabled={safePage === 1} className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40" style={{ color: "var(--text-secondary)" }} onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = "var(--bg-surface)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>‹</button>
              {getPageNumbers().map((page, i) => page === '...' ? (
                <span key={`e-${i}`} className="px-2 py-1.5 text-xs" style={{ color: "var(--text-muted)" }}>…</span>
              ) : (
                <button key={page} onClick={() => goTo(page as number)} className="min-w-[32px] px-2 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: safePage === page ? "var(--accent)" : "transparent", color: safePage === page ? "white" : "var(--text-secondary)" }} onMouseEnter={e => safePage !== page && (e.currentTarget.style.background = "var(--bg-surface)")} onMouseLeave={e => safePage !== page && (e.currentTarget.style.background = "transparent")}>{page}</button>
              ))}
              <button onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages} className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40" style={{ color: "var(--text-secondary)" }} onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = "var(--bg-surface)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>›</button>
              <button onClick={() => goTo(totalPages)} disabled={safePage === totalPages} className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40" style={{ color: "var(--text-secondary)" }} onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = "var(--bg-surface)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>»»</button>
            </div>
          </div>
        )}
      </div>

      <FormModal
        open={showModal}
        title={isEditing ? "Edit Customer" : "Add New Customer"}
        subtitle={isEditing ? "Update the customer's details below." : "Fill in the details to add a new customer."}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        submitLabel={isEditing ? "Save Changes" : "Save Customer"}
      >
        <FormField label="Business / Customer Name">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
            style={inputStyle}
            placeholder="e.g. Stark Industries"
          />
        </FormField>
        <FormField label="Contact Email">
          <input
            required
            type="email"
            pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            title="Please enter a valid email address"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            className={inputCls}
            style={inputStyle}
            placeholder="e.g. it@stark.com"
          />
        </FormField>
      </FormModal>
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
