"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChefHat, Crown, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabaseConfigured } from "@/lib/supabase";
import { apiRequest } from "@/services/api";

const HOME_FOR_ROLE = { waiter: "/waiter-orders", chef: "/orders", owner: "/dashboard" };
// The demo logins come from the API, which is a round trip away. Remembering the last answer
// lets the "Try as ..." buttons render with the rest of the page instead of appearing a second
// or more later; the API answer then replaces it on every visit.
const DEMO_CACHE_KEY = "rasoisaathi-demo-logins";

// Read once per page load and reused, because useSyncExternalStore needs a stable snapshot.
let remembered;

function rememberedDemo() {
  if (remembered === undefined) {
    try {
      const stored = JSON.parse(localStorage.getItem(DEMO_CACHE_KEY) || "null");
      remembered = stored?.available && stored.accounts?.length ? stored : null;
    } catch {
      remembered = null; // storage blocked (private window): wait for the API instead
    }
  }
  return remembered;
}

function writeCachedDemo(data) {
  remembered = data;
  try {
    if (data) localStorage.setItem(DEMO_CACHE_KEY, JSON.stringify(data));
    else localStorage.removeItem(DEMO_CACHE_KEY);
  } catch {
    /* nothing to do: the buttons still work, they just won't be instant next time */
  }
}

// The server has no localStorage, so it renders without the buttons and this hook fills them in
// as hydration finishes. Same approach as useTheme in @/lib/theme.
const noSubscribe = () => () => {};
const noServerSnapshot = () => null;

function useRememberedDemo() {
  return useSyncExternalStore(noSubscribe, rememberedDemo, noServerSnapshot);
}

const DEMO_ROLES = {
  owner: { label: "Owner", hint: "Dashboard, analytics, stock, AI Copilot", Icon: Crown },
  chef: { label: "Chef", hint: "Live kitchen tickets and recipes", Icon: ChefHat },
  waiter: { label: "Waiter", hint: "Take orders and close payments", Icon: UtensilsCrossed },
};

export default function LoginPage() {
  const { signIn, session, applicationUser, loading, error: profileError } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(supabaseConfigured ? "" : "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to frontend-mockup/.env and restart the dev server.");
  const [busy, setBusy] = useState(null); // "form" or a demo role while signing in
  // undefined until the API answers; null once it says there is no demo workspace.
  const [fetchedDemo, setFetchedDemo] = useState(undefined);
  const lastVisitsDemo = useRememberedDemo();
  const demo = fetchedDemo === undefined ? lastVisitsDemo : fetchedDemo;

  // Already signed in: go straight to this role's home screen.
  useEffect(() => {
    if (loading || !session) return;
    if (applicationUser) router.replace(HOME_FOR_ROLE[applicationUser.role] || "/dashboard");
    else if (profileError?.code === "profile_missing") router.replace("/complete-setup");
  }, [loading, session, applicationUser, profileError, router]);

  // The demo logins exist only once `python seed_demo.py` has run. The buttons are already on
  // screen from the last visit, so this only confirms them.
  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/demo/accounts", {}, null)
      .then((data) => {
        if (cancelled) return;
        const available = data?.available ? data : null;
        setFetchedDemo(available);
        writeCachedDemo(available);
      })
      .catch(() => {
        /* Unreachable API: keep showing what we remembered rather than hiding the buttons. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signInWith(email, password, source) {
    setBusy(source);
    setError("");
    try {
      const result = await signIn(email.trim(), password);
      const role = result?.applicationUser?.role?.toLowerCase();
      router.replace(HOME_FOR_ROLE[role] || "/dashboard");
    } catch (requestError) {
      if (requestError.needsOnboarding) {
        router.replace("/complete-setup");
        return;
      }
      setError(requestError.message || "Unable to sign in.");
    } finally {
      setBusy(null);
    }
  }

  function submit(event) {
    event.preventDefault();
    signInWith(form.email, form.password, "form");
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-surface">
      {/* Exactly one screen tall and pinned, so it stays whole while the form side scrolls. */}
      <section className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen flex-col justify-between p-12 xl:p-20 text-white bg-gradient-to-br from-[#a93220] via-accent to-accent-2 relative overflow-hidden">
        <Link href="/" className="font-display font-extrabold text-lg">
          Rasoi<span className="text-white/70">Saathi</span>
        </Link>
        <div className="relative z-10 max-w-xl">
          <p className="font-mono text-xs tracking-widest text-white/70">RESTAURANT OPERATIONS, IN ONE PLACE</p>
          <h1 className="font-display font-extrabold text-6xl xl:text-7xl leading-none tracking-tight mt-5">Make every service feel considered.</h1>
          <p className="text-white/80 text-lg mt-7 max-w-md">Bring menus, people, inventory, and daily decisions into a calmer rhythm.</p>
        </div>
        <p className="font-mono text-xs text-white/70">14 connected operational data layers</p>
      </section>
      <section className="grid place-items-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <p className="font-mono text-xs tracking-widest text-accent">WELCOME BACK</p>
          <h2 className="font-display text-4xl font-extrabold text-ink mt-4 tracking-tight">Sign in to your workspace</h2>
          <p className="text-muted mt-3">Owners, chefs and waiters all sign in here.</p>
          {error && (
            <p role="alert" className="mt-5 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <form onSubmit={submit} className="grid gap-5 mt-8">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Email
              <input
                className="rounded-lg border border-border bg-surface-2 px-4 py-3 outline-accent"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Password
              <input
                className="rounded-lg border border-border bg-surface-2 px-4 py-3 outline-accent"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <div className="text-right">
              <Link href="/forgot-password" className="text-sm font-bold text-accent">
                Forgot password?
              </Link>
            </div>
            <button
              disabled={Boolean(busy) || !supabaseConfigured}
              className="rounded-lg bg-gradient-to-r from-accent to-accent-2 py-3 text-white font-bold shadow-lg disabled:opacity-60"
            >
              {busy === "form" ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {demo && (
            <div className="mt-8 rounded-2xl border border-border bg-surface-2 p-5">
              <p className="text-sm font-bold text-ink">Just looking around?</p>
              <p className="text-xs text-muted mt-1">
                Explore <strong className="text-ink">{demo.restaurant}</strong>, a sample restaurant with live orders, stock and four weeks of sales. Pick a role:
              </p>
              <div className="grid gap-2 mt-4">
                {demo.accounts.map((account) => {
                  const role = DEMO_ROLES[account.role] || { label: account.role, hint: "", Icon: Crown };
                  return (
                    <button
                      key={account.email}
                      type="button"
                      disabled={Boolean(busy) || !supabaseConfigured}
                      onClick={() => signInWith(account.email, demo.password, account.role)}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:border-accent transition disabled:opacity-60"
                    >
                      <span className="w-9 h-9 shrink-0 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                        <role.Icon size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink">
                          {busy === account.role ? "Opening demo..." : `Try as ${role.label}`}
                        </span>
                        <span className="block text-xs text-muted truncate">{role.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted mt-3 leading-relaxed">
                Or sign in above with {demo.accounts.map((a) => a.email).join(", ")} · password <span className="font-mono text-ink">{demo.password}</span>
              </p>
            </div>
          )}

          <p className="text-center text-sm text-muted mt-7">
            New to Rasoi Saathi?{" "}
            <Link href="/signup" className="font-bold text-accent">
              Create a workspace
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
