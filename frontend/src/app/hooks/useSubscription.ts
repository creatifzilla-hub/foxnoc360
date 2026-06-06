import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface SubscriptionUsage {
  plan_name: string;
  status: string;
  started_at: string;
  expires_at: string;
  max_devices: number;
  devices_used: number;
  max_customers: number;
  customers_used: number;
  max_users: number;
  users_used: number;
  snmp_enabled: boolean;
  sla_reports: boolean;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/subscriptions/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      } else {
        setError("Failed to fetch subscription data");
      }
    } catch (err) {
      setError("Network error fetching subscription");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  return { subscription, loading, error, refresh: fetchSubscription };
}
