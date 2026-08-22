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

  const displayName = activeOutlet?.name || "My Restaurant";
  const displayArea = activeOutlet?.area ? ` — ${activeOutlet.area}` : "";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 text-muted hover:text-ink transition py-1.5 px-2 rounded-lg hover:bg-surface-2"
      >
        <span className="font-semibold text-ink text-sm">
          {displayName}
          <span className="text-muted font-normal">{displayArea}</span>
        </span>
        {outlets.length > 1 && (
          <ChevronDown
            size={15}
            className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {isOpen && outlets.length > 1 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-64 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {outlets.map((outlet) => (
              <button
                key={outlet.id}
                onClick={() => handleSelect(outlet.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition text-left"
              >
                <div className="bg-surface-2 p-1.5 rounded-lg">
                  <Store size={14} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{outlet.name}</p>
                  <p className="text-xs text-muted truncate">{outlet.area}</p>
                </div>
                {outlet.id === activeOutletId && (
                  <Check size={16} className="text-amber-500 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}