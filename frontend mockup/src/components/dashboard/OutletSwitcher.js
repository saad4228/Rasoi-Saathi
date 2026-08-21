"use client";

import { useState } from "react";
import { ChevronDown, Check, Store } from "lucide-react";
import { useOutlets } from "@/context/OutletContext";

export default function OutletSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { outlets, activeOutletId, setActiveOutletId, activeOutlet } = useOutlets();

  function handleSelect(id) {
    setActiveOutletId(id);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 text-muted hover:text-ink transition"
      >
        <span className="font-medium">
          {activeOutlet.name}
          <span className="text-muted font-normal"> — {activeOutlet.area}</span>
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-64 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            {outlets.map((outlet) => (
              <button
                key={outlet.id}
                onClick={() => handleSelect(outlet.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition text-left"
              >
                <div className="bg-surface-2 p-1.5 rounded-lg">
                  <Store size={14} className="text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{outlet.name}</p>
                  <p className="text-xs text-muted">{outlet.area}</p>
                </div>
                {outlet.id === activeOutletId && (
                  <Check size={16} className="text-accent" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}