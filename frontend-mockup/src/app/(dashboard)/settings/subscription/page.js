"use client";

import { useState, useMemo } from "react";
import {
  MessageCircle, Store, Package, Sparkles, Building2, Check, TrendingDown,
  Zap, ShieldCheck, CreditCard, XCircle, Star, ChevronDown, Flame,
  IndianRupee, ArrowRight,
} from "lucide-react";

/* ---------------- config: edit prices/copy here only ---------------- */

const YEARLY_FREE = 2; // pay 10 months, get 12

const MODULES = [
  { id: "whatsapp",    name: "WhatsApp Ordering",    desc: "Take orders directly through WhatsApp chat.", price: 399, icon: MessageCircle, color: "text-green-600",  bg: "bg-green-500/10",  features: ["Auto-reply menu & cart", "Order confirmations", "Zero commission"] },
  { id: "aggregators", name: "Aggregators Sync",     desc: "Sync Swiggy & Zomato orders in one place.",   price: 599, icon: Store,         color: "text-orange-500", bg: "bg-orange-500/10", badge: "Most popular", features: ["Unified order screen", "Menu & price sync", "Missed-order alerts"] },
  { id: "inventory",   name: "Predictive Inventory", desc: "AI-powered stock tracking & reorder alerts.", price: 399, icon: Package,       color: "text-blue-500",   bg: "bg-blue-500/10",   features: ["Consumption forecast", "Low-stock alerts", "Wastage insights"] },
  { id: "copilot",     name: "RasoiSaathi Copilot",  desc: "Your AI assistant for business decisions.",   price: 599, icon: Sparkles,      color: "text-accent",     bg: "bg-accent/10",     badge: "New", features: ["Ask anything about sales", "Daily briefing", "Pricing suggestions"] },
  { id: "multibranch", name: "Multi-Branch",         desc: "Manage multiple outlets from one dashboard.", price: 799, icon: Building2,     color: "text-purple-500", bg: "bg-purple-500/10", features: ["Outlet-wise reports", "Central menu control", "Staff roles"] },
];

const BUNDLES = [
  { id: "starter",  name: "Starter",  tagline: "Single outlet, getting online",  ids: ["whatsapp", "inventory"] },
  { id: "growth",   name: "Growth",   tagline: "Selling on Swiggy & Zomato too", ids: ["whatsapp", "aggregators", "inventory"], hot: true },
  { id: "complete", name: "Complete", tagline: "Everything, max discount",       ids: MODULES.map((m) => m.id) },
];

const FAQS = [
  ["Can I add or remove modules later?", "Yes. Toggle any module on or off anytime. Billing adjusts from your next cycle — no lock-in, no cancellation fee."],
  ["How does the bundle discount work?", "Any 3 modules gets you 10% off your whole bill. All 5 gets you 20% off. Applied automatically, forever."],
  ["Is there a free plan?", "Yes — the Free Tier includes basic order taking and a daily sales summary. Modules add automation on top."],
  ["Do you provide GST invoices?", "Every payment generates a GST-compliant invoice, downloadable from Billing instantly."],
];

/* ---------------------------- helpers ------------------------------ */

const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const GRAD = "bg-gradient-to-r from-orange-500 to-amber-400";

// All pricing math in one place.
function usePricing(ids, cycle) {
  return useMemo(() => {
    const picked = MODULES.filter((m) => ids.includes(m.id));
    const subtotal = picked.reduce((s, m) => s + m.price, 0);
    const count = picked.length;
    const pct = count >= 5 ? 20 : count >= 3 ? 10 : 0;
    const discount = Math.round((subtotal * pct) / 100);
    const monthly = subtotal - discount;
    const yearly = monthly * (12 - YEARLY_FREE);
    return {
      picked, subtotal, count, pct, discount, monthly, yearly,
      yearlySaving: monthly * 12 - yearly,
      billed: cycle === "yearly" ? yearly : monthly,
      perDay: monthly ? Math.max(1, Math.round(monthly / 30)) : 0,
      need: count < 3 ? 3 - count : count < 5 ? 5 - count : 0,
      nextPct: count < 3 ? 10 : count < 5 ? 20 : 0,
      progress: (count / MODULES.length) * 100,
    };
  }, [ids, cycle]);
}

/* --------------------------- components ---------------------------- */

