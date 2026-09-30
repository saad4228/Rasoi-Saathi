import Reveal from "./Reveal";

const modules = [
  {
    title: "Multilingual WhatsApp Bot",
    desc: "Customers order directly in their own language — skip the 20–30% aggregator commission.",
    mock: (
      <div className="space-y-2">
        <div className="bg-surface rounded-lg px-3 py-2 text-xs text-ink w-fit">मुझे 2 पनीर रोल चाहिए</div>
        <div className="bg-gradient-to-r from-accent to-accent-2 text-white text-xs font-semibold rounded-lg px-3 py-2 w-fit">
          Order confirmed! Kitchen notified ✓
        </div>
      </div>
    ),
  },
  {
    title: "Unified Order Hub",
    desc: "Swiggy, Zomato, and direct orders in one live dashboard — not three tablets.",
    mock: (
      <div className="bg-surface rounded-lg p-3 text-xs space-y-1.5">
        <div className="flex justify-between font-semibold text-ink">
          <span>All Orders</span><span className="text-green-500">● Live</span>
        </div>
        <div className="flex justify-between text-muted"><span>WhatsApp</span><span>12</span></div>
        <div className="flex justify-between text-muted"><span>Swiggy</span><span>10</span></div>
        <div className="flex justify-between text-muted"><span>Zomato</span><span>8</span></div>
      </div>
    ),
  },
  {
    title: "Predictive Stock Management",
    desc: "XGBoost-powered demand forecasting drafts your next supplier order automatically.",
    mock: (
      <div className="bg-surface rounded-lg p-3 text-xs w-fit">
        <p className="text-accent-2 font-bold mb-1">⚠ Low Stock</p>
        <p className="text-2xl font-display font-bold text-ink">42</p>
      </div>
    ),
  },
  {
    title: "Billing & Table Tracking",
    desc: "Fast, reliable daily operations — billing, tables, and tracking in one place.",
    mock: (
      <div className="bg-surface rounded-lg p-3 text-xs space-y-1 w-full">
        <p className="text-muted font-semibold mb-1">ESTIMATE INVOICE</p>
        <div className="flex justify-between text-ink"><span>Chicken Biryani</span><span>₹320</span></div>
        <div className="flex justify-between text-ink"><span>Paneer Roll ×2</span><span>₹180</span></div>
        <div className="flex justify-between font-bold text-ink border-t border-border pt-1 mt-1"><span>Total</span><span>₹500</span></div>
      </div>
    ),
  },
  {
    title: "Sales & Profitability Insights",
    desc: "See revenue, cost, and margin trends in one connected view — not four different apps.",
    mock: (
      <div className="bg-surface rounded-lg p-3 w-full">
        <p className="text-xs text-muted mb-2">Overview · Month</p>
        <svg viewBox="0 0 100 30" className="w-full h-8">
          <polyline
            points="0,25 15,20 30,22 45,10 60,15 75,5 100,8"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          />
        </svg>
      </div>
    ),
  },
  {
    title: "Ask Anything, Get Answers That Act",
    desc: "Combines sales, inventory, orders, and expenses — explains not just what happened, but why.",
    mock: (
      <div className="space-y-2">
        <div className="bg-gradient-to-r from-accent to-accent-2 text-white text-xs font-semibold rounded-lg px-3 py-2 w-fit">
          Why did profit drop this week?
        </div>
        <div className="bg-surface rounded-lg px-3 py-2 text-xs text-ink">
          Food costs ↑7%, high-margin items sold less.
        </div>
      </div>
    ),
  },
];

export default function Features() {
  return (
    <section id="features" className="max-w-[1180px] mx-auto px-8 py-24">
      <Reveal>
        <div className="text-center mb-16">
          <p className="text-accent font-bold text-sm mb-4">● Platform</p>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-ink mb-4">
            Six Modules. <span className="text-accent">One Operating System.</span>
          </h2>
          <p className="text-muted max-w-xl mx-auto">
            Pick the modules your restaurant needs, connect them when you&apos;re ready,
            and let the AI Copilot reason across all of it.
          </p>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-6">
        {modules.map((m, i) => {
          const bgClasses = [
            "bg-gradient-to-br from-blue-600 via-purple-700 to-slate-900",
            "bg-gradient-to-br from-amber-600 via-orange-700 to-slate-900",
            "bg-gradient-to-br from-rose-600 via-red-800 to-slate-900",
            "bg-gradient-to-br from-teal-600 via-cyan-700 to-slate-900",
            "bg-gradient-to-br from-violet-600 via-indigo-700 to-slate-900",
            "bg-gradient-to-br from-yellow-600 via-amber-700 to-slate-900",
          ];
          return (
            <Reveal key={m.title} delay={i * 80}>
              <div className={`rounded-2xl border border-white/10 ${bgClasses[i]} p-5 h-full`}>
                <div className="bg-black/20 rounded-xl p-4 mb-5 min-h-[100px] flex items-center border border-white/10">
                  {m.mock}
                </div>
                <h3 className="font-display font-bold text-white mb-2">{m.title}</h3>
                <p className="text-sm text-gray-200">{m.desc}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}