"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { describeAuthError, supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  // The recovery link signs the user in (Supabase reads the token from the URL);
  // this page only has to set the new password.
  const { session, loading } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(describeAuthError(updateError).message);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="min-h-screen grid place-items-center bg-bg p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-xl">
        <Link href="/" className="font-display font-extrabold text-lg text-ink">
          Rasoi<span className="text-accent">Saathi</span>
        </Link>
        <p className="font-mono text-xs tracking-widest text-accent mt-14">ACCOUNT RECOVERY</p>
        <h1 className="font-display text-3xl font-extrabold text-ink mt-4">Choose a new password</h1>

        {loading ? (
          <p className="text-muted mt-6">Checking your reset link...</p>
        ) : !session ? (
          <div className="mt-6 space-y-4">
            <p className="text-muted">This reset link is invalid or has expired.</p>
            <Link href="/forgot-password" className="inline-block font-bold text-accent">
              Send a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 mt-8">
            <p className="text-sm text-muted">
              Resetting the password for <strong className="text-ink">{session.user?.email}</strong>.
            </p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <input
              className="rounded-lg border border-border bg-surface-2 px-4 py-3"
              type="password"
              autoComplete="new-password"
              required
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              className="rounded-lg border border-border bg-surface-2 px-4 py-3"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Repeat new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <button disabled={busy} className="rounded-lg bg-gradient-to-r from-accent to-accent-2 py-3 text-white font-bold disabled:opacity-60">
              {busy ? "Saving..." : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
