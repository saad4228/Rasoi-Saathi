"use client";
import { useState, useEffect } from "react";
import OutletSwitcher from "@/components/dashboard/OutletSwitcher";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const roleBadges = {
  owner: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  chef: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  waiter: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

export default function Topbar() {
  const { signOut, applicationUser } = useAuth();
  const router = useRouter();
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem("rasoisaathi-theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("rasoisaathi-theme", next);
  }

  const role = (applicationUser?.role || "owner").toLowerCase();
  const badgeStyle = roleBadges[role] || "bg-surface-2 text-muted border-border";

  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 sticky top-0 z-10">
      <OutletSwitcher />

      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center hover:-translate-y-0.5 transition-transform"
          title="Toggle theme"
        >
          {theme === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>

        <NotificationBell />

        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeStyle}`}>
            {role}
          </span>
          <span className="hidden md:inline text-xs font-semibold text-ink">
            {applicationUser?.name || "User"}
          </span>
        </div>

        <button
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
          className="text-xs font-semibold text-muted hover:text-accent transition-colors ml-1"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}