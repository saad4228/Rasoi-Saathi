import Link from "next/link";
import Reveal from "./Reveal";

const orders = [
  { source: "WhatsApp", name: "Rahul S.", status: "New" },
  { source: "Swiggy", name: "Priya M.", status: "Preparing" },
  { source: "Zomato", name: "Walk-in", status: "Ready" },
  { source: "Direct", name: "Table 4", status: "New" },
];

export default function Hero() {
  return (
    <section className="max-w-[1180px] mx-auto px-8 pt-20 pb-24 grid md:grid-cols-2 gap-16 items-center">
      <Reveal>
        <p className="text-accent font-bold text-sm mb-4">● India&apos;s Modular Restaurant OS</p>
        <h1 className="font-display font-extrabold text-5xl md:text-6xl leading-[1.05] text-ink mb-6">
          One Connected <span className="text-accent">System.</span>
          <br />
          Every <span className="text-accent">Restaurant</span> Operation.
        </h1>
        <p className="text-muted text-lg mb-8 max-w-md">
          Restaurants don&apos;t have a data problem. They have a decision problem.
          RasoiSaathi unifies WhatsApp ordering, aggregators, inventory, and
          insight into one modular platform — with an AI Copilot that tells you why.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/signup" className="bg-gradient-to-r from-accent to-accent-2 text-white font-bold px-6 py-3.5 rounded-xl shadow-[0_6px_20px_-4px_rgba(230,82,43,0.45)] hover:-translate-y-0.5 transition-transform">
            Start a 14-day Free Trial →
          </Link>
          <a href="#how-it-works" className="border-[1.5px] border-border-strong text-ink font-bold px-6 py-3.5 rounded-xl hover:bg-surface-2 transition-colors">
            See How It Works
          </a>
        </div>
        <p className="mt-5 text-sm text-muted">
          Want a look first?{" "}
          <Link href="/login" className="font-bold text-accent hover:underline">
            Try the live demo
          </Link>{" "}
          — no signup needed.
        </p>
      </Reveal>

      <Reveal delay={150}>
        <div className="relative">
          <div className="rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
            <div className="flex gap-1.5 px-4 py-3 border-b border-border">
              <span className="w-2.5 h-2.5 rounded-full bg-border" />
              <span className="w-2.5 h-2.5 rounded-full bg-border" />
              <span className="w-2.5 h-2.5 rounded-full bg-border" />
            </div>
            <div className="flex">
              <div className="w-28 border-r border-border p-4 text-sm space-y-3 hidden sm:block text-muted">
                <p className="text-accent font-semibold">Dashboard</p>
                <p>Orders</p>
                <p>Menu</p>
                <p>Inventory</p>
                <p>Analytics</p>
              </div>
              <div className="flex-1 p-4 space-y-2">
                {orders.map((o) => (
                  <div
                    key={o.name}
                    className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-surface-2 text-sm"
                  >
                    <span className="text-ink font-medium">
                      {o.source} · {o.name}
                    </span>
                    <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-full">
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute -bottom-6 -left-6 bg-surface border border-border rounded-xl shadow-xl p-4 hidden sm:block">
            <p className="text-xs font-bold text-accent-2">⚠ Low</p>
            <p className="text-xs text-muted mb-1">Chicken Stock</p>
            <p className="text-2xl font-display font-bold text-ink">12 kg</p>
          </div>
          <div className="absolute -bottom-12 left-32 bg-surface border border-border rounded-xl shadow-xl p-4 hidden sm:block">
            <p className="text-xs font-bold text-green-500">↑ 44%</p>
            <p className="text-xs text-muted mb-1">Tomorrow&apos;s Demand</p>
            <p className="text-2xl font-display font-bold text-ink">26 kg</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}