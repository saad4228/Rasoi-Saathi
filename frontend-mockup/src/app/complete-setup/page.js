"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition";

export default function CompleteSetupPage() {
  const { session, applicationUser, loading, refreshUser, signOut } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    owner_name: "",
    restaurant_name: "",
    restaurant_email: "",
    restaurant_phone: "",
    branch_address: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (applicationUser) router.replace("/dashboard");
  }, [loading, session, applicationUser, router]);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/auth/onboarding", {
        method: "POST",
        body: JSON.stringify({
          restaurant_name: form.restaurant_name,
          owner_name: form.owner_name || null,
          restaurant_email: form.restaurant_email || session.user?.email || null,
          restaurant_phone: form.restaurant_phone || null,
          branch_address: form.branch_address || null,
        }),
      });
      await refreshUser();
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError.message || "Unable to finish setting up your workspace.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session || applicationUser) {
    return <div className="min-h-screen grid place-items-center bg-bg text-muted">Loading...</div>;
  }

  return (
    <main className="min-h-screen grid place-items-center bg-surface p-6">
      <div className="w-full max-w-md">
        <p className="font-mono text-xs tracking-widest text-accent">ALMOST THERE</p>
        <h1 className="font-display text-3xl font-extrabold text-ink mt-3 tracking-tight">Finish setting up your workspace</h1>
        <p className="text-sm text-muted mt-2">
          You&apos;re signed in as <strong className="text-ink">{session.user?.email}</strong>. Tell us about your restaurant to
          activate your workspace.
        </p>

        {error && (
          <div role="alert" className="mt-5 rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs font-semibold text-rose-600">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">Owner full name</span>
            <input className={inputClass} required value={form.owner_name} onChange={update("owner_name")} />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">Restaurant / brand name</span>
            <input className={inputClass} required value={form.restaurant_name} onChange={update("restaurant_name")} />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">First outlet address (optional)</span>
            <input className={inputClass} placeholder="e.g. 12 Central Market, Nagpur" value={form.branch_address} onChange={update("branch_address")} />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">Restaurant email</span>
              <input className={inputClass} type="email" value={form.restaurant_email} onChange={update("restaurant_email")} />
            </label>
            <label className="block">
              <span className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">Phone</span>
              <input className={inputClass} value={form.restaurant_phone} onChange={update("restaurant_phone")} />
            </label>
          </div>

          <button
            disabled={busy}
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3 text-white font-bold shadow-lg disabled:opacity-60 mt-2"
          >
            {busy ? "Setting up..." : "Activate workspace"}
          </button>
        </form>

        <button
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
          className="mt-6 w-full text-center text-sm font-semibold text-muted hover:text-ink"
        >
          Use a different account
        </button>
      </div>
    </main>
  );
}
