import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import type { Lecture } from '../lib/poolApi'
import {
  courseUrl,
  filterSessions,
  type HistoryCourse,
  type HistoryFilters,
} from '../lib/courseHistory'
import { notifyHistoryRoute } from '../lib/useHistoryRoute'
import './course-history.css'

type Props = {
  role: 'student' | 'professor'
  courses: HistoryCourse[]
  courseKey: string
  courseName: string
  filters: HistoryFilters
  loading: boolean
  error: string
  loaded: boolean
  onRetry: () => void
  onNavigate: (url: string) => void
  children: (lectures: Lecture[], title: string) => ReactNode
}
export default function CourseHistory({
  role,
  courses,
  courseKey,
  courseName,
  filters,
  loading,
  error,
  loaded,
  onRetry,
  onNavigate,
  children,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  const course = courses.find((item) => item.key === courseKey)
  const sessions = filterSessions(course?.lectures ?? [], filters)
  const invalidRange =
    filters.dates === 'custom' &&
    !!filters.from &&
    !!filters.to &&
    filters.from > filters.to
  useEffect(() => {
    if (!loaded) return
    const frame = window.requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true })
      window.scrollTo(0, window.history.state?.historyScroll || 0)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [courseKey, loaded])
  function update(values: Partial<HistoryFilters>) {
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value)
      else url.searchParams.delete(key)
    }
    window.history.replaceState(
      { ...window.history.state, historyScroll: 0 },
      '',
      url,
    )
    notifyHistoryRoute()
  }
  function link(event: MouseEvent<HTMLAnchorElement>, url: string) {
    if (
      event.button ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    onNavigate(url)
  }
  const clear = () => update({ dates: 'all', from: '', to: '' })
  return (
    <section className="course-history">
      {courseKey && (
        <a
          className="course-history-back"
          href={courseUrl(role)}
          onClick={(e) => link(e, courseUrl(role))}
        >
          ← Past Lectures
        </a>
      )}
      <h1 ref={heading} tabIndex={-1}>
        {courseKey
          ? course?.title || courseName || 'Course history'
          : 'Past Lectures'}
      </h1>
      {course?.context && <p className="course-context">{course.context}</p>}
      {course?.archived && <span className="course-badge">Archived</span>}
      {!courseKey && (
        <p className="course-history-intro">
          {role === 'student'
            ? 'Your saved sessions, organized by course.'
            : 'Choose a course to revisit its sessions.'}
        </p>
      )}
      {course?.legacy && (
        <p className="course-history-intro">
          This older session has no saved course identity. Its original details
          are preserved here.
        </p>
      )}
      {error && (
        <div className="course-feedback" role="alert">
          <span>
            {error}
            {loaded ? ' Showing the last loaded history.' : ''}
          </span>
          <button onClick={onRetry}>Try again</button>
        </div>
      )}
      {loading && !loaded && (
        <p role="status" className="course-empty">
          Loading history…
        </p>
      )}
      {!courseKey ? (
        <div className="course-grid">
          {courses.map((item) => (
            <a
              key={item.key}
              className="course-card"
              href={courseUrl(role, item)}
              onClick={(e) => link(e, courseUrl(role, item))}
            >
              <div>
                <h2>{item.title}</h2>
                {item.context && (
                  <span className="course-context">{item.context}</span>
                )}
                <span className="course-count">
                  {loaded
                    ? `${item.lectures.length} ${item.lectures.length === 1 ? 'session' : 'sessions'}`
                    : error
                      ? 'Count unavailable'
                      : 'Loading count…'}
                  {item.archived && (
                    <span className="course-badge">Archived</span>
                  )}
                </span>
              </div>
              <span aria-hidden="true" className="course-arrow">
                →
              </span>
            </a>
          ))}
          {loaded && courses.length === 0 && (
            <p className="course-empty">
              {role === 'student'
                ? 'No saved past sessions yet. Courses appear after a session you visited ends.'
                : 'No courses yet. Add a course in Settings to get started.'}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="course-filters">
            <label>
              Sort sessions
              <select
                aria-label="Sort sessions"
                value={filters.order}
                onChange={(e) =>
                  update({ order: e.target.value as HistoryFilters['order'] })
                }
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
            <label>
              Date filter
              <select
                aria-label="Date filter"
                value={filters.dates}
                onChange={(e) => update({ dates: e.target.value })}
              >
                <option value="all">All dates</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            {filters.dates === 'custom' && (
              <>
                <label>
                  From
                  <input
                    type="date"
                    aria-label="From"
                    value={filters.from}
                    onChange={(e) => update({ from: e.target.value })}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    aria-label="To"
                    aria-invalid={invalidRange || undefined}
                    aria-describedby={
                      invalidRange ? 'course-range-error' : undefined
                    }
                    value={filters.to}
                    onChange={(e) => update({ to: e.target.value })}
                  />
                </label>
              </>
            )}
            {filters.dates !== 'all' && (
              <button className="course-clear" onClick={clear}>
                Clear date filter
              </button>
            )}
          </div>
          {invalidRange && (
            <p
              role="alert"
              id="course-range-error"
              className="course-range-error"
            >
              The end date must be on or after the start date.
            </p>
          )}
          {loaded &&
            !invalidRange &&
            (course?.lectures.length ? (
              sessions.length === 0 ? (
                <div className="course-empty">
                  <p>No sessions match these dates.</p>
                  <button onClick={clear}>Clear date filter</button>
                </div>
              ) : null
            ) : (
              <p className="course-empty">
                {course
                  ? 'No past sessions yet. Completed sessions will appear here.'
                  : role === 'student'
                    ? 'No saved sessions are available for this course in your history.'
                    : 'This course is unavailable or has no retained sessions.'}
              </p>
            ))}
          {children(sessions, course?.title || courseName)}
        </>
      )}
    </section>
  )
}
