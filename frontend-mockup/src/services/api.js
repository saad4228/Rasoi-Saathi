import { supabase } from "@/lib/supabase";

// 127.0.0.1, not "localhost": on Windows "localhost" tries IPv6 first, which uvicorn doesn't listen on,
// and every new connection then stalls before falling back.
export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

function getErrorMessage(body, status) {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        const location = Array.isArray(item?.loc) ? item.loc.filter((part) => part !== "body").join(" -> ") : "Request";
        return `${location}: ${item?.msg || JSON.stringify(item)}`;
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    return detail.message || detail.msg || JSON.stringify(detail);
  }
  return status >= 500 ? `The server returned an error (${status}). Check the backend logs.` : "The request could not be completed.";
}

async function currentAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Call the FastAPI backend.
 *
 * Pass `session` to use a specific Supabase session (e.g. right after sign-in);
 * omit it to use the current, auto-refreshed session.
 * Errors carry `status` and, for structured backend errors, `code`
 * (e.g. "profile_missing", "account_inactive", or "network" when the server is unreachable).
 */
export async function apiRequest(path, options = {}, session) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = session === undefined ? await currentAccessToken() : session?.access_token;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  } catch (cause) {
    const error = new Error(
      `Can't reach the Rasoi Saathi server at ${apiBaseUrl}. Make sure the backend is running (cd backend, then: uvicorn app.main:app --reload --port 8000).`
    );
    error.code = "network";
    error.cause = cause;
    throw error;
  }

  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(getErrorMessage(body, response.status));
    error.status = response.status;
    const detail = body?.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) error.code = detail.code;
    throw error;
  }
  return body;
}
