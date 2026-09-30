"use client";

import Link from "next/link";
import { Store } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOutlets } from "@/context/OutletContext";

/** Shown by branch-scoped pages until an outlet exists (or while outlets load). */
export default function NoOutletNotice() {
  const { applicationUser } = useAuth();
  const { outletsLoaded, outletsError } = useOutlets();

  if (!outletsLoaded) {
    return <div className="py-16 text-center text-sm text-muted">Loading outlets...</div>;
  }
  if (outletsError) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
        {outletsError.message}
      </p>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-surface p-10 text-center">
      <Store size={28} className="mx-auto text-accent" />
      <h2 className="mt-3 font-bold text-ink">No outlet set up yet</h2>
      {applicationUser?.role === "owner" ? (
        <p className="mt-1 text-sm text-muted">
          Menus, stock and orders belong to an outlet.{" "}
          <Link href="/settings/outlets" className="font-semibold text-accent hover:underline">
            Add your first outlet
          </Link>
          .
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Ask the restaurant owner to add an outlet.</p>
      )}
    </div>
  );
}
