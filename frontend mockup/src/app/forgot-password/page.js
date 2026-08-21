"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (!supabase) {
      setError("Supabase is not configured. Check your .env.local file.");
      setBusy(false);
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) setError("We could not send that reset email. Please try again.");
    else setMessage("If an account exists for that email, a reset link is on its way.");
    setBusy(false);
  }

  return (
    <main className="min-h-screen grid place-items-center bg-bg p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-xl">
        <Link href="/" className="font-display font-extrabold text-lg text-ink">
          Rasoi<span className="text-accent">Saathi</span>
        </Link>
        <p className="font-mono text-xs tracking-widest text-accent mt-14">ACCOUNT RECOVERY</p>
        <h1 className="font-display text-3xl font-extrabold text-ink mt-4">Reset your password</h1>
        <p className="text-muted mt-3">Supabase Auth will send a secure recovery link to your inbox.</p>
        {error && <p className="mt-5 text-sm text-red-700">{error}</p>}
        {message && <p className="mt-5 text-sm text-green-700">{message}</p>}
        <form onSubmit={submit} className="grid gap-4 mt-8">
          <input
            className="rounded-lg border border-border bg-surface-2 px-4 py-3"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={busy} className="rounded-lg bg-gradient-to-r from-accent to-accent-2 py-3 text-white font-bold">
            {busy ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <Link href="/login" className="block text-center text-sm font-bold text-accent mt-6">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}