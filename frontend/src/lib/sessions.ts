export type SharedSession = {
  id: string
  code: string
  course: string
  startedAt: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/sessions${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || 'Could not reach the lecture service.')
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T)
}

export function getActiveSession(): Promise<SharedSession | null> {
  return request<SharedSession | null>('/active')
}

export function createSession(course: string): Promise<SharedSession> {
  return request<SharedSession>('', {
    method: 'POST',
    body: JSON.stringify({ course }),
  })
}

export function endSession(): Promise<void> {
  return request<void>('/active', { method: 'DELETE' })
}

export function getJoinedSession(): Promise<SharedSession | null> {
  return request<SharedSession | null>('/mine')
}

export function leaveJoinedSession(): Promise<void> {
  return request<void>('/mine', { method: 'DELETE' })
}

export function joinSession(code: string): Promise<SharedSession> {
  return request<SharedSession>('/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function joinUrl(code: string): string {
  const url = new URL('/student/join', window.location.origin)
  url.searchParams.set('code', code)
  return url.toString()
}

export function parseJoinCode(value: string): string | null {
  let candidate = value.trim()
  try {
    const url = new URL(candidate)
    if (url.pathname.replace(/\/$/, '') !== '/student/join') return null
    candidate = url.searchParams.get('code') || ''
  } catch {
    // A typed code is not a URL.
  }
  const compact = candidate.toUpperCase().replace(/[\s-]/g, '')
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(compact)) return null
  return `${compact.slice(0, 4)}-${compact.slice(4)}`
}
