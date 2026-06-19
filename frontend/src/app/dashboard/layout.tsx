import Sidebar from "./components/Sidebar";
import SubscriptionBanner from "./components/SubscriptionBanner";
import AuthGuard from "../components/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen">
          <SubscriptionBanner />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
