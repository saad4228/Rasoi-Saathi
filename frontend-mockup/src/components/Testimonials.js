import Reveal from "./Reveal";

const reviews = [
  { text: "We stopped missing WhatsApp orders during rush hour. Customers order directly now, and we keep the margin we used to lose to commissions.", initials: "RV", name: "Owner", role: "Red Villa Restaurant" },
  { text: "The Copilot caught a profit drop before we did — food costs and platform fees were quietly eating margin. We fixed it the same week.", initials: "SG", name: "General Manager", role: "Spice Garden" },
  { text: "One dashboard for Swiggy, Zomato, and our own orders. No more running between three tablets during a Saturday night rush.", initials: "CH", name: "Director", role: "Curry House Chain" },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="max-w-[1180px] mx-auto px-8 py-24">
      <Reveal>
        <div className="text-center mb-16">
          <p className="text-accent font-bold text-sm mb-4">● Early Feedback</p>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-ink mb-4">
            Built for <span className="text-accent">Restaurants Like Yours</span>
          </h2>
          <p className="text-muted max-w-xl mx-auto">
            From pilot conversations with restaurant owners across formats — dhabas,
            cloud kitchens, and multi-outlet chains.
          </p>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-6">
        {reviews.map((r, i) => (
          <Reveal key={r.name} delay={i * 100}>
            <div className="rounded-2xl border border-border bg-surface-2 p-6 h-full">
              <p className="text-accent-2 mb-4">★★★★★</p>
              <p className="text-sm text-ink mb-6">&ldquo;{r.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-r from-accent to-accent-2 text-white text-xs font-bold flex items-center justify-center">
                  {r.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">{r.name}</p>
                  <p className="text-xs text-muted">{r.role}</p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}