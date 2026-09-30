import DashboardShell from "@/components/dashboard/DashboardShell";
import { OutletProvider } from "@/context/OutletContext";
import ProtectedDashboard from "@/components/dashboard/ProtectedDashboard";

export default function DashboardLayout({ children }) {
  return (
    <ProtectedDashboard>
      <OutletProvider>
        <DashboardShell>{children}</DashboardShell>
      </OutletProvider>
    </ProtectedDashboard>
  );
}
