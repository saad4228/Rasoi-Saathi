"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";

const OutletContext = createContext(null);
const STORAGE_KEY = "rasoisaathi-active-outlet";

function readStoredOutlet() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function OutletProvider({ children }) {
  const { applicationUser } = useAuth();
  const userId = applicationUser?.id ?? null;
  // `loadedFor` tells us which user the list belongs to, so "loading" is derived instead of set in the effect.
  const [state, setState] = useState({ loadedFor: null, outlets: [], error: null });
  const [selectedId, setSelectedId] = useState(readStoredOutlet);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    apiRequest("/api/branches")
      .then((branches) => {
        if (!cancelled) setState({ loadedFor: userId, outlets: Array.isArray(branches) ? branches : [], error: null });
      })
      .catch((error) => {
        if (!cancelled) setState((previous) => ({ ...previous, loadedFor: userId, error }));
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const outlets = state.loadedFor === userId ? state.outlets : [];
  const loaded = Boolean(userId) && state.loadedFor === userId;

  // Keep the user's choice if it still exists; otherwise fall back to the first active outlet.
  const activeOutlet =
    outlets.find((outlet) => outlet.id === selectedId) ||
    outlets.find((outlet) => outlet.is_active) ||
    outlets[0] ||
    null;

  const setActiveOutletId = useCallback((id) => {
    setSelectedId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* not persisted; still works for this session */
    }
  }, []);

  const refreshOutlets = useCallback(() => setReloadKey((key) => key + 1), []);

  const value = {
    outlets,
    outletsLoaded: loaded,
    outletsError: state.loadedFor === userId ? state.error : null,
    activeOutlet,
    activeOutletId: activeOutlet?.id ?? null,
    setActiveOutletId,
    refreshOutlets,
    restaurantName: applicationUser?.restaurant_name || outlets[0]?.restaurant_name || "",
  };

  return <OutletContext.Provider value={value}>{children}</OutletContext.Provider>;
}

export function useOutlets() {
  const context = useContext(OutletContext);
  if (!context) {
    throw new Error("useOutlets must be used inside an OutletProvider");
  }
  return context;
}
