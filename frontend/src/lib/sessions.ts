import { request } from './poolApi'

export type SharedSession = {
  id: string
  code: string
  course: string
  startedAt: string
}

export function getSessionInvite(lectureId: string): Promise<SharedSession> {
  return request<SharedSession>(
    `/lectures/${encodeURIComponent(lectureId)}/invite`,
  )
}

export async function getJoinedSession(): Promise<SharedSession | null> {
  const result = await request<{ session: SharedSession | null }>(
    '/sessions/mine',
  )
  return result.session
}

export function leaveJoinedSession(): Promise<void> {
  return request<void>('/sessions/mine', { method: 'DELETE' })
}

export function joinSession(code: string): Promise<SharedSession> {
  return request<SharedSession>('/sessions/join', {
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
  if (!/^[A-Z0-9]{8,32}$/.test(compact)) return null
  return `${compact.slice(0, 4)}-${compact.slice(4)}`
}
