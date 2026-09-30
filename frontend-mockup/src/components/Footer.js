import Link from "next/link";
import Image from "next/image";

const productLinks = [
  ["Features", "/#features"],
  ["AI Copilot", "/#ai-copilot"],
  ["Pricing", "/#pricing"],
];
const accountLinks = [
  ["Sign in", "/login"],
  ["Create a workspace", "/signup"],
];

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-[1180px] mx-auto px-8 py-16 grid md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Image src="/logo.png" alt="RasoiSaathi" width={48} height={48} />
            <span className="font-display font-extrabold text-ink">
              Rasoi<span className="text-accent">Saathi</span>
            </span>
          </div>
          <p className="text-sm text-muted">
            The modular OS for modern Indian restaurants — ordering, inventory, and AI insight in one system.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold text-muted mb-4">PRODUCT</p>
          <div className="space-y-3">
            {productLinks.map(([label, href]) => (
              <a key={label} href={href} className="block text-sm text-ink hover:text-accent">{label}</a>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-muted mb-4">ACCOUNT</p>
          <div className="space-y-3">
            {accountLinks.map(([label, href]) => (
              <Link key={label} href={href} className="block text-sm text-ink hover:text-accent">{label}</Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-[1180px] mx-auto px-8 py-5 flex flex-col sm:flex-row justify-between text-xs text-muted gap-2">
          <span>© 2026 RasoiSaathi | Team ThunderboltZ. All rights reserved.</span>
          <span>Made with ❤️ in India</span>
        </div>
      </div>
    </footer>
  );
}