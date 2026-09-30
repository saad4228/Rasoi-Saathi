import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(url && anonKey);
export const supabaseHost = (() => {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return url || "";
  }
})();

// Read before the client starts: supabase-js strips the "#...&type=recovery" marker from the URL
// while it signs the user in, so this is the only reliable way to know a reset link was opened.
export const initialAuthRedirectType = (() => {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hash.get("type") || new URLSearchParams(window.location.search).get("type");
})();

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * A throwaway client that never stores a session. Used to create staff logins
 * from the owner's browser without replacing the owner's own session.
 */
export function createIsolatedAuthClient() {
  if (!supabaseConfigured) return null;
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "rasoisaathi-staff-provisioning",
    },
  });
}

/** Turn Supabase Auth errors into messages a restaurant owner can act on. */
export function describeAuthError(error) {
  const message = error?.message || "";
  if (error?.name === "AuthRetryableFetchError" || /failed to fetch|fetch failed|networkerror|load failed/i.test(message)) {
    return new Error(
      `Can't reach Supabase (${supabaseHost || "auth server"}). Check your internet connection and that your Supabase project is active — free projects pause after a week of inactivity and must be restored from the Supabase dashboard.`
    );
  }
  if (/email not confirmed/i.test(message)) {
    return new Error("Please confirm your email address first — check your inbox for the confirmation link.");
  }
  if (/invalid login credentials/i.test(message)) {
    return new Error("Incorrect email or password.");
  }
  return error instanceof Error ? error : new Error(message || "Authentication failed.");
}
