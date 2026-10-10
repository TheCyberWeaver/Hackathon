import { useState } from 'react'
import type { Lecture } from '../../lib/poolApi'
import type { HistoryQuestions } from '../lib/useStudentHistory'

type Props = {
  lectures: Lecture[]
  loading: boolean
  error: boolean
  entries: Record<string, HistoryQuestions>
  onRetryLectures: () => void
  onRetryQuestions: (id: string) => void
  onOpenLecture: (id: string) => void
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
function sessionTime(lecture: Lecture) {
  return new Date(lecture.startedAt || lecture.lectureTime)
}

export default function StudentHistory({
  lectures,
  loading,
  error,
  entries,
  onRetryLectures,
  onRetryQuestions,
  onOpenLecture,
}: Props) {
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest')
  const archive = lectures
    .filter((lecture) => lecture.endedAt)
    .sort((a, b) => {
      const difference = sessionTime(a).getTime() - sessionTime(b).getTime()
      // IDs give equal timestamps a stable order even after a list refresh.
      return (
        (order === 'newest' ? -difference : difference) ||
        a.id.localeCompare(b.id)
      )
    })

  return (
    <>
      <div className="student-history-toolbar">
        <span className="student-history-rule" aria-hidden="true" />
        <label className="student-history-sort">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 4v16m-3-3 3 3 3-3M13 6h7M13 12h5M13 18h3" />
          </svg>
          <span className="sr-only">Sort lectures by date</span>
          <select
            value={order}
            onChange={(event) => setOrder(event.target.value as typeof order)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      {error && (
        <div className="student-history-feedback" role="alert">
          <span>
            Could not refresh past lectures.{' '}
            {archive.length > 0 && 'Showing the last loaded lectures.'}
          </span>
          <button type="button" onClick={onRetryLectures}>
            Try again
          </button>
        </div>
      )}
      {loading && (
        <p className="student-history-message" role="status">
          Loading past lectures…
        </p>
      )}
      {!loading && !error && archive.length === 0 && (
        <p className="empty-message">No past lectures yet.</p>
      )}
      <div className="student-history-list">
        {archive.map((lecture) => {
          const entry = entries[lecture.id]
          const questions = entry?.questions
          const start = sessionTime(lecture)
          const validDate = Number.isFinite(start.getTime())
          return (
            <article key={lecture.id} className="student-history-entry">
              <h2>
                <a
                  className="student-history-summary"
                  href={`/student?lecture=${encodeURIComponent(lecture.id)}`}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return
                    event.preventDefault()
                    onOpenLecture(lecture.id)
                  }}
                >
                  <span className="student-history-title">{lecture.title}</span>
                  <span className="student-history-meta">
                    <time
                      dateTime={validDate ? start.toISOString() : undefined}
                    >
                      <span>
                        {validDate
                          ? dateFormat.format(start)
                          : 'Date unavailable'}
                      </span>
                      {validDate && <span> · {timeFormat.format(start)}</span>}
                    </time>
                    <span className="student-history-count">
                      {questions
                        ? `${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`
                        : entry?.error
                          ? 'Count unavailable'
                          : 'Loading count…'}
                    </span>
                  </span>
                </a>
              </h2>
              {entry?.error && (
                <div className="student-history-feedback" role="alert">
                  <span>
                    {questions
                      ? 'Could not refresh questions. Showing the last loaded questions.'
                      : 'Could not load questions.'}
                  </span>
                  <button
                    type="button"
                    disabled={entry.loading}
                    onClick={() => onRetryQuestions(lecture.id)}
                  >
                    Try again
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </>
  )
}
