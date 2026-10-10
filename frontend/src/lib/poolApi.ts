const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/[/]$/, '')

export class ApiRequestError extends Error {
  readonly status: number
  readonly code?: string
  readonly warningCount?: number

  constructor(
    message: string,
    status: number,
    code?: string,
    warningCount?: number,
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.warningCount = warningCount
  }
}

// Keep transport and contract changes here, away from dashboard rendering.
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiRequestError(
      body?.error || `Request failed (${response.status}).`,
      response.status,
      body?.code,
      typeof body?.warningCount === 'number' ? body.warningCount : undefined,
    )
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export type Lecture = {
  id: string
  title: string
  lectureTime: string
  canManage: boolean
  course: string
  startedAt: string | null
  endedAt: string | null
  questionsPaused: boolean
}
export function listLectures() {
  return request<Lecture[]>('/lectures')
}
export function getLecture(id: string) {
  return request<Lecture>(`/lectures/${encodeURIComponent(id)}`)
}
// Both dashboards need fresh lecture options even when initially opened empty.
export function watchLectures(
  onLectures: (lectures: Lecture[]) => void,
  onError: (error: unknown) => void,
  currentVersion: () => number = () => 0,
  loadLectures: () => Promise<Lecture[]> = listLectures,
) {
  let active = true
  let pending = false
  const refresh = async () => {
    if (!active || pending) return
    pending = true
    const version = currentVersion()
    try {
      const lectures = await loadLectures()
      if (active && version === currentVersion()) onLectures(lectures)
    } catch (error) {
      if (active) onError(error)
    } finally {
      pending = false
    }
  }
  void refresh()
  const timer = globalThis.setInterval(() => {
    void refresh()
  }, 5000)
  if (typeof window !== 'undefined') window.addEventListener('focus', refresh)
  return () => {
    active = false
    globalThis.clearInterval(timer)
    if (typeof window !== 'undefined')
      window.removeEventListener('focus', refresh)
  }
}
export function createLecture(title: string, lectureTime: string, course = '') {
  return request<Lecture>('/lectures', {
    method: 'POST',
    body: JSON.stringify({ title, lectureTime, course }),
  })
}
export function changeLectureSession(
  id: string,
  action: 'start' | 'pause' | 'resume' | 'end',
) {
  return request<Lecture>(`/lectures/${encodeURIComponent(id)}/session`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  })
}
export function initialLectureId(): string {
  return new URLSearchParams(window.location.search).get('lecture') ?? ''
}
export function rememberLecture(id: string) {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.set('lecture', id)
  window.history.replaceState(null, '', url)
}
