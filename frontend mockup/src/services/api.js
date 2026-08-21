const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiRequest(path, options = {}, session = null) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.detail || "The request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return body;
}
