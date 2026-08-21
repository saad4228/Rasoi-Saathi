import Reveal from "./Reveal";

const steps = [
  { icon: "💬", title: "Orders Come In", desc: "Customers order via WhatsApp in their own language, or through Swiggy, Zomato, and walk-ins." },
  { icon: "🔗", title: "One Unified Dashboard", desc: "Every order — WhatsApp, aggregator, or direct — lands in one shared view. No more switching tablets." },
  { icon: "📦", title: "Inventory Predicts Itself", desc: "RasoiSaathi forecasts tomorrow's stock from today's sales, before you even think to check." },
  { icon: "✨", title: "AI Copilot Explains Why", desc: "Ask anything about your restaurant's performance — get a reasoned answer that acts, not just a chart." },
];

export default function Flow() {
  return (
    <section id="how-it-works" className="max-w-[1180px] mx-auto px-8 py-24 text-center">
      <Reveal>
        <p className="text-accent font-bold text-sm mb-4">● The Flow</p>
        <h2 className="font-display font-extrabold text-4xl md:text-5xl text-ink mb-4">
          From Order to Insight, <span className="text-accent">Automatically</span>
        </h2>
        <p className="text-muted max-w-xl mx-auto mb-16">
          Every step of a restaurant's day, connected — so nothing falls through the cracks
          and every decision has an answer behind it.
        </p>
      </Reveal>

      <div className="grid md:grid-cols-4 gap-8 relative">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 100}>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-2xl mb-4">
                {s.icon}
              </div>
              <p className="text-xs font-mono text-muted mb-2">0{i + 1}</p>
              <h3 className="font-display font-bold text-ink mb-2">{s.title}</h3>
              <p className="text-sm text-muted">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}