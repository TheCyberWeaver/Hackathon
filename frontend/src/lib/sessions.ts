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
    code: lecture.joinCode,
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
  const parsed = parseJoinCode(code)
  if (!parsed)
    return Promise.reject(
      new Error('Enter a 6-character lecture code (0–9 and A–F).'),
    )
  return request<SharedSession>('/sessions/join', {
    method: 'POST',
    body: JSON.stringify({ code: parsed }),
  })
}

export function visitLectureByCode(code: string): Promise<Lecture> {
  const parsed = parseJoinCode(code)
  if (!parsed)
    return Promise.reject(
      new Error('Enter a 6-character lecture code (0–9 and A–F).'),
    )
  return request<Lecture>(`/lectures/by-code/${parsed}/visits`, {
    method: 'POST',
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
    if (
      !['/student', '/student/join'].includes(url.pathname.replace(/\/$/, ''))
    )
      return null
    candidate = url.searchParams.get('code') || ''
  } catch {
    // A typed code is not a URL.
  }
  candidate = candidate.trim().toUpperCase()
  return /^[0-9A-F]{6}$/.test(candidate) ? candidate : null
}
