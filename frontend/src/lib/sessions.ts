import { request, type Lecture } from './poolApi'

export type SharedSession = {
  id: string
  code: string
  course: string
  startedAt: string
}

function activeSession(lecture: Lecture): SharedSession | null {
  if (!lecture.startedAt || lecture.endedAt) return null
  return {
    id: lecture.id,
    code: lecture.id,
    course: lecture.course || lecture.title,
    startedAt: lecture.startedAt,
  }
}

export async function getSessionInvite(
  lectureId: string,
): Promise<SharedSession> {
  const lecture = await request<Lecture>(
    `/lectures/${encodeURIComponent(lectureId)}`,
  )
  const session = lecture.canManage && activeSession(lecture)
  if (!session) throw new Error('Start this lecture before sharing its code.')
  return session
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
  const id = parseJoinCode(code)
  if (!id) return Promise.reject(new Error('Enter a valid numeric lecture ID.'))
  return request<SharedSession>('/sessions/join', {
    method: 'POST',
    body: JSON.stringify({ code: id }),
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
  return /^[1-9]\d{0,18}$/.test(candidate) ? candidate : null
}
