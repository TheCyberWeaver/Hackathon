import { useState } from 'react'
import { flushSync } from 'react-dom'
import type { Lecture } from '../../lib/poolApi'
import type { HistoryQuestions } from '../lib/useStudentHistory'

type Props = {
  lectures: Lecture[]
  loading: boolean
  error: boolean
  entries: Record<string, HistoryQuestions>
  onRetryLectures: () => void
  onRetryQuestions: (id: string) => void
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
}: Props) {
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest')
  const [expanded, setExpanded] = useState(new Set<string>())
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

  function toggle(id: string, button: HTMLButtonElement) {
    const top = button.getBoundingClientRect().top
    flushSync(() =>
      setExpanded((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    )
    window.scrollBy(0, button.getBoundingClientRect().top - top)
  }

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
          const open = expanded.has(lecture.id)
          const start = sessionTime(lecture)
          const validDate = Number.isFinite(start.getTime())
          const panelId = `history-questions-${lecture.id}`
          return (
            <article
              key={lecture.id}
              className={`student-history-entry${open ? ' is-expanded' : ''}`}
            >
              <h2>
                <button
                  type="button"
                  className="student-history-summary"
                  aria-expanded={open}
                  aria-controls={panelId}
                  id={`history-title-${lecture.id}`}
                  onClick={(event) => toggle(lecture.id, event.currentTarget)}
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
                </button>
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
              <div
                id={panelId}
                className="student-history-questions"
                role="region"
                aria-labelledby={`history-title-${lecture.id}`}
                hidden={!open}
              >
                {!questions && !entry?.error && (
                  <p className="student-history-message" role="status">
                    Loading questions…
                  </p>
                )}
                {questions?.length === 0 && (
                  <p className="student-history-message">
                    No questions in this lecture.
                  </p>
                )}
                {questions?.map((question) => (
                  <article
                    key={question.id}
                    className="student-history-question"
                  >
                    <p>{question.text}</p>
                    <span
                      className={`student-history-status${question.status === 'answered' ? ' is-answered' : ''}`}
                    >
                      {question.status === 'answered'
                        ? 'Answered'
                        : 'Unanswered'}
                    </span>
                  </article>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
