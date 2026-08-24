"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";

export default function CompleteSetupPage() {
  const { session, refreshUser } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    restaurant_name: "",
    restaurant_email: "",
    restaurant_phone: "",
    owner_name: "",
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    if (!session) {
      setError("Your session expired. Please sign in again.");
      setBusy(false);
      router.replace("/login");
      return;
    }

    try {
      await apiRequest(
        "/api/auth/onboarding",
        {
          method: "POST",
          body: JSON.stringify({
            restaurant_name: form.restaurant_name,
            restaurant_email: form.restaurant_email || session.user?.email || "",
            restaurant_phone: form.restaurant_phone || null,
            owner_name: form.owner_name,
          }),
        },
        session
      );
      await refreshUser();
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError.message || "Unable to finish setting up your workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-surface p-6">
      <div className="w-full max-w-md">
        <p className="font-mono text-xs tracking-widest text-accent">ALMOST THERE</p>
        <h1 className="font-display text-3xl font-extrabold text-ink mt-3 tracking-tight">
          Finish setting up your workspace
        </h1>
        <p className="text-sm text-muted mt-2">
          Your account is verified, but we don&apos;t have your restaurant details yet.
          Enter them below to activate your workspace.
        </p>

        {error && (
          <div className="mt-5 rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs font-semibold text-rose-600">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              Owner Full Name
            </label>
            <input
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              required
              value={form.owner_name}
              onChange={update("owner_name")}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              Restaurant / Brand Name
            </label>
            <input
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              required
              value={form.restaurant_name}
              onChange={update("restaurant_name")}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              Restaurant Email (optional)
            </label>
            <input
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              type="email"
              value={form.restaurant_email}
              onChange={update("restaurant_email")}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              Phone Number (optional)
            </label>
            <input
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              value={form.restaurant_phone}
              onChange={update("restaurant_phone")}
            />
          </div>

          <button
            disabled={busy}
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3 text-white font-bold shadow-lg disabled:opacity-60 mt-2"
          >
            {busy ? "Setting up..." : "Activate Workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}