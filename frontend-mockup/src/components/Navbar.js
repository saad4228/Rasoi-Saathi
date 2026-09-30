"use client";
import Image from "next/image";
import Link from "next/link";
import { ThemeIcon, useTheme } from "@/lib/theme";

const links = [
  { name: "How It Works", href: "#how-it-works" },
  { name: "Features", href: "#features" },
  { name: "AI Copilot", href: "#ai-copilot" },
  { name: "Testimonials", href: "#testimonials" },
  { name: "Pricing", href: "#pricing" },
];

export default function Navbar() {
  const [theme, toggleTheme] = useTheme();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-bg/80 border-b border-border">
      <div className="max-w-[1180px] mx-auto flex items-center justify-between gap-3 px-4 sm:px-8 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="RasoiSaathi" width={80} height={80} className="w-11 h-11 sm:w-20 sm:h-20" />
          <span className="font-display font-extrabold text-lg text-ink">
            Rasoi<span className="text-accent">Saathi</span>
          </span>
        </Link>

        <div className="hidden md:flex gap-8">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-semibold text-muted hover:text-ink transition-colors"
            >
              {link.name}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/login" className="text-sm font-semibold text-ink">
            Login
          </Link>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center hover:-translate-y-0.5 transition-transform text-ink"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <ThemeIcon theme={theme} />
          </button>
          <Link
            href="/signup"
            className="bg-gradient-to-r from-accent to-accent-2 text-white text-sm font-bold px-3 sm:px-5 py-2.5 rounded-[11px] whitespace-nowrap shadow-[0_6px_20px_-4px_rgba(230,82,43,0.45)] hover:-translate-y-0.5 transition-transform inline-block"
          >
            Start For Free
          </Link>
        </div>
      </div>
    </nav>
  );
}