function ModuleCard({ mod, selected, cycle, onToggle }) {
  const Icon = mod.icon;
  const shown = cycle === "yearly"
    ? Math.round((mod.price * (12 - YEARLY_FREE)) / 12)
    : mod.price;

  return (
    <button
      onClick={onToggle}
      className={`group relative text-left rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        selected
          ? "border-accent bg-accent/[0.04] ring-1 ring-accent shadow-lg shadow-orange-500/5"
          : "border-border bg-surface hover:border-accent/40"
      }`}
    >
      {mod.badge && (
        <span className={`absolute top-4 right-14 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          mod.badge === "Most popular" ? `${GRAD} text-white` : "border border-accent/30 bg-accent/10 text-accent"
        }`}>
          {mod.badge.toUpperCase()}
        </span>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl transition-transform group-hover:scale-110 ${mod.bg}`}>
            <Icon className={mod.color} size={20} />
          </div>
          <div>
            <p className="font-semibold text-ink">{mod.name}</p>
            <p className="text-xs text-muted mt-0.5">{mod.desc}</p>
          </div>
        </div>
        <div className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition ${
          selected ? `${GRAD} border-transparent scale-110` : "border-border group-hover:border-accent/50"
        }`}>
          {selected && <Check size={12} className="text-white" />}
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {mod.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-muted">
            <Check size={13} className={selected ? "text-accent" : "text-muted/60"} />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-end justify-between">
        <p className="text-lg font-bold text-ink">
          {inr(shown)}<span className="text-sm font-normal text-muted">/mo</span>
          {cycle === "yearly" && (
            <span className="ml-2 text-xs font-normal text-muted line-through">{inr(mod.price)}</span>
          )}
        </p>
        <span className={`text-xs font-medium ${selected ? "text-accent" : "text-muted opacity-0 group-hover:opacity-100 transition"}`}>
          {selected ? "Added ✓" : "Tap to add"}
        </span>
      </div>
    </button>
  );
}

function DiscountProgress({ p }) {
  return (
    <div className="mb-8 rounded-2xl border border-border bg-surface-2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-muted">
          <TrendingDown size={16} className="text-accent shrink-0" />
          {p.count === 0
            ? <>You&apos;re on the <b className="text-ink font-semibold">Free Tier</b> — add a module to start automating.</>
            : p.need > 0
              ? <>Add <b className="text-ink font-semibold">{p.need} more module{p.need === 1 ? "" : "s"}</b> to unlock <b className="text-accent font-semibold">{p.nextPct}% off</b>.</>
              : <b className="text-green-600 font-medium">Maximum 20% bundle discount unlocked. Nice. 🎉</b>}
        </span>
        <span className="text-xs font-medium text-muted">{p.count}/{MODULES.length} modules</span>
      </div>

      <div className="relative mt-4 h-2 w-full rounded-full bg-border/60">
        <div className={`absolute inset-y-0 left-0 rounded-full ${GRAD} transition-all duration-500`} style={{ width: `${p.progress}%` }} />
        {[3, 5].map((t) => (
          <div key={t} className="absolute -top-1 h-4 w-px bg-border" style={{ left: `${(t / MODULES.length) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>Free Tier</span>
        <span className={p.count >= 3 ? "text-accent font-medium" : ""}>3 modules · 10% off</span>
        <span className={p.count >= 5 ? "text-accent font-medium" : ""}>All 5 · 20% off</span>
      </div>
    </div>
  );
}

function StickyBar({ p, cycle }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 md:left-[280px] z-20 border-t border-border bg-surface/95 backdrop-blur px-6 md:px-8 py-4">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {p.count === 0
              ? <span className="text-xs text-muted">No modules selected · Free Tier</span>
              : p.picked.map((m) => (
                  <span key={m.id} className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{m.name}</span>
                ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">Subtotal: <b className="text-ink font-medium">{inr(p.subtotal)}</b></span>
            {p.pct > 0 && (
              <span className="flex items-center gap-1 font-medium text-green-600">
                <TrendingDown size={14} />{p.pct}% off (−{inr(p.discount)})
              </span>
            )}
            {cycle === "yearly" && p.count > 0 && (
              <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">+2 months free</span>
            )}
          </div>

          <p className="mt-1 text-2xl font-bold text-ink">
            {inr(cycle === "yearly" ? p.yearly : p.monthly)}
            <span className="text-sm font-normal text-muted">{cycle === "yearly" ? "/year" : "/month"}</span>
            {cycle === "yearly" && p.count > 0 && (
              <span className="ml-2 text-xs font-normal text-muted">≈ {inr(Math.round(p.yearly / 12))}/mo</span>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            disabled={p.count === 0}
            className={`px-7 py-3 rounded-xl font-medium transition ${
              p.count === 0
                ? "cursor-not-allowed bg-surface-2 text-muted"
                : `${GRAD} text-white shadow-lg shadow-orange-500/20 hover:opacity-90 active:scale-[0.98]`
            }`}
          >
            {p.count === 0 ? "Select a module" : `Update Subscription · ${inr(p.billed)}`}
          </button>
          <p className="text-center text-[11px] text-muted">Secure payment · Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ page ------------------------------- */

export default function SubscriptionPage() {
  const [selectedIds, setSelectedIds] = useState(["whatsapp", "inventory"]);
  const [cycle, setCycle] = useState("monthly");
  const [openFaq, setOpenFaq] = useState(null);
  const p = usePricing(selectedIds, cycle);

  const toggle = (id) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const activeBundle = useMemo(() => {
    const key = [...selectedIds].sort().join();
    return BUNDLES.find((b) => [...b.ids].sort().join() === key)?.id ?? null;
  }, [selectedIds]);

  return (
    // pb-56 clears the fixed summary bar so the last FAQ stays visible
    <div className="p-6 md:p-8 pb-56">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 md:p-8 mb-8">
        <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-gradient-to-br from-orange-500/25 to-amber-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-gradient-to-tr from-amber-400/20 to-orange-500/5 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Flame size={13} /> Pay only for what you use
          </span>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-ink">
            Build your <span className={`${GRAD} bg-clip-text text-transparent`}>perfect plan</span>
          </h1>
          <p className="mt-2 max-w-xl text-muted">
            No bloated packages. Switch on the modules your kitchen actually needs — and unlock up to{" "}
            <b className="text-ink font-semibold">20% off</b> as you bundle.
          </p>

          {/* Billing toggle */}
          <div className="mt-6 inline-flex items-center rounded-xl border border-border bg-surface-2 p-1">
            {["monthly", "yearly"].map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                  cycle === c ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {c}
                {c === "yearly" && (
                  <span className={`${GRAD} rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white`}>2 MONTHS FREE</span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-green-600" /> 2,400+ restaurants onboard</span>
            <span className="inline-flex items-center gap-1.5"><XCircle size={14} className="text-accent" /> Cancel anytime</span>
            <span className="inline-flex items-center gap-1.5"><CreditCard size={14} className="text-blue-500" /> UPI, cards & GST invoices</span>
          </div>
        </div>
      </div>

      {/* BUNDLES */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Quick start bundles</h2>
        {p.count > 0 && (
          <button onClick={() => setSelectedIds([])} className="text-xs text-muted hover:text-ink transition">Clear all</button>
        )}
      </div>
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {BUNDLES.map((b) => {
          const sub = MODULES.filter((m) => b.ids.includes(m.id)).reduce((s, m) => s + m.price, 0);
          const pct = b.ids.length >= 5 ? 20 : b.ids.length >= 3 ? 10 : 0;
          const active = activeBundle === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setSelectedIds(b.ids)}
              className={`relative rounded-2xl border p-4 text-left transition ${
                active ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-border bg-surface hover:border-accent/40"
              }`}
            >
              {b.hot && !active && (
                <span className={`absolute -top-2 right-3 rounded-full ${GRAD} px-2 py-0.5 text-[10px] font-semibold text-white`}>RECOMMENDED</span>
              )}
              <p className="font-semibold text-ink">{b.name}</p>
              <p className="mt-0.5 text-xs text-muted">{b.tagline}</p>
              <p className="mt-3 text-sm font-bold text-ink">
                {inr(sub - Math.round((sub * pct) / 100))}
                <span className="text-xs font-normal text-muted">/mo</span>
                {pct > 0 && <span className="ml-2 text-xs font-medium text-green-600">{pct}% off</span>}
              </p>
            </button>
          );
        })}
      </div>

      {/* MODULES */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map((mod) => (
          <ModuleCard
            key={mod.id}
            mod={mod}
            cycle={cycle}
            selected={selectedIds.includes(mod.id)}
            onToggle={() => toggle(mod.id)}
          />
        ))}
      </div>

      <DiscountProgress p={p} />

      {/* VALUE + PROOF */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-accent/10 p-2"><Zap size={18} className="text-accent" /></div>
            <p className="font-semibold text-ink">Costs less than 1 order/day</p>
          </div>
          <p className="mt-2 text-sm text-muted">
            Your plan works out to about <b className="text-ink font-semibold">{inr(p.perDay)}/day</b> — roughly one thali, for a kitchen that runs itself.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-green-500/10 p-2"><IndianRupee size={18} className="text-green-600" /></div>
            <p className="font-semibold text-ink">Save with yearly billing</p>
          </div>
          <p className="mt-2 text-sm text-muted">
            Yearly saves you <b className="text-green-600 font-semibold">{inr(p.yearlySaving)}</b> on this exact selection.
          </p>
          {cycle === "monthly" && p.count > 0 && (
            <button onClick={() => setCycle("yearly")} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent transition-all hover:gap-2">
              Switch to yearly <ArrowRight size={14} />
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="mt-3 text-sm text-ink">
            &ldquo;We cut stock wastage by nearly a third in two months. The Swiggy–Zomato sync alone saved us a full-time person.&rdquo;
          </p>
          <p className="mt-2 text-xs text-muted">Owner, Annapurna Family Restaurant · Lucknow</p>
        </div>
      </div>

      {/* FAQ */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Common questions</h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {FAQS.map(([q, a], i) => (
          <div key={q}>
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm font-medium text-ink">{q}</span>
              <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${openFaq === i ? "rotate-180 text-accent" : ""}`} />
            </button>
            {openFaq === i && <p className="px-5 pb-4 text-sm text-muted">{a}</p>}
          </div>
        ))}
      </div>

      {/* Safety spacer: keeps the last FAQ clear of the fixed bar on every screen */}
      <div className="h-24" />

      <StickyBar p={p} cycle={cycle} />
    </div>
  );
}