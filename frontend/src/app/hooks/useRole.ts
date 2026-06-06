"use client";

import { useEffect, useState } from "react";

export type UserRole = "superadmin" | "isp_admin" | "sales_agent" | "operator" | null;

interface RoleState {
  role: UserRole;
  isSuperadmin: boolean;
  isISPAdmin: boolean;
  isSalesAgent: boolean;
  allowedModules: string[];
  loading: boolean;
}

export function useRole(): RoleState {
  const [role, setRole] = useState<UserRole>(null);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setRole(payload?.role || "operator");
        setAllowedModules(payload?.allowed_modules || ["dashboard"]);
      }
    } catch {
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isSuper = role === "superadmin" || (role as string) === "super_admin";
    if (isSuper) {
      document.documentElement.classList.add("is-superadmin");
    } else {
      document.documentElement.classList.remove("is-superadmin");
    }
  }, [role]);

  return {
    role,
    isSuperadmin: (role as string) === "superadmin" || (role as string) === "super_admin",
    isISPAdmin: role === "isp_admin",
    isSalesAgent: (role as string) === "sales_agent" || (role as string) === "Sales Agent",
    allowedModules,
    loading,
  };
}
