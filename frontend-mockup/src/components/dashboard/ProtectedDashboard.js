"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const ROLE_PERMISSIONS = {
  waiter: ["/waiter-orders"],
  chef: ["/orders", "/menu"],
  owner: [
    "/dashboard",
    "/orders",
    "/waiter-orders",
    "/menu",
    "/inventory",
    "/analytics",
    "/copilot",
    "/settings/outlets",
    "/settings/staff",
    "/settings/subscription",
  ],
};

export default function ProtectedDashboard({ children }) {
  const { session, applicationUser, loading, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const role = (applicationUser?.role || "owner").toLowerCase();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
      return;
    }

    if (!loading && session && applicationUser) {
      const allowedRoutes = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.owner;
      const isAllowed = allowedRoutes.some((route) => pathname.startsWith(route));

      if (!isAllowed) {
        if (role === "waiter") {
          router.replace("/waiter-orders");
        } else if (role === "chef") {
          router.replace("/orders");
        } else {
          router.replace("/dashboard");
        }
      }
    }
  }, [loading, session, applicationUser, role, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-bg text-muted">
        Loading your workspace...
      </div>
    );
  }

  if (!session) return null;

  if ((error || !applicationUser) && pathname !== "/complete-setup") {
  return (
    <div className="min-h-screen grid place-items-center bg-bg p-6 text-center">
      <div>
        <p className="text-accent font-mono text-xs tracking-widest uppercase">Profile Access</p>
        <h1 className="font-display text-2xl font-extrabold text-ink mt-3">
          Workspace profile unavailable
        </h1>
        <p className="text-muted mt-3">
          Your Supabase account is authenticated, but no active Rasoi Sathi profile was found.
        </p>
      </div>
    </div>
  );
}

if ((error || !applicationUser) && pathname === "/complete-setup") {
  return children;
}

  return children;
}