"use client";
import { useState, useEffect } from "react";
import OutletSwitcher from "@/components/dashboard/OutletSwitcher";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

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

  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 sticky top-0 z-10">
      <OutletSwitcher />

      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center hover:-translate-y-0.5 transition-transform"
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
        <button
          onClick={async () => { await signOut(); router.replace("/login"); }}
          className="text-xs font-semibold text-muted hover:text-accent transition-colors"
        >
          Sign out
        </button>
        <span className="hidden sm:inline text-xs font-semibold text-muted">{applicationUser?.role}</span>
      </div>
    </header>
  );
}