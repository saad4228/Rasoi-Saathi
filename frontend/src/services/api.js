const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}, session = null) {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 204) return null

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(body?.detail || 'The request could not be completed.')
    error.status = response.status
    throw error
  }

  return body
}

export const api = {
  get: (path, session) => request(path, { method: 'GET' }, session),
  post: (path, data, session) => request(path, {
    method: 'POST',
    body: JSON.stringify(data),
  }, session),
}
