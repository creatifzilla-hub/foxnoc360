import Sidebar from "./components/Sidebar";
import SubscriptionBanner from "./components/SubscriptionBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen">
        <SubscriptionBanner />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
