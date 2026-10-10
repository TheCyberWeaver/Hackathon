import { useEffect, useRef, useState } from 'react'
import type { Question } from './mockQuestions'
import { mockQuestions } from './mockQuestions'
import type { CurrentUser } from '../lib/api'
import './professor.css'

type Tab = 'open' | 'answered'
type ProfessorPage = 'questions' | 'profile' | 'settings'

const professorRoutes: Record<ProfessorPage, string> = {
  questions: '/professor',
  profile: '/professor/profile',
  settings: '/professor/settings',
}

const professorFullName = 'Alex Morgan'

function pageFromPath(pathname: string): ProfessorPage {
  const path = pathname.replace(/\/$/, '')
  if (path === professorRoutes.profile) return 'profile'
  if (path === professorRoutes.settings) return 'settings'
  return 'questions'
}

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function sortQuestions(questions: Question[]) {
  return [...questions].sort(
    (a, b) =>
      b.upvoteCount - a.upvoteCount ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-5 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  )
}

function ThumbsUpIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 4.7-7.1A2 2 0 0 1 15.4 4v1.2c0 .5-.1 1-.3 1.5L14 10h5.5a2.5 2.5 0 0 1 2.5 3l-1.4 6a2.5 2.5 0 0 1-2.4 2H7"
      />
    </svg>
  )
}

