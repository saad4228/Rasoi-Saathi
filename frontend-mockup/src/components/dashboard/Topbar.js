"use client";
import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/dashboard/NotificationBell";
import OutletSwitcher from "@/components/dashboard/OutletSwitcher";
import { useAuth } from "@/context/AuthContext";
import { ThemeIcon, useTheme } from "@/lib/theme";

const roleBadges = {
  owner: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  chef: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  waiter: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

export default function Topbar({ onOpenNav }) {
  const { signOut, applicationUser } = useAuth();
  const router = useRouter();
  const [theme, toggleTheme] = useTheme();

  const role = (applicationUser?.role || "").toLowerCase();
  const badgeStyle = roleBadges[role] || "bg-surface-2 text-muted border-border";

  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between gap-2 px-3 md:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-1 min-w-0">
        <button
          onClick={onOpenNav}
          className="md:hidden w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-ink hover:bg-surface-2"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <OutletSwitcher />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-ink hover:-translate-y-0.5 transition-transform"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          <ThemeIcon theme={theme} />
        </button>

        <NotificationBell />

        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeStyle}`}>{role}</span>
          <span className="hidden md:inline text-xs font-semibold text-ink">{applicationUser?.name || "User"}</span>
        </div>

        <button
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
          className="text-xs font-semibold text-muted hover:text-accent transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
