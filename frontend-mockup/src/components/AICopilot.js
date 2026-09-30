import Reveal from "./Reveal";

const checks = [
  { title: "Understands Everything", desc: "Combines sales, inventory, orders, and expenses into one reasoning layer." },
  { title: "Finds Root Causes", desc: "Identifies what's actually driving a number, not just the number itself." },
  { title: "Recommends Actions", desc: "Clear, practical next steps that improve profit — not just dashboards." },
];

export default function AICopilot() {
  return (
    <section id="ai-copilot" className="max-w-[1180px] mx-auto px-8 py-24 grid md:grid-cols-2 gap-16 items-center">
      <Reveal>
        <p className="text-accent font-bold text-sm mb-4">● AI-Powered Intelligence</p>
        <h2 className="font-display font-extrabold text-4xl md:text-5xl text-ink mb-6">
          Smart Technology for <span className="text-accent">Smarter Decisions</span>
        </h2>
        <p className="text-muted mb-8">
          RasoiSaathi&apos;s Copilot never answers from memory — it calls real functions
          against your real restaurant data, then reasons over the result.
        </p>
        <div className="space-y-5">
          {checks.map((c) => (
            <div key={c.title} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center text-xs shrink-0 mt-0.5">✓</span>
              <div>
                <p className="font-display font-bold text-ink">{c.title}</p>
                <p className="text-sm text-muted">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div className="rounded-2xl border border-border bg-surface-2 p-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-accent to-accent-2" />
            <div>
              <p className="font-bold text-sm text-ink">RasoiSaathi Copilot</p>
              <p className="text-xs text-green-500">● Online · Connected to Live Database</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-accent to-accent-2 text-white text-sm font-semibold rounded-lg px-4 py-2.5 w-fit mb-4 ml-auto">
            What happens if I raise Chicken Biryani price by ₹10?
          </div>
          <div className="bg-surface rounded-lg p-4 text-sm text-ink space-y-2">
            <p className="text-muted">Based on your historical data, here&apos;s what we estimate:</p>
            <p>1. Estimated <span className="text-accent font-semibold">6% drop</span> in Biryani orders (~120 fewer/month).</p>
            <p>2. That&apos;s about <span className="text-accent font-semibold">₹6,000/month</span> lost from fewer orders.</p>
            <p>3. Remaining ~1,880 orders each earn ₹10 more — about <span className="text-accent font-semibold">₹18,800/month</span> gained.</p>
            <p className="font-bold pt-2 border-t border-border">4. Net effect: <span className="text-green-500">+₹12,800/month.</span></p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}