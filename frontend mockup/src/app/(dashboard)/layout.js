import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import { OutletProvider } from "@/context/OutletContext";
import ProtectedDashboard from "@/components/dashboard/ProtectedDashboard";

export default function DashboardLayout({ children }) {
  return (
    <ProtectedDashboard>
      <OutletProvider>
        <div className="flex">
          <Sidebar />
          <div className="flex-1 min-w-0">
            <Topbar />
            <main className="p-6">{children}</main>
          </div>
        </div>
      </OutletProvider>
    </ProtectedDashboard>
  );
}