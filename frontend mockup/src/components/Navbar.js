"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const links = [
  { name: "How It Works", href: "#how-it-works" },
  { name: "Features", href: "#features" },
  { name: "AI Copilot", href: "#ai-copilot" },
  { name: "Testimonials", href: "#testimonials" },
  { name: "Pricing", href: "#pricing" },
];

export default function Navbar() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("rasoisaathi-theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("rasoisaathi-theme", next);
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-bg/80 border-b border-border">
      <div className="max-w-[1180px] mx-auto flex items-center justify-between px-8 py-3">
        <a href="#" className="flex items-center gap-2">
          <Image src="/logo.png" alt="RasoiSaathi" width={80} height={80} />
          <span className="font-display font-extrabold text-lg text-ink">
            Rasoi<span className="text-accent">Saathi</span>
          </span>
        </a>

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

        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold text-ink hidden sm:block">
            Login
          </Link>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center hover:-translate-y-0.5 transition-transform text-ink"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
          <Link
            href="/signup"
            className="bg-gradient-to-r from-accent to-accent-2 text-white text-sm font-bold px-5 py-2.5 rounded-[11px] shadow-[0_6px_20px_-4px_rgba(230,82,43,0.45)] hover:-translate-y-0.5 transition-transform inline-block"
          >
            Start For Free
          </Link>
        </div>
      </div>
    </nav>
  );
}