"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { applicationUser } = useAuth();
  const role = (applicationUser?.role || "owner").toLowerCase();

  let groups = [];

  if (role === "waiter") {
    groups = [
      {
        label: "Floor Operations",
        links: [
          { name: "Waiter Orders", href: "/waiter-orders", icon: "🛎️" },
        ],
      },
    ];
  } else if (role === "chef") {
    groups = [
      {
        label: "Kitchen Operations",
        links: [
          { name: "Live Orders", href: "/orders", icon: "🧾" },
          { name: "Menu & Recipes", href: "/menu", icon: "🍽️" },
        ],
      },
    ];
  } else {
    // Owner / Full access
    groups = [
      {
        label: "Operations",
        links: [
          { name: "Dashboard", href: "/dashboard", icon: "▦" },
          { name: "Orders", href: "/orders", icon: "🧾" },
          { name: "Waiter Orders", href: "/waiter-orders", icon: "🛎️" },
          { name: "Menu", href: "/menu", icon: "🍽️" },
        ],
      },
      {
        label: "Management",
        links: [
          { name: "Inventory", href: "/inventory", icon: "📦" },
          { name: "Analytics", href: "/analytics", icon: "📊" },
        ],
      },
      {
        label: "AI",
        links: [{ name: "RasoiSaathi AI Copilot", href: "/copilot", icon: "✨" }],
      },
      {
        label: "Settings",
        links: [
          { name: "My Restaurant / Outlets", href: "/settings/outlets", icon: "🏬" },
          { name: "Staff & Roles", href: "/settings/staff", icon: "👥" },
          { name: "Subscription", href: "/settings/subscription", icon: "💳" },
        ],
      },
    ];
  }

  const defaultHome = role === "waiter" ? "/waiter-orders" : role === "chef" ? "/orders" : "/dashboard";

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface h-screen sticky top-0 flex flex-col overflow-y-auto">
      <div className="px-5 py-4 border-b border-border">
        <Link href={defaultHome} className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="RasoiSaathi"
            width={32}
            height={32}
            className="w-8 h-8 object-contain shrink-0"
            priority
          />
          <span className="font-display font-extrabold text-lg text-ink tracking-tight whitespace-nowrap">
            Rasoi<span className="text-accent">Saathi</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.links.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors " +
                      (active
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:bg-surface-2 hover:text-ink")
                    }
                  >
                    <span>{link.icon}</span>
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}