export default function ProfessorDashboard({
  user,
  onSwitchSpace,
}: {
  user: CurrentUser
  onSwitchSpace: () => void
}) {
  const [questions, setQuestions] = useState<Question[]>(() => [
    ...mockQuestions,
  ])
  const [selectedTab, setSelectedTab] = useState<Tab>('open')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const drawerRef = useRef<HTMLDialogElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)
  const openTabRef = useRef<HTMLButtonElement>(null)
  const answeredTabRef = useRef<HTMLButtonElement>(null)
  const mainHeadingRef = useRef<HTMLHeadingElement>(null)

  const openQuestions = sortQuestions(
    questions.filter((question) => !question.answered),
  )
  const answeredQuestions = sortQuestions(
    questions.filter((question) => question.answered),
  )
  const visibleQuestions =
    selectedTab === 'open' ? openQuestions : answeredQuestions

  useEffect(() => {
    if (!drawerOpen) return
    const drawer = drawerRef.current
    drawer?.showModal()
    return () => {
      if (drawer?.open) drawer.close()
    }
  }, [drawerOpen])

  useEffect(() => {
    function handleLocationChange() {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      setPage(pageFromPath(window.location.pathname))
      setDrawerOpen(false)
      setDrawerClosing(false)
    }
    window.addEventListener('popstate', handleLocationChange)
    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      if (closeTimerRef.current !== null)
        window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!deleteId) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [deleteId])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function closeDrawer(nextPage?: ProfessorPage) {
    if (closeTimerRef.current !== null) return
    setDrawerClosing(true)
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 180
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setDrawerOpen(false)
      setDrawerClosing(false)
      if (nextPage && nextPage !== page) {
        window.history.pushState(null, '', professorRoutes[nextPage])
        setPage(nextPage)
        window.scrollTo(0, 0)
        window.requestAnimationFrame(() => mainHeadingRef.current?.focus())
      } else {
        window.requestAnimationFrame(() => menuButtonRef.current?.focus())
      }
    }, delay)
  }

  function navigateTo(nextPage: ProfessorPage) {
    closeDrawer(nextPage)
  }

  function changeStatus(question: Question) {
    setQuestions((current) =>
      current.map((item) =>
        item.id === question.id ? { ...item, answered: !item.answered } : item,
      ),
    )
    setNotice(
      question.answered
        ? 'Question marked unanswered.'
        : 'Question marked answered.',
    )
    window.requestAnimationFrame(() => {
      ;(selectedTab === 'open'
        ? openTabRef.current
        : answeredTabRef.current
      )?.focus()
    })
  }

  function closeDialog(confirmed: boolean) {
    if (confirmed && deleteId) {
      setQuestions((current) =>
        current.filter((question) => question.id !== deleteId),
      )
      setExpandedIds((current) => {
        const next = new Set(current)
        next.delete(deleteId)
        return next
      })
      setNotice('Question deleted.')
    }
    setDeleteId(null)
    window.requestAnimationFrame(() => {
      const focusTarget = confirmed
        ? selectedTab === 'open'
          ? openTabRef.current
          : answeredTabRef.current
        : deleteTriggerRef.current
      if (focusTarget?.isConnected) focusTarget.focus()
      else
        (selectedTab === 'open'
          ? openTabRef.current
          : answeredTabRef.current
        )?.focus()
    })
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <header className="bg-[#f7f8fc]">
        <div className="flex h-20 items-center gap-3 px-6">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="professor-drawer"
            onClick={() => setDrawerOpen(true)}
            className="flex size-10 items-center justify-center rounded-xl bg-white text-slate-500 shadow-[0_3px_12px_rgba(15,23,42,0.09)] hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <svg
              aria-hidden="true"
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="4" y="4.5" width="16" height="15" rx="2" />
              <path d="M10 4.5v15" />
            </svg>
          </button>
          <span className="text-[10px] font-bold tracking-[0.2em] text-blue-700">
            ASKPOOL
          </span>
        </div>
      </header>

      {drawerOpen && (
        <dialog
          ref={drawerRef}
          id="professor-drawer"
          aria-label="Navigation"
          data-closing={drawerClosing}
          onCancel={(event) => {
            event.preventDefault()
            closeDrawer()
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return
            const bounds = event.currentTarget.getBoundingClientRect()
            if (event.clientX > bounds.right) closeDrawer()
          }}
          className="professor-drawer fixed inset-y-0 left-0 right-auto m-0 flex h-dvh max-h-none w-[min(20rem,calc(100vw-2rem))] max-w-none flex-col border-0 bg-[#f7f8fc] p-6 text-slate-900 shadow-[12px_0_32px_rgba(15,23,42,0.12)] backdrop:bg-slate-950/35"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              autoFocus
              aria-label="Close navigation"
              onClick={() => closeDrawer()}
              className="flex size-10 items-center justify-center rounded-xl bg-white text-slate-500 shadow-[0_3px_12px_rgba(15,23,42,0.09)] hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <svg
                aria-hidden="true"
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="4" y="4.5" width="16" height="15" rx="2" />
                <path d="M10 4.5v15" />
              </svg>
            </button>
            <span className="text-[10px] font-bold tracking-[0.2em] text-blue-700">
              ASKPOOL
            </span>
          </div>
          <div className="mt-12 flex items-center gap-3 border-b border-slate-200 pb-6">
            <span
              className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700"
              aria-hidden="true"
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="8" r="3.5" />
                <path strokeLinecap="round" d="M5.5 20a6.5 6.5 0 0 1 13 0" />
              </svg>
            </span>
            <div className="min-w-0 break-words">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="mt-1 text-xs text-slate-500">{user.id}</p>
            </div>
          </div>
          <nav
            aria-label="Professor navigation"
            className="mt-12 flex flex-col gap-1"
          >
            <a
              href="/"
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
                onSwitchSpace()
              }}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              Switch space
            </a>
            <button
              type="button"
              onClick={() => navigateTo('questions')}
              aria-current={page === 'questions' ? 'page' : undefined}
              className={`rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600 ${page === 'questions' ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-700'}`}
            >
              Current Lecture
            </button>
          </nav>
          <div className="mt-auto border-t border-slate-200 pt-5">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
              <button
                type="button"
                onClick={() => navigateTo('profile')}
                aria-current={page === 'profile' ? 'page' : undefined}
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 ${page === 'profile' ? 'bg-blue-50' : ''}`}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"
                  aria-hidden="true"
                >
                  <svg
                    className="size-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="12" cy="8" r="3.5" />
                    <path
                      strokeLinecap="round"
                      d="M5.5 20a6.5 6.5 0 0 1 13 0"
                    />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {professorFullName}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Professor
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label="Settings"
                aria-current={page === 'settings' ? 'page' : undefined}
                onClick={() => navigateTo('settings')}
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-slate-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 ${page === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}
              >
                <svg
                  aria-hidden="true"
                  className="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.8 3.8 10.2 2h3.6l.4 1.8a8.7 8.7 0 0 1 1.8.8l1.6-.9 2.5 2.5-.9 1.6c.3.6.6 1.2.8 1.8l1.8.4v3.6l-1.8.4a8.7 8.7 0 0 1-.8 1.8l.9 1.6-2.5 2.5-1.6-.9a8.7 8.7 0 0 1-1.8.8l-.4 1.8h-3.6l-.4-1.8a8.7 8.7 0 0 1-1.8-.8l-1.6.9-2.5-2.5.9-1.6a8.7 8.7 0 0 1-.8-1.8L2 13.8v-3.6l1.8-.4a8.7 8.7 0 0 1 .8-1.8l-.9-1.6 2.5-2.5 1.6.9a8.7 8.7 0 0 1 1.8-.8Z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="mt-3 w-full rounded-lg border border-red-200 bg-red-100 px-3 py-3 text-left text-sm font-medium text-red-800 hover:bg-red-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              Log out
            </button>
          </div>
        </dialog>
      )}

      {page === 'questions' && (
        <main className="professor-page-enter mx-auto max-w-[848px] px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
          <h1
            ref={mainHeadingRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
          >
            Lecture questions
          </h1>
          <div
            role="tablist"
            aria-label="Question status"
            className="mt-8 flex gap-6 border-b border-slate-200"
          >
            {(['open', 'answered'] as const).map((tab) => (
              <button
                key={tab}
                ref={tab === 'open' ? openTabRef : answeredTabRef}
                type="button"
                role="tab"
                id={`${tab}-tab`}
                aria-controls="questions-panel"
                aria-selected={selectedTab === tab}
                tabIndex={selectedTab === tab ? 0 : -1}
                onClick={() => setSelectedTab(tab)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                    return
                  event.preventDefault()
                  const next = tab === 'open' ? 'answered' : 'open'
                  setSelectedTab(next)
                  ;(next === 'open'
                    ? openTabRef.current
                    : answeredTabRef.current
                  )?.focus()
                }}
                className={`-mb-px flex min-h-12 items-center gap-2 border-b-2 text-sm font-semibold focus-visible:rounded-t focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selectedTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
              >
                {tab === 'open' ? 'Open' : 'Answered'}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${selectedTab === tab ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}
                >
                  {tab === 'open'
                    ? openQuestions.length
                    : answeredQuestions.length}
                </span>
              </button>
            ))}
          </div>

          <section
            id="questions-panel"
            role="tabpanel"
            aria-labelledby={`${selectedTab}-tab`}
            className="pt-5"
          >
            {visibleQuestions.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-600">
                {selectedTab === 'open'
                  ? 'No open questions.'
                  : 'No answered questions yet.'}
              </p>
            ) : (
              <div className="space-y-3">
                {visibleQuestions.map((question) => {
                  const expanded = expandedIds.has(question.id)
                  return (
                    <article
                      key={question.id}
                      className={`rounded-xl border bg-slate-50 ${expanded ? 'border-blue-300' : 'border-slate-200'}`}
                    >
                      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={`details-${question.id}`}
                          onClick={() => toggleExpanded(question.id)}
                          className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          <span className="min-w-0 flex-1 text-[15px] font-medium leading-6 break-words text-slate-900">
                            {question.text}
                          </span>
                          <span className="mt-0.5 text-slate-500">
                            <ChevronIcon expanded={expanded} />
                          </span>
                        </button>
                        <div
                          className="flex shrink-0 items-center gap-1.5 rounded-md bg-white px-2 py-1 text-sm font-semibold tabular-nums text-slate-700"
                          aria-label={`${question.upvoteCount} votes`}
                        >
                          <ThumbsUpIcon />
                          {question.upvoteCount}
                        </div>
                      </div>
                      {expanded && (
                        <div
                          id={`details-${question.id}`}
                          className="mx-4 mt-4 border-t border-slate-200 pt-3 text-sm leading-6 text-slate-600 sm:mx-5"
                        >
                          <p>Author: {question.authorId}</p>
                          <p>
                            Submitted:{' '}
                            <time dateTime={question.createdAt}>
                              {timestampFormatter.format(
                                new Date(question.createdAt),
                              )}
                            </time>
                          </p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                        <button
                          type="button"
                          onClick={() => changeStatus(question)}
                          className="rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          {question.answered
                            ? 'Mark unanswered'
                            : 'Mark answered'}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            deleteTriggerRef.current = event.currentTarget
                            setDeleteId(question.id)
                          }}
                          className="rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      )}

      {page === 'profile' && (
        <main className="professor-page-enter mx-auto max-w-[848px] px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
          <h1
            ref={mainHeadingRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
          >
            Profile
          </h1>
          <section
            aria-label="Professor profile"
            className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-6"
          >
            <p className="text-sm font-medium text-slate-600">Full name</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {professorFullName}
            </p>
          </section>
        </main>
      )}

      {page === 'settings' && (
        <main className="professor-page-enter mx-auto max-w-[848px] px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
          <h1
            ref={mainHeadingRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
          >
            Settings
          </h1>
          <section
            aria-labelledby="terms-title"
            className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-6"
          >
            <h2 id="terms-title" className="text-base font-semibold">
              Terms and conditions
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Placeholder: the terms will appear here before sign-in is enabled.
            </p>
          </section>
        </main>
      )}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-1/2 z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2"
      >
        {notice && (
          <p className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
            {notice}
          </p>
        )}
      </div>

      {deleteId && (
        <dialog
          ref={dialogRef}
          aria-labelledby="delete-title"
          aria-describedby="delete-description"
          onCancel={(event) => {
            event.preventDefault()
            closeDialog(false)
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return
            const bounds = event.currentTarget.getBoundingClientRect()
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              closeDialog(false)
          }}
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/40"
        >
          <h2 id="delete-title" className="text-xl font-semibold">
            Delete question?
          </h2>
          <p
            id="delete-description"
            className="mt-2 text-sm leading-6 text-slate-600"
          >
            This question will be removed from the session.
          </p>
          <div className="mt-7 flex justify-end gap-3">
            <button
              type="button"
              autoFocus
              onClick={() => closeDialog(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => closeDialog(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              Delete question
            </button>
          </div>
        </dialog>
      )}
    </div>
  )
}
