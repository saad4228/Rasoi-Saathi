"use client";

import { useEffect, useState } from "react";
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

const HOME_FOR_ROLE = { waiter: "/waiter-orders", chef: "/orders", owner: "/dashboard" };

function isAllowed(role, pathname) {
  const routes = ROLE_PERMISSIONS[role] || [];
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function FullScreenMessage({ eyebrow, title, children }) {
  return (
    <div className="min-h-screen grid place-items-center bg-bg p-6 text-center">
      <div className="max-w-md">
        <p className="text-accent font-mono text-xs tracking-widest uppercase">{eyebrow}</p>
        <h1 className="font-display text-2xl font-extrabold text-ink mt-3">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export default function ProtectedDashboard({ children }) {
  const { session, applicationUser, loading, error, refreshUser, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [retrying, setRetrying] = useState(false);

  const role = applicationUser?.role?.toLowerCase();
  const profileMissing = error?.code === "profile_missing";

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
    } else if (profileMissing) {
      router.replace("/complete-setup");
    } else if (applicationUser && !isAllowed(role, pathname)) {
      router.replace(HOME_FOR_ROLE[role] || "/login");
    }
  }, [loading, session, profileMissing, applicationUser, role, pathname, router]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      await refreshUser();
    } catch {
      /* the error is shown below */
    } finally {
      setRetrying(false);
    }
  }

  if (loading || (session && profileMissing)) {
    return <FullScreenMessage eyebrow="Rasoi Saathi" title="Loading your workspace..." />;
  }

  if (!session) return null;

  if (error?.code === "account_inactive") {
    return (
      <FullScreenMessage eyebrow="Account paused" title="Your staff account is inactive">
        <p className="text-muted mt-3">{error.message}</p>
        <button onClick={handleSignOut} className="mt-6 rounded-lg border border-border px-4 py-2 text-sm font-bold text-ink">
          Sign out
        </button>
      </FullScreenMessage>
    );
  }

  if (error || !applicationUser) {
    return (
      <FullScreenMessage eyebrow="Connection problem" title="We couldn't load your workspace">
        <p className="text-muted mt-3">{error?.message || "Your profile could not be loaded."}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {retrying ? "Retrying..." : "Try again"}
          </button>
          <button onClick={handleSignOut} className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-ink">
            Sign out
          </button>
        </div>
      </FullScreenMessage>
    );
  }

  // Don't flash a page this role can't use while the redirect happens.
  if (!isAllowed(role, pathname)) return null;

  return children;
}
