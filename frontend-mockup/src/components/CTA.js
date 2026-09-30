import Link from "next/link";
import Reveal from "./Reveal";

export default function CTA() {
  return (
    <section className="max-w-[1180px] mx-auto px-8 py-16">
      <Reveal>
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950 text-center py-20 px-8">
          <div className="w-12 h-12 rounded-xl bg-blue-800/40 border border-blue-600/50 flex items-center justify-center mx-auto mb-6 text-amber-400">★</div>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-white mb-4">
            Ready to Run Your Restaurant on Autopilot?
          </h2>
          <p className="text-blue-100 max-w-md mx-auto mb-8">
            Join restaurants replacing guesswork with a system that tells you what&apos;s happening — and why.
          </p>
          <Link href="/signup" className="inline-block bg-gradient-to-r from-accent to-accent-2 text-white font-bold px-7 py-3.5 rounded-xl hover:-translate-y-0.5 transition-transform">
            Create your free workspace →
          </Link>
        </div>
      </Reveal>
    </section>
  );
}