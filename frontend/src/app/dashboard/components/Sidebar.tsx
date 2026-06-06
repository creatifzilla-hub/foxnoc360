"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "../../components/ThemeProvider";
import { useRole } from "../../hooks/useRole";
import { useSubscription } from "../../hooks/useSubscription";

// ── Outline SVG icons ───────────────────────────────────────────────────────
export const Icons = {
  overview: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  ),
  mail: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  ),
  building: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  device: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 5.25Z" />
    </svg>
  ),
  report: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  creditcard: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
    </svg>
  ),
  billing: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  sales: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  team: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a5.946 5.946 0 00-.942 3.197M12 10.5a3.375 3.375 0 100-6.75 3.375 3.375 0 000 6.75zM9 15.534a4.873 4.873 0 00-6.216 1.83 4.874 4.874 0 001.83 6.216 4.874 4.874 0 006.216-1.83 4.874 4.874 0 00-1.83-6.216z" />
    </svg>
  ),
  chevronRight: (
     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-full h-full">
       <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
     </svg>
  ),
  logout: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </svg>
  ),
  sun: ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg> ),
  moon: ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg> ),
  user: ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg> ),
  globe: ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
  </svg> ),
};

const allNavItems = [
  { href: "/dashboard", label: "Overview", icon: Icons.overview, module: "dashboard" },
  { href: "/dashboard/tenants", label: "Tenants (ISPs)", icon: Icons.building, superadminOnly: true },
  
  // Sales Module (Grouped)
  { 
    label: "Sales", 
    icon: Icons.sales, 
    module: "sales",
    subItems: [
        { href: "/dashboard/sales", label: "Sales Dashboard" },
        { href: "/dashboard/sales/leads", label: "Leads Pipeline" },
    ]
  },

  { href: "/dashboard/customers", label: "Customers", icon: Icons.users, module: "customers" },
  { href: "/dashboard/devices", label: "Devices & IPs", icon: Icons.device, module: "devices" },
  { href: "/dashboard/team", label: "Team Management", icon: Icons.team, ispAdminOnly: true },
  
  { divider: true },
  { href: "/dashboard/sla-reports", label: "SLA Reports", icon: Icons.report, module: "sla" },
  { href: "/dashboard/subscriptions", label: "Subscription", icon: Icons.creditcard, ispAdminOnly: true },
  { href: "/dashboard/billing", label: "Billing & Invoices", icon: Icons.billing, ispAdminOnly: true },
  { href: "/dashboard/profile", label: "Profile", icon: Icons.user },
  { divider: true },
  { href: "/portal", label: "Customer Portal", icon: Icons.globe, external: true, superadminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { isSuperadmin, isISPAdmin, allowedModules, loading } = useRole();
  const { subscription, loading: subLoading } = useSubscription();
  const [salesExpanded, setSalesExpanded] = useState(pathname.startsWith("/dashboard/sales"));

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.push("/login");
  }, [router]);

  useEffect(() => {
      if (pathname.startsWith("/dashboard/sales")) setSalesExpanded(true);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const navItems = allNavItems.filter((item) => {
    if (isSuperadmin) return true; // Superadmin sees everything

    if ("superadminOnly" in item && item.superadminOnly) return false;
    
    if ("ispAdminOnly" in item && item.ispAdminOnly) {
        return isISPAdmin;
    }

    // Module-level permission check for everyone else
    if ("module" in item && item.module) {
        return allowedModules.includes(item.module);
    }

    return true;
  });

  return (
    <aside
      className="w-60 h-screen sticky top-0 flex flex-col py-6 px-3"
      style={{
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--bg-border)",
      }}
    >
      <Link href="/dashboard" className="px-3 mb-8 block transition-transform hover:scale-[1.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center">
            <img src="/logo.png" alt="FoxNOC360" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: "var(--text-primary)" }}>FoxNOC360</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {loading ? "…" : isSuperadmin ? "Superadmin" : "ISP Platform"}
            </p>
          </div>
        </div>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
        {navItems.map((item, i) => {
          if ("divider" in item) {
            return <div key={i} className="my-3" style={{ borderTop: "1px solid var(--bg-border)" }} />;
          }

          if ("subItems" in item && item.subItems) {
              const isSalesActive = pathname.startsWith("/dashboard/sales");
              return (
                  <div key="sales-group" className="space-y-1">
                      <button
                        onClick={() => setSalesExpanded(!salesExpanded)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group hover:bg-black/5 dark:hover:bg-white/5"
                        style={{
                            background: isSalesActive && !salesExpanded ? "rgba(255,95,0,0.1)" : "transparent",
                            color: isSalesActive ? "var(--accent)" : "var(--text-secondary)",
                        }}
                      >
                        <div className="w-5 h-5">{item.icon}</div>
                        <span>{item.label}</span>
                        <div className={`w-4 h-4 ml-auto transition-transform duration-200 ${salesExpanded ? 'rotate-90' : ''}`}>
                            {Icons.chevronRight}
                        </div>
                      </button>
                      {salesExpanded && (
                          <div className="pl-11 space-y-1 animate-in slide-in-from-top-2 duration-200">
                              {item.subItems.map(sub => (
                                  <Link
                                    key={sub.href}
                                    href={sub.href}
                                    className="block px-3 py-2 rounded-lg text-xs font-medium transition-all"
                                    style={{
                                        background: pathname === sub.href ? "rgba(255,95,0,0.08)" : "transparent",
                                        color: pathname === sub.href ? "var(--accent)" : "var(--text-muted)",
                                    }}
                                  >
                                    {sub.label}
                                  </Link>
                              ))}
                          </div>
                      )}
                  </div>
              );
          }

          const isActive = item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              target={"external" in item && item.external ? "_blank" : undefined}
              style={{
                background: isActive ? "rgba(255,95,0,0.12)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                border: isActive ? "1px solid rgba(255,95,0,0.2)" : "1px solid transparent",
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group hover:bg-black/5 dark:hover:bg-white/5"
            >
              <div className="w-5 h-5">{item.icon}</div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Role Badge */}
      {!loading && (
        <div className="mx-3 mb-3 px-3 py-2 rounded-xl text-[10px] text-center font-black uppercase tracking-widest"
          style={{
            background: isSuperadmin ? "rgba(255,95,0,0.12)" : "rgba(255,95,0,0.08)",
            color: isSuperadmin ? "#FF5F00" : "var(--text-muted)",
            border: `1px solid ${isSuperadmin ? "rgba(255,95,0,0.2)" : "var(--bg-border)"}`,
          }}
        >
          {isSuperadmin ? "Security: Superadmin" : `Role: ${isISPAdmin ? 'ISP Admin' : 'Agent'}`}
        </div>
      )}

      <div className="px-3 pt-4 space-y-2" style={{ borderTop: "1px solid var(--bg-border)" }}>
        <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ color: "var(--text-secondary)" }}>
          <div className="w-4 h-4">{theme === "dark" ? Icons.sun : Icons.moon}</div>
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-red-500/10" style={{ color: "var(--text-muted)" }}>
          <div className="w-5 h-5">{Icons.logout}</div>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
