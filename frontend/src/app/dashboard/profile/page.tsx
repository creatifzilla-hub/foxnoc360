"use client";

import { useState, useEffect } from "react";
import { Icons } from "../components/Sidebar";
import ConfirmDialog from "../components/ConfirmDialog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface ProfileData {
  user_id: string;
  email: string;
  role: string;
  tenant_id: string;
  tenant_name?: string;
  company_email?: string;
  plan_name?: string;
  price_charged: number;
  expires_at?: string;
  
  // New Fields
  full_name?: string;
  phone_number?: string;
  profile_picture?: string;
  alternate_email?: string;
  company_website?: string;
  gst_number?: string;
  // Notifications
  email_alerts: boolean;
  whatsapp_alerts: boolean;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirm_password: "",
    full_name: "",
    phone_number: "",
    profile_picture: "",
    tenant_name: "",
    company_email: "",
    alternate_email: "",
    company_website: "",
    gst_number: "",
    email_alerts: true,
    whatsapp_alerts: true
  });

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/profile/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setFormData({
          email: data.email || "",
          password: "",
          confirm_password: "",
          full_name: data.full_name || "",
          phone_number: data.phone_number || "",
          profile_picture: data.profile_picture || "",
          tenant_name: data.tenant_name || "",
          company_email: data.company_email || "",
          alternate_email: data.alternate_email || "",
          company_website: data.company_website || "",
          gst_number: data.gst_number || "",
          email_alerts: data.email_alerts ?? true,
          whatsapp_alerts: data.whatsapp_alerts ?? true
        });
      }
    } catch (err) {
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password && formData.password !== formData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setConfirmDialog({
      open: true,
      title: "Save Profile Changes",
      message: "Are you sure you want to update your profile information?",
      onConfirm: handleUpdateProfile
    });
  };

  const handleUpdateProfile = async () => {
    setConfirmDialog(null);
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const token = localStorage.getItem("token");
      const updatePayload: any = { ...formData };
      
      // Remove confirm_password and handle empty password
      if (!updatePayload.password) delete updatePayload.password;
      delete updatePayload.confirm_password;

      // Clean up empty strings for optional fields to avoid validation errors (e.g. EmailStr)
      const optionalFields = ['full_name', 'phone_number', 'profile_picture', 'alternate_email', 'company_website', 'gst_number'];
      optionalFields.forEach(field => {
        if (updatePayload[field] === "") {
          updatePayload[field] = null;
        }
      });

      const res = await fetch(`${API_BASE}/profile/`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(updatePayload)
      });

      if (res.ok) {
        setMessage("Profile updated successfully!");
        fetchProfile();
      } else {
        const errData = await res.json().catch(() => ({}));
        let errorMessage = "Failed to update profile.";
        
        if (typeof errData.detail === "string") {
          errorMessage = errData.detail;
        } else if (Array.isArray(errData.detail)) {
          // Handle Pydantic validation errors (list of objects)
          errorMessage = errData.detail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(", ");
        } else if (typeof errData.detail === "object" && errData.detail !== null) {
          errorMessage = JSON.stringify(errData.detail);
        }
        
        setError(errorMessage);
      }
    } catch (err) {
      setError("A network error occurred.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="flex items-center gap-3 text-[28px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              <span className="w-10 h-10 flex items-center justify-center rounded-2xl bg-accent/10" style={{ color: "var(--accent)" }}>{Icons.user}</span>
              Profile Settings
            </h1>
            <p className="text-sm font-medium opacity-60" style={{ color: "var(--text-secondary)" }}>
              Manage your identity, company tax details, and security preferences.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-surface p-2 rounded-2xl border shadow-sm" style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}>
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center overflow-hidden border border-accent/10">
                {formData.profile_picture ? (
                    <img src={formData.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    <span className="text-xl font-black text-accent">{formData.full_name?.charAt(0) || formData.email.charAt(0).toUpperCase()}</span>
                )}
            </div>
            <div className="pr-4">
                <p className="text-sm font-bold leading-none mb-1">{formData.full_name || "New User"}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{profile?.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {message && (
          <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-bold animate-in fade-in slide-in-from-top-4 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs">✓</span>
            {message}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold animate-in fade-in slide-in-from-top-4 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs">⚠</span>
            {error}
          </div>
        )}

        <div className="rounded-2xl shadow-xl border overflow-hidden" style={{ background: "var(--bg-surface)", borderColor: "var(--bg-border)" }}>
          <form onSubmit={handleSaveClick}>
            {/* Unified Form Container */}
            <div className="p-8 space-y-12">
              
              {/* Section 1: Personal & Identity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                    <span className="text-accent">01.</span> Personal Identity
                  </h2>
                  <p className="text-xs mt-1 opacity-50" style={{ color: "var(--text-secondary)" }}>Basic account holder information and profile visualization.</p>
                </div>
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Display Name</label>
                    <input 
                      type="text"
                      placeholder="e.g. Amrit Singh"
                      value={formData.full_name}
                      onChange={e => setFormData({...formData, full_name: e.target.value})}
                      className="w-full rounded-xl px-4 py-3 outline-none transition-all font-medium border-2 focus:border-accent"
                      style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Contact Number</label>
                    <input 
                      type="text"
                      placeholder="+91 XXXXX XXXXX"
                      value={formData.phone_number}
                      onChange={e => setFormData({...formData, phone_number: e.target.value})}
                      className="w-full rounded-xl px-4 py-3 outline-none transition-all font-medium border-2 focus:border-accent"
                      style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Avatar URL</label>
                    <input 
                      type="text"
                      placeholder="https://images.unsplash.com/..."
                      value={formData.profile_picture}
                      onChange={e => setFormData({...formData, profile_picture: e.target.value})}
                      className="w-full rounded-xl px-4 py-3 outline-none transition-all font-medium border-2 focus:border-accent"
                      style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-12" style={{ borderColor: "var(--bg-border)" }}>
                {/* Section 2: Security & Access */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                      <span className="text-accent">02.</span> Credentials & Security
                    </h2>
                    <p className="text-xs mt-1 opacity-50" style={{ color: "var(--text-secondary)" }}>Manage your primary login email and platform password.</p>
                  </div>
                  <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Login Email</label>
                      <input 
                        type="email"
                        required
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full rounded-xl px-4 py-3 outline-none transition-all font-medium border-2 focus:border-accent"
                        style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">New Password</label>
                      <input 
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full rounded-xl px-4 py-3 outline-none transition-all font-medium border-2 focus:border-accent"
                        style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Confirm New Password</label>
                      <input 
                        type="password"
                        placeholder="••••••••"
                        value={formData.confirm_password}
                        onChange={e => setFormData({...formData, confirm_password: e.target.value})}
                        className="w-full rounded-xl px-4 py-3 outline-none transition-all font-medium border-2 focus:border-accent"
                        style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {profile?.role !== "super_admin" && (
                <>
                  <div className="border-t pt-12" style={{ borderColor: "var(--bg-border)" }}>
                    {/* Section 3: Commercial & Tax */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div>
                        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                          <span className="text-accent">03.</span> Commercial & GST
                        </h2>
                        <p className="text-xs mt-1 opacity-50" style={{ color: "var(--text-secondary)" }}>Legal entity information for tax-compliant invoicing.</p>
                      </div>
                      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Company Legal Name</label>
                          <input 
                            type="text"
                            required
                            placeholder="e.g. CreatifZilla Pvt Ltd"
                            value={formData.tenant_name}
                            onChange={e => setFormData({...formData, tenant_name: e.target.value})}
                            className="w-full rounded-xl px-4 py-3 outline-none transition-all font-medium border-2 focus:border-accent"
                            style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Support Email</label>
                          <input 
                            type="email"
                            required
                            value={formData.company_email}
                            onChange={e => setFormData({...formData, company_email: e.target.value})}
                            className="w-full rounded-xl px-4 py-3 outline-none transition-all font-medium border-2 focus:border-accent"
                            style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Billing Email</label>
                          <input 
                            type="email"
                            value={formData.alternate_email}
                            onChange={e => setFormData({...formData, alternate_email: e.target.value})}
                            className="w-full rounded-xl px-4 py-3 outline-none transition-all font-medium border-2 focus:border-accent"
                            style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Company Website</label>
                          <input 
                            type="url"
                            placeholder="https://www.yourdomain.com"
                            value={formData.company_website}
                            onChange={e => setFormData({...formData, company_website: e.target.value})}
                            className="w-full rounded-xl px-4 py-3 outline-none transition-all font-medium border-2 focus:border-accent"
                            style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                          />
                        </div>
                        <div className="md:col-span-2 bg-accent/5 p-6 rounded-2xl border-2 border-dashed border-accent/20">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-accent mb-2">GST Identification Number (GSTIN)</label>
                          <input 
                            type="text"
                            placeholder="e.g. 07AAAAA0000A1Z5"
                            value={formData.gst_number}
                            onChange={e => setFormData({...formData, gst_number: e.target.value})}
                            className="w-full rounded-xl px-5 py-3 outline-none transition-all font-black border-2 focus:border-accent uppercase tracking-widest"
                            style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                          />
                          <p className="text-[10px] font-medium mt-3 opacity-60 leading-relaxed italic">
                            Providing a valid GSTIN enables tax-compliant digital invoices for your business operations.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-12" style={{ borderColor: "var(--bg-border)" }}>
                    {/* Section 4: Alert Preferences */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div>
                        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                          <span className="text-accent">04.</span> Alert Preferences
                        </h2>
                        <p className="text-xs mt-1 opacity-50" style={{ color: "var(--text-secondary)" }}>Choose how you want to be notified when devices go down.</p>
                      </div>
                      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div 
                          onClick={() => setFormData({...formData, email_alerts: !formData.email_alerts})}
                          className={`p-6 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${formData.email_alerts ? 'border-accent bg-accent/5' : 'bg-base/20 border-transparent opacity-60 hover:opacity-100'}`}
                          style={{ background: formData.email_alerts ? "" : "var(--bg-base)" }}
                        >
                          <div className="flex items-center gap-4">
                             <span className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">{Icons.mail}</span>
                             <div>
                                <p className="text-sm font-bold">Email Alerts</p>
                                <p className="text-[10px] opacity-60 font-medium">Auto-dispatch to {formData.email}</p>
                             </div>
                          </div>
                          <div className={`w-12 h-6 rounded-full transition-all relative p-1 ${formData.email_alerts ? 'bg-accent' : 'bg-gray-400/20'}`}>
                             <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${formData.email_alerts ? 'translate-x-6' : 'translate-x-0'}`}></div>
                          </div>
                        </div>

                        <div 
                          onClick={() => setFormData({...formData, whatsapp_alerts: !formData.whatsapp_alerts})}
                          className={`p-6 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${formData.whatsapp_alerts ? 'border-accent bg-accent/5' : 'bg-base/20 border-transparent opacity-60 hover:opacity-100'}`}
                          style={{ background: formData.whatsapp_alerts ? "" : "var(--bg-base)" }}
                        >
                          <div className="flex items-center gap-4">
                             <span className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">{Icons.alert}</span>
                             <div>
                                <p className="text-sm font-bold">WhatsApp Messenger</p>
                                <p className="text-[10px] opacity-60 font-medium">Direct ping to {formData.phone_number || "configured phone"}</p>
                             </div>
                          </div>
                          <div className={`w-12 h-6 rounded-full transition-all relative p-1 ${formData.whatsapp_alerts ? 'bg-accent' : 'bg-gray-400/20'}`}>
                             <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${formData.whatsapp_alerts ? 'translate-x-6' : 'translate-x-0'}`}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Combined Final Actions */}
            <div className="px-8 py-6 bg-base/30 border-t flex flex-col md:flex-row items-center justify-between gap-4" style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)" }}>
              <button 
                type="button"
                onClick={() => window.history.back()}
                className="text-sm font-bold opacity-40 hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-primary)" }}
              >
                ← Back to Dashboard
              </button>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  type="button"
                  onClick={() => window.history.back()}
                  className="flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all border-2 hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: "var(--text-secondary)", borderColor: "var(--bg-border)" }}
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 md:flex-none px-10 py-2.5 rounded-xl text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "var(--accent)" }}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {confirmDialog && (
          <ConfirmDialog 
            open={confirmDialog.open}
            title={confirmDialog.title}
            message={confirmDialog.message}
            confirmLabel="Confirm Synchronization"
            variant="info"
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}
      </div>
      
      <style jsx>{`
          input::placeholder {
              opacity: 0.2;
              font-weight: 400;
          }
      `}</style>
    </div>
  );
}
