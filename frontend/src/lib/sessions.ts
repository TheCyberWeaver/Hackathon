import { listLectures, request, type Lecture } from './poolApi'

export type SharedSession = {
  id: string
  code: string
  course: string
  startedAt: string
}

const storageKey = (userId: string) => `askpool:joined-lecture:${userId}`

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

export async function getJoinedSession(
  userId: string,
): Promise<SharedSession | null> {
  const id = globalThis.localStorage?.getItem(storageKey(userId))
  if (!id) return null
  const lecture = (await listLectures()).find((item) => item.id === id)
  const session = lecture ? activeSession(lecture) : null
  if (!session) globalThis.localStorage?.removeItem(storageKey(userId))
  return session
}

export function leaveJoinedSession(userId: string): void {
  globalThis.localStorage?.removeItem(storageKey(userId))
}

export async function joinSession(
  code: string,
  userId: string,
): Promise<SharedSession> {
  const id = parseJoinCode(code)
  if (!id) throw new Error('Enter a valid numeric lecture ID.')
  const lecture = (await listLectures()).find((item) => item.id === id)
  const session = lecture ? activeSession(lecture) : null
  if (!session)
    throw new Error('This lecture ID is invalid or the lecture has ended.')
  globalThis.localStorage?.setItem(storageKey(userId), id)
  return session
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
  return /^[1-9]\d*$/.test(candidate) ? candidate : null
}
