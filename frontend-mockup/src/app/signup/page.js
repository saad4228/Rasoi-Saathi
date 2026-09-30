"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const { signUp, session, applicationUser, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    restaurant_name: "",
    restaurant_email: "",
    restaurant_phone: "",
    branch_address: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });

  // Already have a workspace: nothing to sign up for.
  useEffect(() => {
    if (!loading && session && applicationUser) router.replace("/dashboard");
  }, [loading, session, applicationUser, router]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    if (!supabase) {
      setError("Supabase is not configured. Check your .env.local file.");
      setBusy(false);
      return;
    }

    try {
      const data = await signUp(form.email, form.password, {
        restaurant_name: form.restaurant_name,
        restaurant_email: form.restaurant_email || form.email,
        restaurant_phone: form.restaurant_phone || null,
        owner_name: form.name,
        branch_address: form.branch_address || null,
      });

      if (data.session) {
        router.replace("/dashboard");
      } else {
        setMessage(
          "Account created! Confirm your email from the link we sent, then sign in — your workspace will be set up automatically."
        );
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to create your workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-12 bg-surface">
      {/* Left Form Section */}
      <section className="lg:col-span-7 flex flex-col justify-center px-6 sm:px-12 py-10 order-2 lg:order-1 overflow-y-auto">
        <div className="w-full max-w-xl mx-auto">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <span className="font-display font-extrabold text-2xl text-ink tracking-tight">
              Rasoi<span className="text-accent">Saathi</span>
            </span>
          </Link>

          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-1 rounded-md">
              Restaurant Onboarding
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink mt-3 tracking-tight">
              Set up your kitchen workspace
            </h1>
            <p className="text-sm text-muted mt-2">
              Create your restaurant account to unlock XGBoost inventory forecasting, real-time POS, and staff roles.
            </p>
          </div>

          {error && (
            <div className="mt-5 rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {message}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                  Owner Full Name
                </label>
                <input
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                  placeholder="e.g. Asha Kulkarni"
                  required
                  value={form.name}
                  onChange={update("name")}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                  Login Email
                </label>
                <input
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                  type="email"
                  placeholder="owner@myrestaurant.com"
                  required
                  value={form.email}
                  onChange={update("email")}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                  Restaurant / Brand Name
                </label>
                <input
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                  placeholder="e.g. Saffron Junction"
                  required
                  value={form.restaurant_name}
                  onChange={update("restaurant_name")}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                  placeholder="+91 98765 43210"
                  value={form.restaurant_phone}
                  onChange={update("restaurant_phone")}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                First Outlet Address <span className="normal-case font-medium text-muted">(optional)</span>
              </label>
              <input
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                placeholder="e.g. 12 Central Market, Nagpur"
                value={form.branch_address}
                onChange={update("branch_address")}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                type="password"
                minLength={6}
                placeholder="At least 6 characters"
                required
                value={form.password}
                onChange={update("password")}
              />
            </div>

            <button
              disabled={busy}
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 py-3 text-slate-950 font-extrabold text-sm shadow-md transition disabled:opacity-60 flex items-center justify-center gap-2 mt-4"
            >
              <span>{busy ? "Setting up workspace..." : "Create Restaurant Workspace"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="text-center text-xs text-muted mt-6">
            Already have a workspace?{" "}
            <Link href="/login" className="font-bold text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* Right Feature Showcase Banner */}
      <section className="hidden lg:col-span-5 lg:flex flex-col justify-between p-12 bg-gradient-to-br from-slate-950 via-slate-900 to-stone-900 text-white order-1 lg:order-2 border-l border-border relative overflow-hidden">
        <div className="relative z-10">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold mb-6">
            <Sparkles size={22} />
          </div>

          <p className="font-mono text-xs tracking-widest text-amber-400 uppercase font-bold">
            All-in-One Restaurant OS
          </p>
          <h2 className="font-display font-extrabold text-3xl xl:text-4xl text-white mt-3 leading-snug">
            Built for modern Indian kitchens & multi-branch dining.
          </h2>

          <div className="space-y-4 mt-8">
            {[
              {
                title: "Role-Based Staff Access",
                desc: "Owner dashboard, Kitchen chef KDS screen, and Waiter floor ordering terminal.",
              },
              {
                title: "XGBoost ML Inventory Forecasting",
                desc: "Predict tomorrow's ingredient burn rate and get prioritized restock checklists.",
              },
              {
                title: "Omnichannel Order Sync",
                desc: "Dine-in QR, WhatsApp chatbot, Swiggy, and Zomato tickets in one unified stream.",
              },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-white/5 border border-white/10 p-3.5 rounded-xl">
                <CheckCircle2 size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">{f.title}</h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>RasoiSaathi v2.4</span>
          <span>PostgreSQL + Supabase Cloud</span>
        </div>
      </section>
    </main>
  );
}