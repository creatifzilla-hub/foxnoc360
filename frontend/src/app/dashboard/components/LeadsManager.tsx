"use client";

import { useEffect, useState, useRef } from "react";
import { Icons } from ".//Sidebar";
import { useToast } from ".//Toast";
import FormModal, { FormField, inputCls, inputStyle } from ".//FormModal";
import Btn, { BtnIcons } from ".//Btn";
import ActionMenu from ".//ActionMenu";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Lead {
  id: string;
  name: string;
  phone: string;
  location: string;
  interested_plan?: string;
  status: string;
  assigned_agent_id?: string;
  follow_up_at?: string;
  created_at: string;
}

interface Agent {
    id: string;
    email: string;
    full_name?: string;
}

const STAGES = [
  { value: "new", label: "New Lead", color: "hsl(210, 80%, 60%)" },
  { value: "contacted", label: "Contacted", color: "hsl(280, 70%, 60%)" },
  { value: "feasibility", label: "Site Feasibility", color: "hsl(40, 90%, 50%)" },
  { value: "installation", label: "Scheduled", color: "hsl(180, 70%, 40%)" },
  { value: "installed", label: "Converted", color: "hsl(142, 70%, 45%)" },
  { value: "rejected", label: "Rejected", color: "hsl(0, 70%, 60%)" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function LeadsManager({ 
  embedded = false, 
  defaultStatusFilter = "all" 
}: { 
  embedded?: boolean; 
  defaultStatusFilter?: string; 
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Table State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter);

  useEffect(() => {
    setStatusFilter(defaultStatusFilter);
  }, [defaultStatusFilter]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Lead; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({ status: "new" });
  
  // CSV Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const { success, error, info } = useToast();

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await fetch(`${API_BASE}/sales/leads`, { headers });
      if (res.ok) setLeads(await res.json());

      const agentRes = await fetch(`${API_BASE}/team/users`, { headers });
      if (agentRes.ok) {
          const all = await agentRes.json();
          setAgents(all.filter((u: any) => u.role === 'Sales Agent' || u.role === 'operator' || u.role === 'isp_admin'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- Filtering & Sorting ---
  let filteredLeads = leads.filter(l => {
    const today = new Date().toISOString().split('T')[0];
    const isToday = l.follow_up_at && l.follow_up_at.startsWith(today);
    const isMissed = l.follow_up_at && new Date(l.follow_up_at) < new Date() && !l.follow_up_at.startsWith(today) && l.status !== 'installed' && l.status !== 'rejected';
    
    let statusMatch = true;
    if (statusFilter === 'follow_ups_today') statusMatch = !!isToday;
    else if (statusFilter === 'missed_follow_ups') statusMatch = !!isMissed;
    else if (statusFilter !== "all") statusMatch = (l.status === statusFilter);

    return statusMatch &&
      (l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       l.phone.includes(searchTerm) || 
       (l.location || "").toLowerCase().includes(searchTerm.toLowerCase()));
  });
  if (sortConfig !== null) {
    filteredLeads.sort((a, b) => {
      const aVal = a[sortConfig.key] || "";
      const bVal = b[sortConfig.key] || "";
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }

  // Pagination
  const totalRows = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + pageSize);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, pageSize]);

  const handleSort = (key: keyof Lead) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Lead) => {
    const isSorted = sortConfig?.key === key;
    return (
      <span className="transition-colors" style={{ color: isSorted ? "var(--accent)" : "var(--text-muted)", opacity: isSorted ? 1 : 0.4 }}>
        {isSorted ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    );
  };

  // --- Mutators ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const url = isEditing ? `${API_BASE}/sales/leads/${form.id}` : `${API_BASE}/sales/leads`;
      const method = isEditing ? "PUT" : "POST";
      
      const payload: any = { ...form };
      Object.keys(payload).forEach(key => { if (payload[key] === "") delete payload[key]; });

      if (payload.follow_up_at) {
          try { payload.follow_up_at = new Date(payload.follow_up_at).toISOString(); } 
          catch (e) { console.error("Invalid date", e); }
      }
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        success(isEditing ? "Lead updated successfully." : "New lead captured.");
        setShowModal(false);
        setForm({ status: "new" });
        fetchData();
      } else {
          const err = await res.json().catch(() => ({}));
          error(`Failed to save lead: ${err.detail || 'Validation error'}`);
      }
    } catch (err) { error("An error occurred."); }
  };

  const handleConvert = async (id: string, name: string) => {
    if (!confirm(`Convert ${name} to a paying customer?`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/sales/leads/${id}/convert`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { success(`${name} converted!`); fetchData(); } 
      else { error("Conversion failed."); }
    } catch (err) { }
  };

  const handleDelete = async (id: string, name: string) => {
      if (!confirm(`Delete lead ${name}?`)) return;
      try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/sales/leads/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) { success("Lead removed."); fetchData(); } 
          else { error("Failed to delete lead."); }
      } catch (err) {}
  };

  // --- Bulk & Selection ---
  const toggleSelectAll = () => {
    const allOnPage = paginatedLeads.map(l => l.id);
    const allSelected = allOnPage.length > 0 && allOnPage.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) allOnPage.forEach(id => next.delete(id));
    else allOnPage.forEach(id => next.add(id));
    setSelectedIds(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Permanently delete ${selectedIds.size} selected lead(s)?`)) return;
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/sales/leads/bulk-delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        });
        if (res.ok) {
            success(`${selectedIds.size} leads deleted.`);
            setSelectedIds(new Set());
            fetchData();
        } else { error("Bulk delete failed."); }
    } catch (err) { error("An error occurred."); }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
      const label = STAGES.find(s => s.value === newStatus)?.label;
      if (!confirm(`Change stage of ${selectedIds.size} leads to ${label}?`)) return;
      try {
          const token = localStorage.getItem("token");
          // Reusing the PUT endpoint iteratively inside a promise block
          await Promise.all(Array.from(selectedIds).map(id => fetch(`${API_BASE}/sales/leads/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status: newStatus })
          })));
          success(`${selectedIds.size} leads successfully updated.`);
          setSelectedIds(new Set());
          fetchData();
      } catch (err) { error("Failed bulk status update"); }
  };

  // --- CSV Import / Export ---
  const handleExport = () => {
    const csvContent = [
      ["Name", "Phone", "Location", "Interested Plan", "Pipeline Stage", "Created"].join(","),
      ...filteredLeads.map(l => [
        `"${l.name.replace(/"/g, '""')}"`,
        `"${l.phone}"`,
        `"${l.location || ""}"`,
        `"${l.interested_plan || ""}"`,
        `"${l.status}"`,
        `"${new Date(l.created_at).toLocaleDateString()}"`
      ].join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "pipeline_leads_export.csv";
    link.click();
  };

  const downloadCSVTemplate = () => {
      const template = "Name,Phone,Location\nJohn Doe,1234567890,City Center\nAcme Corp,0987654321,Industrial Area";
      const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "leads_import_template.csv";
      link.click();
  };

  const parseCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
          const text = evt.target?.result as string;
          const rows = text.split('\n').map(r => r.trim()).filter(r => r);
          if (rows.length < 2) return error("CSV file appears to be empty or missing data rows.");
          
          const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
          const nameIdx = headers.indexOf("name");
          const phoneIdx = headers.indexOf("phone");
          if (nameIdx === -1 || phoneIdx === -1) return error("CSV must contain 'Name' and 'Phone' column headers.");

          const locationIdx = headers.indexOf("location");
          
          setImporting(true);
          const token = localStorage.getItem("token");
          let parsedCount = 0;

          // Process chunks sequentially to respect load
          for (let i = 1; i < rows.length; i++) {
              const cols = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
              if (cols.length < 2 || !cols[nameIdx] || !cols[phoneIdx]) continue;

              const payload = {
                  name: cols[nameIdx],
                  phone: cols[phoneIdx],
                  location: locationIdx !== -1 ? cols[locationIdx] : "",
                  status: "new"
              };

              try {
                  await fetch(`${API_BASE}/sales/leads`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify(payload)
                  });
                  parsedCount++;
              } catch (err) {}
          }
          
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          success(`Successfully imported ${parsedCount} leads from CSV!`);
          fetchData();
      };
      reader.readAsText(file);
  };

  return (
    <div id="leads-manager-table" className={embedded ? "w-full" : "min-h-screen p-6"} style={embedded ? {} : { background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-[90rem] mx-auto">
        
        {/* Header */}
        {!embedded && (
          <div className="flex items-center justify-between mb-8">
             <div>
                <h1 className="flex items-center gap-3 text-[22px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                   <span className="w-8 h-8 flex items-center justify-center" style={{ color: "var(--accent)" }}>{Icons.sales}</span>
                   Leads Pipeline
                </h1>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Manage prospects, bulk import, and track conversion pipeline statuses.</p>
             </div>
             <div className="flex items-center gap-3">
                 <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={parseCSVFile} />
                 <Btn variant="secondary" onClick={downloadCSVTemplate}>CSV Template</Btn>
                 <Btn variant="secondary" icon={BtnIcons.upload} onClick={() => fileInputRef.current?.click()}>Import CSV</Btn>
                 <Btn variant="secondary" icon={BtnIcons.download} onClick={handleExport}>Export CSV</Btn>
                 <Btn variant="primary" icon={BtnIcons.plus} onClick={() => { setIsEditing(false); setForm({ status: "new" }); setShowModal(true); }}>Add Lead</Btn>
             </div>
          </div>
        )}

        {/* Toolbar Filters & Bulk */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
           <div className="flex items-center gap-3">
              <input 
                type="text" 
                placeholder="Search leads, phones, areas..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="text-sm rounded-xl px-4 py-2 outline-none w-64 transition-colors"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
              />
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                className="text-sm font-medium rounded-xl px-4 py-2 outline-none cursor-pointer border"
                style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
              >
                 <option value="all">All Stages</option>
                 {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {selectedIds.size > 0 && <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selectedIds.size} selected</span>}
           </div>

           <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                 <>
                   <select 
                     onChange={(e) => {
                       if (e.target.value) {
                          handleBulkStatusChange(e.target.value);
                          e.target.value = "";
                       }
                     }}
                     defaultValue=""
                     className="text-sm font-semibold rounded-xl px-4 py-2 outline-none cursor-pointer border transition-colors hover:border-accent"
                     style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                   >
                     <option value="" disabled>Change Stage...</option>
                     {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                   </select>
                   <Btn variant="secondary" icon={BtnIcons.trash} onClick={handleBulkDelete}>
                       Delete {selectedIds.size}
                   </Btn>
                 </>
              )}
           </div>
        </div>

        {/* Table */}
        <div className="table-responsive rounded-[2rem] shadow-sm overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
           {importing && <div className="absolute inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center font-black animate-pulse text-accent">Parsing Elements...</div>}
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--bg-border)" }}>
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input type="checkbox" checked={paginatedLeads.length > 0 && paginatedLeads.every(l => selectedIds.has(l.id))} onChange={toggleSelectAll} className="rounded accent-orange-500" style={{ borderColor: "var(--bg-border)" }} />
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer group select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1.5">Prospect Name {renderSortIcon('name')}</div>
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer group select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => handleSort('location')}>
                  <div className="flex items-center gap-1.5">Area / Location {renderSortIcon('location')}</div>
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer group select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => handleSort('assigned_agent_id')}>
                  <div className="flex items-center gap-1.5">Agent {renderSortIcon('assigned_agent_id')}</div>
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer group select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5">Pipeline Stage {renderSortIcon('status')}</div>
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider cursor-pointer group select-none" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} onClick={() => handleSort('created_at')}>
                  <div className="flex items-center gap-1.5">Added {renderSortIcon('created_at')}</div>
                </th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--bg-border)" }}>
              {loading ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading pipeline...</td></tr>
              ) : paginatedLeads.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No leads found.</td></tr>
              ) : paginatedLeads.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" style={{ borderBottom: "1px solid var(--bg-border)" }}>
                  <td className="px-6 py-4 text-center">
                    <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} className="rounded accent-orange-500" style={{ borderColor: "var(--bg-border)" }} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>{l.name}</div>
                    <div className="text-[10px] opacity-50 font-bold uppercase tracking-wider">{l.phone}</div>
                  </td>
                  <td className="px-6 py-4 font-bold opacity-70">{l.location || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-[9px] font-black uppercase shadow-inner">
                           {l.assigned_agent_id ? agents.find(a => a.id === l.assigned_agent_id)?.email.substring(0,2) : '?'}
                       </div>
                       <span className="text-[11px] font-bold tracking-tight opacity-70">
                         {l.assigned_agent_id ? agents.find(a => a.id === l.assigned_agent_id)?.full_name || agents.find(a => a.id === l.assigned_agent_id)?.email.split('@')[0] : 'Unassigned'}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span 
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm" 
                        style={{ 
                            background: `${STAGES.find(s => s.value === l.status)?.color}15`, 
                            color: STAGES.find(s => s.value === l.status)?.color,
                            borderColor: `${STAGES.find(s => s.value === l.status)?.color}30`
                        }}
                    >
                      {STAGES.find(s => s.value === l.status)?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-[10px] uppercase font-bold opacity-40">
                     {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ActionMenu
                        actions={[
                            { label: "Update Pipeline Stage", onClick: () => { setForm(l); setIsEditing(true); setShowModal(true); } },
                            { label: "Convert to Customer", onClick: () => handleConvert(l.id, l.name), disabled: l.status === 'installed', variant: "success" },
                            { label: "Delete Lead", onClick: () => handleDelete(l.id, l.name), variant: "danger" }
                        ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {totalRows > 10 && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 mt-2 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)" }}>
            <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              <span>{startIndex + 1}–{Math.min(startIndex + pageSize, totalRows)} of {totalRows} leads</span>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Rows/page:</span>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="text-sm rounded-lg px-2 py-1 outline-none cursor-pointer border" style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}>
                  {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Btn size="sm" variant="ghost" onClick={() => setCurrentPage(1)} disabled={safePage === 1}>««</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setCurrentPage(Math.max(1, safePage - 1))} disabled={safePage === 1}>‹</Btn>
              <span className="text-xs font-bold px-4 opacity-40">Page {safePage} of {totalPages}</span>
              <Btn size="sm" variant="ghost" onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}>›</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages}>»»</Btn>
            </div>
          </div>
        )}

      </div>

      {/* Form Modal */}
      <FormModal
        open={showModal}
        title={isEditing ? "Edit Lead" : "Add New Lead"}
        subtitle={isEditing ? "Update lead status or details below." : "Capture prospect details for your sales pipeline."}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        submitLabel={isEditing ? "Save Configuration" : "Save Lead"}
        width={680}
      >
        <div className="grid grid-cols-2 gap-4">
            <FormField label="Full Name">
                <input required value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} className={inputCls} style={inputStyle} placeholder="e.g. Tony Stark" />
            </FormField>
            <FormField label="Phone Number">
                <input required value={form.phone || ""} onChange={e => setForm({...form, phone: e.target.value})} className={inputCls} style={inputStyle} placeholder="+91..." />
            </FormField>
        </div>
        <FormField label="Area / Location">
            <input value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})} className={inputCls} style={inputStyle} placeholder="e.g. Downtown / Block C" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
            <FormField label="Assign to Agent">
                <select value={form.assigned_agent_id || ""} onChange={e => setForm({...form, assigned_agent_id: e.target.value})} className={inputCls} style={inputStyle}>
                    <option value="">— Unassigned —</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.full_name ? `${a.full_name} (${a.email})` : a.email}</option>)}
                </select>
            </FormField>
            <FormField label="Pipeline Stage">
                <select value={form.status || "new"} onChange={e => setForm({...form, status: e.target.value})} className={inputCls} style={inputStyle}>
                    {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </FormField>
        </div>
        <FormField label="Follow-up Date & Time">
             <input type="datetime-local" value={form.follow_up_at?.substring(0,16) || ""} onChange={e => setForm({...form, follow_up_at: e.target.value})} className={inputCls} style={inputStyle} />
        </FormField>
      </FormModal>
    </div>
  );
}
