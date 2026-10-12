import { useEffect, useState } from 'react'
import { getSessionStats } from './professorApi'
import { formatElapsedTime } from './sessionTime'

export default function LectureSessionStats({
  lectureId,
  startedAt,
  now,
}: {
  lectureId: string
  startedAt: string
  now: number
}) {
  const [students, setStudents] = useState<{
    lectureId: string
    count: number | null
  } | null>(null)

  useEffect(() => {
    let active = true
    let pending = false
    const load = async () => {
      if (pending) return
      pending = true
      try {
        const stats = await getSessionStats(lectureId)
        if (active) setStudents({ lectureId, count: stats.studentCount })
      } catch {
        // Never present a failed refresh as zero students or a fresh count.
        if (active) setStudents({ lectureId, count: null })
      } finally {
        pending = false
      }
    }
    const refresh = () => void load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    const timer = window.setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [lectureId])

  const current = students?.lectureId === lectureId ? students : null
  return (
    <dl
      aria-label="Live lecture statistics"
      className="inline-flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
    >
      <div
        className="flex items-center gap-2"
        title="Joined students, excluding you. Updates every 5 seconds. Closing a tab does not leave the session."
      >
        <dt className="text-slate-600">Students in session</dt>
        <dd
          className="font-semibold tabular-nums text-slate-900"
          aria-live="polite"
        >
          {current ? (current.count ?? 'Unavailable') : '…'}
        </dd>
      </div>
      <div
        className="flex items-center gap-2"
        title="Time since this lecture started, including time with questions paused."
      >
        <dt className="text-slate-600">Elapsed</dt>
        <dd
          role="timer"
          aria-label="Lecture elapsed time"
          className="font-semibold tabular-nums text-slate-900"
        >
          {formatElapsedTime(startedAt, now)}
        </dd>
      </div>
    </dl>
  )
}
