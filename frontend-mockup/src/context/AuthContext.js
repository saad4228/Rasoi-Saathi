"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { describeAuthError, initialAuthRedirectType, supabase, supabaseConfigured } from "@/lib/supabase";
import { apiRequest } from "@/services/api";

const AuthContext = createContext(null);
const PENDING_ONBOARDING_KEY = "rasoisaathi-pending-onboarding";

// Signup details are kept until the first successful sign-in so they survive
// confirming the email in another tab (sessionStorage would lose them).
function savePendingOnboarding(email, restaurant) {
  try {
    localStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify({ email: email.toLowerCase(), restaurant }));
  } catch {
    /* storage unavailable: the user can finish setup on /complete-setup */
  }
}

function takePendingOnboarding(email) {
  try {
    const stored = JSON.parse(localStorage.getItem(PENDING_ONBOARDING_KEY) || "null");
    if (stored?.email === email?.toLowerCase()) return stored.restaurant;
  } catch {
    /* ignore unreadable storage */
  }
  return null;
}

function clearPendingOnboarding() {
  try {
    localStorage.removeItem(PENDING_ONBOARDING_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [applicationUser, setApplicationUser] = useState(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [error, setError] = useState(() => (supabaseConfigured ? null : new Error("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to frontend-mockup/.env.")));
  // Only the most recent profile request may update state, so a slow response
  // from the auth listener can't overwrite the result of sign-in/onboarding.
  const profileRequest = useRef(0);

  const loadProfile = useCallback(async (nextSession) => {
    const requestId = ++profileRequest.current;
    if (!nextSession) {
      setApplicationUser(null);
      return null;
    }
    try {
      const profile = await apiRequest("/api/auth/me", {}, nextSession);
      if (requestId === profileRequest.current) {
        setApplicationUser(profile);
        setError(null);
      }
      return profile;
    } catch (profileError) {
      if (requestId === profileRequest.current) {
        setApplicationUser(null);
        setError(profileError);
      }
      throw profileError;
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      return undefined;
    }

    let mounted = true;
    const openPasswordReset = () => {
      if (window.location.pathname !== "/reset-password") router.replace("/reset-password");
    };
    supabase.auth
      .getSession()
      .then(async ({ data: { session: currentSession } }) => {
        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession && initialAuthRedirectType === "recovery") {
          // Supabase may send reset links to the site root; finish the reset on the right page.
          openPasswordReset();
        }
        if (currentSession) {
          await loadProfile(currentSession).catch(() => {});
        }
      })
      .catch((sessionError) => {
        if (mounted) setError(describeAuthError(sessionError));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession) {
        profileRequest.current += 1;
        setApplicationUser(null);
        setError(null);
      } else if (event === "PASSWORD_RECOVERY") {
        openPasswordReset();
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        // Also covers signing in from another tab. Only the newest profile request is applied,
        // so this can't overwrite the result of signIn()/signUp() in this tab.
        loadProfile(nextSession).catch(() => {});
      }
      // TOKEN_REFRESHED doesn't change the profile; INITIAL_SESSION is handled by getSession().
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, router]);

  async function signIn(email, password) {
    if (!supabase) throw new Error("Supabase is not configured. Check frontend-mockup/.env.");
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw describeAuthError(signInError);

    let profile;
    try {
      profile = await loadProfile(data.session);
    } catch (profileError) {
      if (profileError.code !== "profile_missing") throw profileError;
      const pending = takePendingOnboarding(email);
      if (!pending) {
        const needsOnboarding = new Error("Your account is ready — tell us about your restaurant to finish setup.");
        needsOnboarding.needsOnboarding = true;
        throw needsOnboarding;
      }
      await apiRequest("/api/auth/onboarding", { method: "POST", body: JSON.stringify(pending) }, data.session);
      clearPendingOnboarding();
      profile = await loadProfile(data.session);
    }
    return { ...data, applicationUser: profile };
  }

  async function signUp(email, password, restaurant) {
    if (!supabase) throw new Error("Supabase is not configured. Check frontend-mockup/.env.");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (signUpError) throw describeAuthError(signUpError);
    // With email confirmation on, Supabase hides existing accounts by returning a user with no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("An account with this email already exists. Sign in instead.");
    }
    if (data.session) {
      await apiRequest("/api/auth/onboarding", { method: "POST", body: JSON.stringify(restaurant) }, data.session);
      await loadProfile(data.session);
    } else {
      savePendingOnboarding(email, restaurant);
    }
    return data;
  }

  async function signOut() {
    profileRequest.current += 1;
    if (supabase) await supabase.auth.signOut().catch(() => {});
    setSession(null);
    setUser(null);
    setApplicationUser(null);
    setError(null);
  }

  const refreshUser = useCallback(() => loadProfile(session), [loadProfile, session]);

  return (
    <AuthContext.Provider value={{ session, user, applicationUser, loading, error, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
