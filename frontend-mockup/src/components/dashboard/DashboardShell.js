"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import { useAuth } from "@/context/AuthContext";

/** Sidebar + top bar. On phones the sidebar becomes a drawer opened from the top bar. */
export default function DashboardShell({ children }) {
  const [navOpen, setNavOpen] = useState(false);
  const { applicationUser, signOut } = useAuth();
  const router = useRouter();

  async function startOwnWorkspace() {
    await signOut();
    router.push("/signup");
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
      <div className="flex-1 min-w-0">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        {applicationUser?.is_demo && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/40 bg-amber-50 px-4 md:px-6 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <span>
              You&apos;re exploring the <strong>demo restaurant</strong> as {applicationUser.role}. Click around freely — staff and outlet settings are
              locked, and the demo resets itself every few hours.
            </span>
            <button onClick={startOwnWorkspace} className="font-bold underline underline-offset-2 hover:no-underline">
              Create your own workspace →
            </button>
          </div>
        )}
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
