"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    if (!supabase) { setError("Supabase is not configured. Check your .env.local file."); setBusy(false); return; }
    try { 
      await signIn(form.email, form.password); 
      router.replace("/dashboard"); 
    }
    catch (requestError) { setError(requestError.status === 401 ? "Your account is not active in Rasoi Sathi yet." : requestError.message || "Unable to sign in."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen grid lg:grid-cols-2 bg-surface">
    <section className="hidden lg:flex flex-col justify-between p-12 xl:p-20 text-white bg-gradient-to-br from-[#a93220] via-accent to-accent-2 relative overflow-hidden"><Link href="/" className="font-display font-extrabold text-lg">Rasoi<span className="text-white/70">Saathi</span></Link><div className="relative z-10 max-w-xl"><p className="font-mono text-xs tracking-widest text-white/70">RESTAURANT OPERATIONS, IN ONE PLACE</p><h1 className="font-display font-extrabold text-6xl xl:text-7xl leading-none tracking-tight mt-5">Make every service feel considered.</h1><p className="text-white/80 text-lg mt-7 max-w-md">Bring menus, people, inventory, and daily decisions into a calmer rhythm.</p></div><p className="font-mono text-xs text-white/70">14 connected operational data layers</p></section>
    <section className="grid place-items-center p-6 sm:p-12"><div className="w-full max-w-md"><p className="font-mono text-xs tracking-widest text-accent">WELCOME BACK</p><h2 className="font-display text-4xl font-extrabold text-ink mt-4 tracking-tight">Sign in to your workspace</h2><p className="text-muted mt-3">Use your Supabase Auth email and password.</p>{error && <p className="mt-5 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</p>}<form onSubmit={submit} className="grid gap-5 mt-8"><label className="grid gap-2 text-sm font-bold text-ink">Email<input className="rounded-lg border border-border bg-surface-2 px-4 py-3 outline-accent" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label className="grid gap-2 text-sm font-bold text-ink">Password<input className="rounded-lg border border-border bg-surface-2 px-4 py-3 outline-accent" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><div className="text-right"><Link href="/forgot-password" className="text-sm font-bold text-accent">Forgot password?</Link></div><button disabled={busy} className="rounded-lg bg-gradient-to-r from-accent to-accent-2 py-3 text-white font-bold shadow-lg disabled:opacity-60">{busy ? "Signing in..." : "Sign in"}</button></form><p className="text-center text-sm text-muted mt-7">New to Rasoi Saathi? <Link href="/signup" className="font-bold text-accent">Create a workspace</Link></p></div></section>
  </main>;
}