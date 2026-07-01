"use client";
import CopyText from "../components/CopyText";
import ConfirmDialog from "../components/ConfirmDialog";
import ResetSLAModal from "../components/ResetSLAModal";
import FormModal, { FormField, inputCls, inputStyle } from "../components/FormModal";
import Btn, { BtnIcons } from "../components/Btn";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "../components/Sidebar";
import ActionMenu from "../components/ActionMenu";
import { useRole } from "../../hooks/useRole";
import { useToast } from "../components/Toast";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.foxnoc360.com/api/v1";

interface Device {
  id: string;
  name: string;
  ip_address: string;
  location: string;
  status: string;
  customer_id: string;
  customer_name?: string;
  tenant_name?: string;
}

interface Customer {
  id: string;
  name: string;
}

export default function DevicesAdminPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", ip_address: "", location: "", customer_id: "", status: "up" });
  const [isEditing, setIsEditing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Subscription limits
  const [maxDevices, setMaxDevices] = useState(0);
  const [planName, setPlanName] = useState("");
  const { isSuperadmin } = useRole();

  // Table features state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Device; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  // SLA Reset state
  const [resetSLAModal, setResetSLAModal] = useState<{ id: string; name: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const showConfirm = useCallback((title: string, message: string, onConfirmAction: () => void) => {
    setConfirmDialog({ open: true, title, message, onConfirm: onConfirmAction });
  }, []);
  const closeConfirm = useCallback(() => setConfirmDialog(null), []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch profile to get role and limits
      const profRes = await fetch(`${API_BASE}/profile/`, { headers });
      if (profRes.ok) {
        const prof = await profRes.json();
        setMaxDevices(prof.max_devices || 0);
        setPlanName(prof.plan_name || "");
      }

      // Fetch customers
      const custRes = await fetch(`${API_BASE}/customers`, { headers });
      if (custRes.ok) setCustomers(await custRes.json());
      
      // Fetch devices
      const rawDevRes = await fetch(`${API_BASE}/devices`, { headers });
      if (rawDevRes.ok) setDevices(await rawDevRes.json());

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      const url = isEditing ? `${API_BASE}/devices/${form.id}` : `${API_BASE}/devices`;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: form.name, 
          ip_address: form.ip_address, 
          location: form.location, 
          customer_id: form.customer_id || null
        }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        const errMessage = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail || errData);
        alert(`Failed to save device: ${errMessage}`);
        return;
      }
      
      setForm({ id: "", name: "", ip_address: "", location: "", customer_id: "", status: "up" });
      setIsEditing(false);
      setShowModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert("A network error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      "Delete Device",
      "Are you sure you want to delete this device? All associated ping logs and downtime records will also be removed.",
      async () => {
        closeConfirm();
        setActionLoading(true);
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/devices/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            fetchData();
            setSelectedIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }
        } catch (e) { 
          console.error(e); 
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleResetSLA = async () => {
    if (!resetSLAModal) return;
    setResetting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/sla/reset?device_id=${resetSLAModal.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setResetSLAModal(null);
        alert("SLA data has been reset successfully.");
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

  const openEditModal = (d: Device) => {
    setForm({ id: d.id, name: d.name, ip_address: d.ip_address, location: d.location || "", customer_id: d.customer_id || "", status: d.status || "up" });
    setIsEditing(true);
    setShowModal(true);
  };
  
  const openCreateModal = () => {
    setForm({ id: "", name: "", ip_address: "", location: "", customer_id: "", status: "up" });
    setIsEditing(false);
    setShowModal(true);
  };

  // Sorting
  const sortedDevices = [...devices].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Filtering
  const filteredDevices = sortedDevices.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.ip_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.customer_name && d.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (d.tenant_name && d.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination
  const totalRows = filteredDevices.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedDevices = filteredDevices.slice(startIndex, startIndex + pageSize);

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

  const requestSort = (key: keyof Device) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Device) => {
    const isSorted = sortConfig?.key === key;
    return (
      <span className="ml-1 transition-colors" style={{ color: isSorted ? "var(--accent)" : "var(--text-muted)", opacity: isSorted ? 1 : 0.4 }}>
        {isSorted ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    );
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedDevices.map(d => d.id);
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

  const { success, error: toastError } = useToast();

  const handleBulkDelete = async () => {
    showConfirm(
      `Delete ${selectedIds.size} Device${selectedIds.size > 1 ? "s" : ""}`,
      `Are you sure you want to permanently delete ${selectedIds.size} selected device(s)? All associated ping logs and downtime records will also be removed.`,
      async () => {
        closeConfirm();
        setActionLoading(true);
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/devices/bulk-delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: Array.from(selectedIds) }),
          });
          if (res.ok || res.status === 204) {
            success(`${selectedIds.size} devices deleted successfully.`);
            setSelectedIds(new Set());
            fetchData();
          } else {
            const err = await res.json().catch(() => ({}));
            toastError(`Bulk delete failed: ${err.detail || res.statusText}`);
          }
        } catch (e) {
          console.error(e);
          toastError("A network error occurred during bulk delete.");
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleExport = () => {
    const csvContent = [
      ["Device Name", "IP Address", "Customer", "Location", "Status"].join(","),
      ...filteredDevices.map(d => [d.name, d.ip_address, d.customer_name || "", d.location || "", d.status].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "devices.csv";
    link.click();
  };

  const handleDownloadTemplate = () => {
    const template = "Customer Name,Customer Email,Device Name,Device IP,Location\nAcme Corp,admin@acmecorp.com,Core Router A1,192.168.1.1,New York Data Center\nWayne Ent,,Switch B2,10.0.0.5,Rack 42";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "devices_import_template.csv";
    link.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      let text = event.target?.result as string;
      // Sanitize BOM if present
      text = text.replace(/^\ufeff/, "");
      
      // Basic CSV parser
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length <= 1) {
        alert("The CSV file seems to be empty or only contains headers.");
        setIsImporting(false);
        return;
      }
      
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const rows = [];
      
      for (let i = 1; i < lines.length; i++) {
        // Regex to split by comma but ignore commas inside quotes
        const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());
        
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          if (idx < parts.length) {
            rowObj[h] = parts[idx];
          }
        });
        
        // Map to our expected schema
        // Support common aliases
        const dName = rowObj["device name"] || rowObj["device_name"] || rowObj["name"] || "";
        const dIp   = rowObj["device ip"] || rowObj["device_ip"] || rowObj["ip address"] || rowObj["ip"] || "";
        
        if (!dName || !dIp) continue; // Skip truly empty lines
        
        rows.push({
          customer_name: rowObj["customer name"] || rowObj["customer_name"] || rowObj["customer"] || "",
          customer_email: rowObj["customer email"] || rowObj["customer_email"] || rowObj["email"] || "",
          device_name: dName,
          device_ip: dIp,
          location: rowObj["location"] || rowObj["site"] || ""
        });
      }
      
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/devices/import/csv`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(rows)
        });
        
        const result = await res.json();
        if (res.ok) {
          if (result.error_count === 0) {
            alert(`✅ Import complete! Successfully added ${result.success_count} devices.`);
          } else {
            const errorLines = result.errors.join("\n");
            alert(
              `⚠️ Import finished with issues!\n\n` +
              `✅ Success: ${result.success_count} devices added\n` +
              `❌ Failed: ${result.error_count} devices\n\n` +
              `Reasons:\n${errorLines}`
            );
          }
          fetchData();
        } else {
          alert(`Import failed: ${result.detail || "Unknown error"}`);
        }
      } catch (err) {
        console.error(err);
        alert("A network error occurred during import.");
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = ''; // Reset input
      }
    };
    reader.readAsText(file);
  };

  const isLimitReached = maxDevices > 0 && devices.length >= maxDevices;
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
                <p className="text-sm font-bold" style={{ color: "#fb7185" }}>Device Limit Reached</p>
                <p className="text-xs opacity-70">Your {planName} plan is limited to {maxDevices} devices. You cannot add more devices at this time.</p>
              </div>
            </div>
            <Btn 
              variant="primary" 
              size="sm" 
              onClick={() => window.location.href = '/dashboard/subscriptions'}
              className="shadow-lg shadow-rose-500/20"
              style={{ background: "#fb7185" }}
            >
              Upgrade Plan
            </Btn>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="flex items-center gap-3 text-[22px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              <span className="w-8 h-8 flex items-center justify-center" style={{ color: "var(--accent)" }}>{Icons.device}</span>
              Network Devices
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Manage routers and switches to monitor</p>
          </div>
          <div className="flex gap-3">
            <Btn
              variant="secondary"
              onClick={handleDownloadTemplate}
              title="Download CSV Template"
            >
              CSV Template
            </Btn>
            
            <div className="relative">
              <label 
                className={`cursor-pointer ${isImporting || (isLimitReached && !isEditing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isLimitReached && !isEditing ? "Device limit reached" : "Import Devices"}
              >
                <Btn
                  as="div"
                  variant="secondary"
                  icon={BtnIcons.upload}
                  loading={isImporting}
                  disabled={isImporting || (isLimitReached && !isEditing)}
                >
                  {isImporting ? "Importing..." : "Import CSV"}
                </Btn>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isImporting || (isLimitReached && !isEditing)} />
              </label>
            </div>

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
              disabled={isLimitReached}
              icon={!isLimitReached ? BtnIcons.plus : undefined}
            >
              {isLimitReached ? "Limit Reached" : "Add Device IP"}
            </Btn>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <input 
              type="text" 
              placeholder="Search Devices..." 
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
                  <input type="checkbox" checked={paginatedDevices.length > 0 && paginatedDevices.every(d => selectedIds.has(d.id))} onChange={toggleSelectAll} className="rounded accent-orange-500" style={{ borderColor: "var(--bg-border)" }} />
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('name')}>
                  Device Name {renderSortIcon('name')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('ip_address')}>
                  IP Address {renderSortIcon('ip_address')}
                </th>
                {isSuperadmin && (
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('tenant_name' as keyof Device)}>
                    ISP Tenant {renderSortIcon('tenant_name' as keyof Device)}
                  </th>
                )}
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('customer_name')}>
                  Customer {renderSortIcon('customer_name')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('location')}>
                  Location {renderSortIcon('location')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => requestSort('status')}>
                  Status {renderSortIcon('status')}
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isSuperadmin ? 9 : 8} className="px-6 py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading...</td></tr>
              ) : filteredDevices.length === 0 ? (
                <tr><td colSpan={isSuperadmin ? 9 : 8} className="px-6 py-8 text-center" style={{ color: "var(--text-muted)" }}>No devices found.</td></tr>
              ) : (
                paginatedDevices.map((d) => {
                  const custName = d.customer_name || "—";
                  return (
                    <tr key={d.id} className="transition-colors" style={{ borderBottom: "1px solid var(--bg-border)" }}>
                      <td className="px-6 py-4 text-center">
                        <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} className="rounded accent-orange-500" style={{ borderColor: "var(--bg-border)" }} />
                      </td>
                      <td className="px-6 py-4 font-medium" style={{ color: "var(--text-primary)" }}>{d.name}</td>
                      <td className="px-6 py-4 font-mono text-sm" style={{ color: "var(--text-secondary)" }}><CopyText value={d.ip_address} /></td>
                      {isSuperadmin && (
                        <td className="px-6 py-4 text-xs font-bold" style={{ color: "var(--accent)" }}>{d.tenant_name || "N/A"}</td>
                      )}
                      <td className="px-6 py-4 text-sm" style={{ color: "var(--accent)" }}>{custName}</td>
                      <td className="px-6 py-4 text-sm" style={{ color: "var(--text-muted)" }}>{d.location || "—"}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium" 
                              style={{ 
                                background: d.status === 'up' ? 'rgba(34, 197, 94, 0.1)' : d.status === 'down' ? 'rgba(239, 68, 68, 0.1)' : d.status === 'maintenance' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                                color: d.status === 'up' ? '#22c55e' : d.status === 'down' ? '#ef4444' : d.status === 'maintenance' ? '#a855f7' : '#9ca3af' 
                              }}>
                          <span className="capitalize">{d.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ActionMenu
                          actions={[
                            { label: "Edit", onClick: () => openEditModal(d) },
                            { label: "Reset SLA Data", onClick: () => setResetSLAModal({ id: d.id, name: d.name }), variant: "danger" },
                            { label: "Delete", onClick: () => handleDelete(d.id), variant: "danger" }
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })
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
              <span>{startIndex + 1}–{Math.min(startIndex + pageSize, totalRows)} of {totalRows} devices</span>
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
        title={isEditing ? "Edit Device" : "Add Device IP"}
        subtitle={isEditing ? "Update the device details below." : "Add a new device to start monitoring."}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        submitLabel={isEditing ? "Save Changes" : "Save Device"}
        loading={saving}
      >
        <FormField label="Assign to Customer">
          <select
            required
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">— Select Customer —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Device Name">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
            style={inputStyle}
            placeholder="e.g. Core Router NY"
          />
        </FormField>
        <FormField label="IP Address">
          <input
            required
            value={form.ip_address}
            onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
            className={`${inputCls} font-mono`}
            style={inputStyle}
            placeholder="192.168.1.1"
          />
        </FormField>
        <FormField label="Location (Optional)">
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className={inputCls}
            style={inputStyle}
            placeholder="e.g. Rack A2 / New York"
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

      {resetSLAModal && (
        <ResetSLAModal
          deviceName={resetSLAModal.name}
          resetting={resetting}
          onConfirm={handleResetSLA}
          onCancel={() => setResetSLAModal(null)}
        />
      )}

      {(actionLoading || resetting || isImporting) && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-200">
          <div className="flex flex-col items-center gap-3 bg-neutral-900/80 px-6 py-5 rounded-2xl border border-neutral-800 shadow-xl">
            <svg className="w-10 h-10 animate-spin text-[var(--accent)]" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm font-medium text-white select-none">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
