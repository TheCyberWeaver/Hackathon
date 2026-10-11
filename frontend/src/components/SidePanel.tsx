import { useEffect, useRef, useState } from 'react'
import type { CurrentUser } from '../lib/api'
import { GearIcon, PanelIcon, ProfileIcon } from './Icons'
import { courseUrl, type HistoryCourse } from '../lib/courseHistory'
import './side-panel.css'

export type SidePanelPage =
  'questions' | 'pastLectures' | 'profile' | 'settings'

type SidePanelProps = {
  user: CurrentUser
  role: 'student' | 'professor'
  page: SidePanelPage | null
  onNavigate: (page: SidePanelPage) => void
  courses?: HistoryCourse[]
  selectedCourse?: string
  historyLoading?: boolean
  historyError?: string
  onCourseNavigate?: (url: string) => void
  launcherClassName?: string
}

export default function SidePanel({
  user,
  role,
  page,
  onNavigate,
  launcherClassName = '',
  courses = [],
  selectedCourse = '',
  historyLoading = false,
  historyError = '',
  onCourseNavigate,
}: SidePanelProps) {
  const [coursesOpen, setCoursesOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const dialogId = `${role}-side-panel`

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    dialog?.showModal()
    const frame = window.requestAnimationFrame(() => {
      dialog
        ?.querySelector('.side-panel-course[aria-current="page"]')
        ?.scrollIntoView({ block: 'nearest' })
    })
    return () => {
      window.cancelAnimationFrame(frame)
      if (dialog?.open) dialog.close()
    }
  }, [open])

  useEffect(() => {
    const handlePopstate = () => {
      if (closeTimerRef.current !== null)
        window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
      setOpen(false)
      setClosing(false)
    }
    window.addEventListener('popstate', handlePopstate)
    return () => {
      window.removeEventListener('popstate', handlePopstate)
      if (closeTimerRef.current !== null)
        window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  function close(nextPage?: SidePanelPage, courseLink?: string) {
    if (closeTimerRef.current !== null) return
    setClosing(true)
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 180
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setOpen(false)
      setClosing(false)
      if (courseLink) onCourseNavigate?.(courseLink)
      else if (nextPage) onNavigate(nextPage)
      else window.requestAnimationFrame(() => triggerRef.current?.focus())
    }, delay)
  }

  return (
    <>
      <div className={`side-panel-launcher ${launcherClassName}`}>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls={dialogId}
          onClick={() => {
            if (selectedCourse) setCoursesOpen(true)
            setOpen(true)
          }}
          className="side-panel-toggle"
        >
          <PanelIcon className="size-5" />
        </button>
        <span className="side-panel-brand">ASKPOOL</span>
      </div>

      {open && (
        <dialog
          ref={dialogRef}
          id={dialogId}
          aria-label="Navigation"
          data-closing={closing}
          onCancel={(event) => {
            event.preventDefault()
            close()
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return
            const bounds = event.currentTarget.getBoundingClientRect()
            if (event.clientX > bounds.right) close()
          }}
          className="side-panel"
        >
          <div className="side-panel-heading">
            <button
              type="button"
              autoFocus
              aria-label="Close navigation"
              onClick={() => close()}
              className="side-panel-toggle"
            >
              <PanelIcon className="size-5" />
            </button>
            <span className="side-panel-brand">ASKPOOL</span>
          </div>

          <nav
            aria-label={`${role === 'student' ? 'Student' : 'Professor'} navigation`}
            className="side-panel-nav"
          >
            <button
              type="button"
              onClick={() => close('questions')}
              aria-current={page === 'questions' ? 'page' : undefined}
              className="side-panel-link"
            >
              Current Lecture
            </button>
            <div className="side-panel-history-heading">
              <button
                type="button"
                onClick={() => close('pastLectures')}
                aria-current={
                  page === 'pastLectures' && !selectedCourse
                    ? 'page'
                    : undefined
                }
                className="side-panel-link"
              >
                Past Lectures
              </button>
              <button
                type="button"
                className="side-panel-course-toggle"
                aria-label={coursesOpen ? 'Collapse courses' : 'Expand courses'}
                aria-expanded={coursesOpen}
                aria-controls={`${dialogId}-courses`}
                onClick={() => setCoursesOpen((value) => !value)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  style={{
                    transform: coursesOpen ? 'rotate(180deg)' : undefined,
                  }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m6 9 6 6 6-6"
                  />
                </svg>
              </button>
            </div>
            {coursesOpen && (
              <div id={`${dialogId}-courses`} className="side-panel-courses">
                {courses.map((course) => (
                  <a
                    key={course.key}
                    href={courseUrl(role, course)}
                    aria-current={
                      selectedCourse === course.key ? 'page' : undefined
                    }
                    className="side-panel-course"
                    onClick={(event) => {
                      if (
                        event.button ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return
                      event.preventDefault()
                      close(undefined, courseUrl(role, course))
                    }}
                  >
                    <span>{course.title}</span>
                    {course.context && <small>{course.context}</small>}
                    {course.archived && <small>Archived</small>}
                  </a>
                ))}
                {!courses.length && (
                  <p className="side-panel-course-note">
                    {historyLoading
                      ? 'Loading courses…'
                      : historyError
                        ? 'History unavailable. Open Past Lectures to retry.'
                        : role === 'student'
                          ? 'Your saved past sessions will appear here.'
                          : 'Add courses in Settings to get started.'}
                  </p>
                )}
              </div>
            )}
          </nav>

          <div className="side-panel-footer">
            <div className="side-panel-account">
              <button
                type="button"
                onClick={() => close('profile')}
                aria-current={page === 'profile' ? 'page' : undefined}
                className="side-panel-account-action"
              >
                <span className="side-panel-account-icon">
                  <ProfileIcon className="size-5" />
                </span>
                <span className="side-panel-person">
                  <span className="side-panel-name">{user.name}</span>
                  <span className="side-panel-email">{user.id}</span>
                </span>
              </button>
              <button
                type="button"
                aria-label="Settings"
                aria-current={page === 'settings' ? 'page' : undefined}
                onClick={() => close('settings')}
                className="side-panel-account-action"
              >
                <span className="side-panel-account-icon">
                  <GearIcon className="size-5" />
                </span>
                <span className="side-panel-account-label">Settings</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="side-panel-logout"
            >
              Log out
            </button>
          </div>
        </dialog>
      )}
    </>
  )
}
