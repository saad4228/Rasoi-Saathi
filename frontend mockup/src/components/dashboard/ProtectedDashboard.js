"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedDashboard({ children }) {
  const { session, applicationUser, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-bg text-muted">Loading your workspace...</div>;
  if (!session) return null;
  if (error || !applicationUser) return <div className="min-h-screen grid place-items-center bg-bg p-6 text-center"><div><p className="text-accent font-mono text-xs tracking-widest">PROFILE ACCESS</p><h1 className="font-display text-2xl font-extrabold text-ink mt-3">Workspace profile unavailable</h1><p className="text-muted mt-3">Your Supabase account is authenticated, but no active Rasoi Sathi profile was found.</p></div></div>;
  return children;
}