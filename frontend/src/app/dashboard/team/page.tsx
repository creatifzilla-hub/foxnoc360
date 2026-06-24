"use client";

import { useEffect, useState } from "react";
import { Icons } from "../components/Sidebar";
import { useSubscription } from "../../hooks/useSubscription";
import { useRole } from "../../hooks/useRole";
import { useToast } from "../components/Toast";
import FormModal, { FormField, inputCls, inputStyle } from "../components/FormModal";
import Btn, { BtnIcons } from "../components/Btn";
import ActionMenu from "../components/ActionMenu";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface UserTeamMember {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  status: string;
  tenant_id: string;
  permissions?: {
      allowed_modules: string[];
      assigned_leads_only: boolean;
  };
}

interface TenantBrief {
    id: string;
    name: string;
}

export default function TeamManagementPage() {
  const { subscription, loading: subLoading, refresh: refreshSub } = useSubscription();
  const { isSuperadmin } = useRole();
  const { success, error, info } = useToast();
  const [users, setUsers] = useState<UserTeamMember[]>([]);
  const [tenants, setTenants] = useState<TenantBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<UserTeamMember & { password?: string, first_name?: string, last_name?: string }>>({});
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/team/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
      const token = localStorage.getItem("token");
      if (!token || !isSuperadmin) return;
      try {
          const tRes = await fetch(`${API_BASE}/tenants`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (tRes.ok) setTenants(await tRes.json());
      } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (isSuperadmin) {
      fetchTenants();
    }
  }, [isSuperadmin]);

  const handleModuleToggle = (mod: string) => {
    const current = form.permissions?.allowed_modules || [];
    const next = current.includes(mod) ? current.filter(m => m !== mod) : [...current, mod];
    setForm({
        ...form,
        permissions: {
            allowed_modules: next,
            assigned_leads_only: !!form.permissions?.assigned_leads_only
        }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const url = isEditing ? `${API_BASE}/team/users/${form.id}` : `${API_BASE}/team/users`;
      const method = isEditing ? "PUT" : "POST";

      const payload: any = { ...form };
      if (payload.first_name || payload.last_name) {
          payload.full_name = `${payload.first_name || ''} ${payload.last_name || ''}`.trim();
      }
      delete payload.first_name;
      delete payload.last_name;
      if (!payload.tenant_id) delete payload.tenant_id;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        success(isEditing ? "Team member updated successfully." : "New user created successfully.");
        setShowModal(false);
        fetchUsers();
        refreshSub();
      } else {
          const err = await res.json();
          const msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
          error(msg || "Failed to save user.");
      }
    } catch (err) { console.error(err); error("An error occurred during submission."); }
    finally { setSaving(false); }
  };

  const openCreateModal = () => {
      setForm({
          role: "Sales Agent",
          status: "active",
          tenant_id: "",
          first_name: "",
          last_name: "",
          permissions: {
              allowed_modules: ["dashboard", "sales"],
              assigned_leads_only: false
          }
      });
      setIsEditing(false);
      setShowModal(true);
  };

  const openEditModal = (u: UserTeamMember) => {
      const names = (u.full_name || '').split(' ');
      setForm({
          ...u,
          password: "", // Don't show existing hash
          first_name: names[0] || '',
          last_name: names.slice(1).join(' ') || ''
      });
      setIsEditing(true);
      setShowModal(true);
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY delete user ${email}? This action cannot be undone.`)) return;
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/team/users/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            success("Team member permanently deleted.");
            fetchUsers();
            refreshSub();
        } else {
            error("Failed to delete user.");
        }
    } catch (err) { console.error(err); }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
      const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
      try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/team/users/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status: nextStatus })
          });
          if (res.ok) {
              success(nextStatus === 'active' ? "User activated." : "User suspended successfully.");
              fetchUsers();
          } else {
              error("Failed to update status.");
          }
      } catch (err) { console.error(err); }
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    const allOnPage = users.map(u => u.id);
    const allSelected = allOnPage.length > 0 && allOnPage.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) { allOnPage.forEach(id => next.delete(id)); }
    else { allOnPage.forEach(id => next.add(id)); }
    setSelectedIds(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to PERMANENTLY delete ${selectedIds.size} team member(s)? This action cannot be undone.`)) return;
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/team/users/bulk-delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        });
        if (res.ok) {
            success(`${selectedIds.size} users removed from system.`);
            setSelectedIds(new Set());
            fetchUsers();
            refreshSub();
        } else {
            error("Bulk delete failed.");
        }
    } catch (err) { console.error(err); error("An error occurred during bulk operation."); }
  };

  const isLimitReached = !isSuperadmin && subscription && subscription.max_users > 0 && users.length >= subscription.max_users;

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-6xl mx-auto">
        
        {/* Header with Usage Indicator */}
        <div className="flex items-center justify-between mb-8">
           <div>
              <h1 className="flex items-center gap-3 text-[22px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                 <span className="w-8 h-8 flex items-center justify-center" style={{ color: "var(--accent)" }}>{Icons.team}</span>
                 Team & Users
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Manage team accessibility and module permissions</p>
           </div>
           
           <div className="flex items-center gap-4">
               {!subLoading && subscription && !isSuperadmin && (
                 <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>User Seat Usage</span>
                    <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden" style={{ border: "1px solid var(--bg-border)" }}>
                            <div className="h-full bg-orange-500" style={{ width: `${(users.length / subscription.max_users) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold">{users.length} <span className="opacity-40">/ {subscription.max_users}</span></span>
                    </div>
                 </div>
               )}
               {selectedIds.size > 0 && (
                   <Btn variant="secondary" icon={BtnIcons.trash} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20" onClick={handleBulkDelete}>
                       Delete {selectedIds.size}
                   </Btn>
               )}
               <Btn variant="primary" icon={BtnIcons.plus} disabled={!!isLimitReached} onClick={openCreateModal}>
                    {isLimitReached ? "Limit Reached" : "Add User"}
               </Btn>
           </div>
        </div>

        {/* Users Table */}
        <div className="table-responsive rounded-2xl shadow-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
           <table className="w-full text-left text-sm whitespace-nowrap">
             <thead style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--bg-border)" }}>
               <tr>
                 <th className="px-6 py-4 w-12 text-center">
                   <input type="checkbox" checked={users.length > 0 && users.every(u => selectedIds.has(u.id))} onChange={toggleSelectAll} className="rounded accent-orange-500" style={{ borderColor: "var(--bg-border)" }} />
                 </th>
                 <th className="px-6 py-4 font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Team Member</th>
                 <th className="px-6 py-4 font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Role</th>
                 <th className="px-6 py-4 font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Module Access</th>
                 {isSuperadmin && <th className="px-6 py-4 font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Target ISP</th>}
                 <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y" style={{ borderColor: "var(--bg-border)" }}>
               {loading ? (
                   <tr><td colSpan={isSuperadmin ? 6 : 5} className="px-6 py-8 text-center text-sm font-medium opacity-50">Loading team members...</td></tr>
               ) : users.length === 0 ? (
                   <tr><td colSpan={isSuperadmin ? 6 : 5} className="px-6 py-8 text-center text-sm font-medium opacity-50">No team members found.</td></tr>
               ) : users.map(u => (
                 <tr key={u.id} className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" style={{ borderBottom: "1px solid var(--bg-border)" }}>
                   <td className="px-6 py-4 text-center">
                     <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} className="rounded accent-orange-500" style={{ borderColor: "var(--bg-border)" }} />
                   </td>
                   <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center font-black text-xs">
                            {(u.full_name || u.email).substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: "var(--text-primary)" }}>{u.full_name || 'No Name'}</div>
                          <div className="text-[10px] opacity-50 font-bold tracking-wider">{u.email}</div>
                        </div>
                      </div>
                   </td>
                   <td className="px-6 py-4">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{u.role}</span>
                   </td>
                   <td className="px-6 py-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {u.permissions?.allowed_modules.map(m => (
                            <span key={m} className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter opacity-70 border" style={{ background: "var(--bg-elevated)", borderColor: "var(--bg-border)" }}>
                                {m}
                            </span>
                        ))}
                      </div>
                   </td>
                   {isSuperadmin && (
                       <td className="px-6 py-4">
                           <span className="text-xs font-bold opacity-60">
                               {tenants.find(t => t.id === u.tenant_id)?.name || 'System / Mixed'}
                           </span>
                       </td>
                   )}
                   <td className="px-6 py-4 text-right">
                      <ActionMenu actions={[
                          { label: "Configure Access", onClick: () => openEditModal(u) },
                          { label: u.status === 'active' ? "Suspend User" : "Activate User", onClick: () => handleToggleStatus(u.id, u.status), variant: u.status === 'active' ? "danger" : "default" },
                          { label: "Delete Permanently", onClick: () => handleDeleteUser(u.id, u.email), variant: "danger" }
                      ]} />
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>

      </div>

      {/* Team Member Modal */}
      <FormModal
        open={showModal}
        title={isEditing ? "Edit Team Member" : "Add New User"}
        subtitle={isEditing ? "Update configuration and access levels." : "Provision a new account for your department."}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        submitLabel={isEditing ? "Save Configuration" : "Create User"}
        width={720}
        loading={saving}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-4">
              {isSuperadmin && !isEditing && (
                  <FormField label="Target ISP Tenant (On behalf of)">
                     <select 
                        required 
                        value={form.tenant_id || ""} 
                        onChange={e => setForm({...form, tenant_id: e.target.value})} 
                        className={inputCls} 
                        style={inputStyle}
                     >
                        <option value="">— Select ISP —</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                     </select>
                  </FormField>
              )}
              <div className="grid grid-cols-2 gap-4">
                  <FormField label="First Name">
                     <input required value={form.first_name || ""} onChange={e => setForm({...form, first_name: e.target.value})} className={inputCls} style={inputStyle} placeholder="e.g. John" />
                  </FormField>
                  <FormField label="Last Name">
                     <input required value={form.last_name || ""} onChange={e => setForm({...form, last_name: e.target.value})} className={inputCls} style={inputStyle} placeholder="e.g. Doe" />
                  </FormField>
              </div>
              <FormField label="Email Account (Login ID)">
                 <input required type="email" value={form.email || ""} onChange={e => setForm({...form, email: e.target.value})} className={inputCls} style={inputStyle} disabled={isEditing} placeholder="user@example.com" />
              </FormField>
              <FormField label="Secret Key (Password)">
                 <input type="password" value={form.password || ""} onChange={e => setForm({...form, password: e.target.value})} className={inputCls} style={inputStyle} placeholder={isEditing ? "Change password" : "Minimum 8 chars"} />
              </FormField>
              <FormField label="System Role">
                 <select value={form.role || "Sales Agent"} onChange={e => setForm({...form, role: e.target.value})} className={inputCls} style={inputStyle}>
                    <option value="isp_admin">ISP Admin (Owner)</option>
                    <option value="Sales Agent">Sales Agent</option>
                    <option value="operator">Network Operator</option>
                 </select>
              </FormField>
           </div>

           <div className="space-y-4 p-4 rounded-2xl border" style={{ background: "var(--bg-elevated)", borderColor: "var(--bg-border)" }}>
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">Module Permissions</h3>
              <div className="space-y-3">
                 {[
                   { id: "dashboard", label: "Dashboard Overview" },
                   { id: "sales", label: "Sales & CRM" },
                   { id: "customers", label: "Customer Inventory" },
                   { id: "devices", label: "Network Devices & IPs" },
                   { id: "sla", label: "SLA Reporting Engine" },
                 ].map(m => (
                    <label key={m.id} className="flex items-center gap-3 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={form.permissions?.allowed_modules.includes(m.id)} 
                            onChange={() => handleModuleToggle(m.id)} 
                            className="w-4 h-4 rounded accent-orange-500" 
                        />
                        <span className="text-sm font-medium transition-colors group-hover:text-orange-500">{m.label}</span>
                    </label>
                 ))}
              </div>
              <div className="pb-2"></div>
           </div>
        </div>
      </FormModal>
    </div>
  );
}
