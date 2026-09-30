"use client";
import Link from "next/link";
import { useState } from "react";
import Reveal from "./Reveal";

const modulesList = [
  { id: "whatsapp", name: "WhatsApp Ordering", desc: "Multilingual WhatsApp chatbot that allows direct orders & saves commissions.", price: 399 },
  { id: "aggregators", name: "Aggregators Sync", desc: "Unified order hub merging Zomato, Swiggy, and direct orders into one dashboard.", price: 599 },
  { id: "inventory", name: "Predictive Inventory", desc: "XGBoost-powered stock prediction to auto-draft orders & reduce raw ingredient waste.", price: 399 },
  { id: "copilot", name: "AI Copilot Chat", desc: "AI assistant that queries your data to answer business performance questions.", price: 599 },
  { id: "multibranch", name: "Multi-Branch Manager", desc: "Franchise tools to sync inventories, orders, and sales across multiple outlets.", price: 799 },
];

export default function Pricing() {
  const [selected, setSelected] = useState([]);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const subtotal = modulesList
    .filter((m) => selected.includes(m.id))
    .reduce((sum, m) => sum + m.price, 0);

  let discount = 0;
  if (selected.length >= 5) discount = 0.2;
  else if (selected.length >= 3) discount = 0.1;

  const total = Math.round(subtotal * (1 - discount));

  return (
    <section id="pricing" className="max-w-[1180px] mx-auto px-8 py-24">
      <Reveal>
        <div className="text-center mb-16">
          <p className="text-accent font-bold text-sm mb-4">● Pricing</p>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-ink mb-4">
            Priced Like the Restaurants <span className="text-accent">We Serve</span>
          </h2>
          <p className="text-muted max-w-xl mx-auto">
            Every restaurant&apos;s problems are different — buy exactly the modules you need.
            Nothing forced, nothing wasted.
          </p>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-2 gap-10">
        <Reveal>
          <div>
            <h3 className="font-display font-bold text-ink mb-1">Select Your Modules</h3>
            <p className="text-sm text-muted mb-5">Add or remove modules to fit your current kitchen operations.</p>
            <div className="space-y-3">
              {modulesList.map((m) => (
                <label
                  key={m.id}
                  className={
                    "flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors " +
                    (selected.includes(m.id) ? "border-accent bg-accent/5" : "border-border bg-surface-2")
                  }
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(m.id)}
                    onChange={() => toggle(m.id)}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between font-semibold text-ink text-sm">
                      <span>{m.name}</span>
                      <span>₹{m.price}/mo</span>
                    </div>
                    <p className="text-xs text-muted mt-1">{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <aside className="rounded-2xl border border-border bg-surface-2 p-6 sticky top-24">
            <p className="text-accent font-bold text-xs mb-1">YOUR BILLING ESTIMATE</p>
            <h3 className="font-display font-bold text-xl text-ink mb-6">Summary</h3>

            <div className="flex justify-between text-sm text-muted mb-2">
              <span>Selected Modules</span>
              <span className="font-mono text-ink">{selected.length} Modules</span>
            </div>
            <div className="flex justify-between text-sm text-muted pb-4 border-b border-border">
              <span>Subtotal</span>
              <span className="font-mono text-ink">₹{subtotal}/mo</span>
            </div>

            <p className="text-xs text-muted mt-4 mb-1">TOTAL MONTHLY PRICE</p>
            <p className="font-display font-extrabold text-4xl text-ink mb-6">
              ₹{total}<span className="text-lg text-muted">/mo</span>
            </p>

            <div className="mb-6">
              <div className="relative h-1.5 rounded-full bg-bg mx-1 mb-3">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-500"
                  style={{ width: (selected.length / modulesList.length) * 100 + "%" }}
                />
                <span
                  className={
                    "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 transition-colors " +
                    (selected.length >= 3 ? "border-accent bg-accent" : "border-border-strong bg-surface")
                  }
                  style={{ left: "60%" }}
                />
                <span
                  className={
                    "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 transition-colors " +
                    (selected.length >= 5 ? "border-accent bg-accent" : "border-border-strong bg-surface")
                  }
                  style={{ left: "100%" }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-semibold">
                <span className={selected.length >= 3 ? "text-accent" : "text-muted"}>3 Modules: 10% off</span>
                <span className={selected.length >= 5 ? "text-accent" : "text-muted"}>All 5: 20% off</span>
              </div>
            </div>

            <Link
              href="/signup"
              className="block text-center w-full bg-gradient-to-r from-accent to-accent-2 text-white font-bold py-3.5 rounded-xl hover:-translate-y-0.5 transition-transform"
            >
              Create your free workspace →
            </Link>
            <p className="text-xs text-muted text-center mt-3">
              Free tier removes signup friction. Standard 14-day trial applies.
            </p>
          </aside>
        </Reveal>
      </div>
    </section>
  );
}