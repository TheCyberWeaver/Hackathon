import type { Lecture } from '../../lib/poolApi'
import type { HistoryQuestions } from '../lib/useStudentHistory'

type Props = {
  lecture?: Lecture
  loading: boolean
  error: boolean
  entry?: HistoryQuestions
  onRetry: () => void
  onBack: () => void
  backHref: string
  backLabel: string
}

export default function StudentLecturePage({
  lecture,
  loading,
  error,
  entry,
  onRetry,
  onBack,
  backHref,
  backLabel,
}: Props) {
  const questions = entry?.questions
  const archived = !!lecture?.endedAt && !entry?.unavailable
  return (
    <main className="student-history-page student-lecture-page">
      <section className="page-column">
        <a
          className="student-lecture-back"
          href={backHref}
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
            onBack()
          }}
        >
          ← {backLabel}
        </a>
        <h1>
          {entry?.unavailable
            ? 'Session unavailable'
            : lecture?.title ||
              (loading ? 'Loading lecture…' : 'Lecture unavailable')}
        </h1>
        {error && (
          <div className="student-history-feedback" role="alert">
            <span>Could not load this lecture.</span>
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
        {entry?.unavailable && (
          <p className="empty-message" role="status">
            This session is no longer available.
          </p>
        )}
        {!loading && !error && !archived && !entry?.unavailable && (
          <p className="empty-message">
            This past lecture is not available. Choose a lecture from Past
            Lectures.
          </p>
        )}
        {archived && (
          <>
            <p className="student-lecture-meta">
              <time dateTime={lecture.startedAt || lecture.lectureTime}>
                {new Date(
                  lecture.startedAt || lecture.lectureTime,
                ).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
              {questions && (
                <span>
                  {' '}
                  · {questions.length}{' '}
                  {questions.length === 1 ? 'question' : 'questions'}
                </span>
              )}
            </p>
            {entry?.error && (
              <div className="student-history-feedback" role="alert">
                <span>
                  {questions
                    ? 'Could not refresh questions. Showing the last loaded questions.'
                    : 'Could not load questions.'}
                </span>
                <button type="button" onClick={onRetry}>
                  Try again
                </button>
              </div>
            )}
            {!questions && !entry?.error && (
              <p className="student-history-message" role="status">
                Loading questions…
              </p>
            )}
            {questions?.length === 0 && (
              <p className="empty-message">No questions in this lecture.</p>
            )}
            <div
              className="student-lecture-questions"
              aria-label="Lecture questions"
            >
              {questions?.map((question) => (
                <article key={question.id} className="student-history-question">
                  <p>{question.text}</p>
                  <span
                    className={`student-history-status${question.status === 'answered' ? ' is-answered' : ''}`}
                  >
                    {question.status === 'answered' ? 'Answered' : 'Unanswered'}
                  </span>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  )
}
