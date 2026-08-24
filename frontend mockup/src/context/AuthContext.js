"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { apiRequest } from "@/services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [applicationUser, setApplicationUser] = useState(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [error, setError] = useState(() => supabaseConfigured ? null : new Error("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."));

  async function loadProfile(nextSession) {
    if (!nextSession) {
      setApplicationUser(null);
      return null;
    }
    const profile = await apiRequest("/api/auth/me", {}, nextSession);
    setApplicationUser(profile);
    setError(null);
    return profile;
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession) {
        try { await loadProfile(currentSession); } catch (profileError) { setError(profileError); }
      }
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession) {
        setApplicationUser(null);
        setError(null);
      } else if (event !== "INITIAL_SESSION") {
        loadProfile(nextSession).catch(setError);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function signIn(email, password) {
    if (!supabase) throw new Error("Supabase is not configured. Check your .env.local file.");
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    let profile = null;
try {
  profile = await loadProfile(data.session);
} catch (profileError) {
  if (profileError.status !== 401) throw profileError;

  const pending = sessionStorage.getItem("pending_onboarding");
  if (pending) {
    await apiRequest("/api/auth/onboarding", { method: "POST", body: pending }, data.session);
    sessionStorage.removeItem("pending_onboarding");
    profile = await loadProfile(data.session);
  } else {
    // First check failed — retry a couple of times before assuming it's really missing,
    // since it can briefly 401 right after login before the profile finishes loading.
    let confirmed = false;
    for (let attempt = 0; attempt < 3 && !confirmed; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        profile = await loadProfile(data.session);
        confirmed = true;
      } catch (retryError) {
        if (retryError.status !== 401) throw retryError;
      }
    }

    if (!confirmed) {
      const needsOnboarding = new Error("Account exists but workspace setup was never completed.");
      needsOnboarding.needsOnboarding = true;
      throw needsOnboarding;
    }
  }
}
return { ...data, applicationUser: profile };
  }

  async function signUp(email, password, restaurant) {
    if (!supabase) throw new Error("Supabase is not configured. Check your .env.local file.");
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) throw signUpError;
    if (data.session) {
      await apiRequest("/api/auth/onboarding", { method: "POST", body: JSON.stringify(restaurant) }, data.session);
      await loadProfile(data.session);
    } else {
      sessionStorage.setItem("pending_onboarding", JSON.stringify(restaurant));
    }
    return data;
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null); setUser(null); setApplicationUser(null); setError(null);
  }

  return <AuthContext.Provider value={{ session, user, applicationUser, loading, error, signIn, signUp, signOut, refreshUser: () => loadProfile(session) }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
