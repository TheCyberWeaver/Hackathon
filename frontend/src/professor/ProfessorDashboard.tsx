import { useEffect, useRef, useState } from 'react'
import { mockPastLectures } from './mockPastLectures'
import type { Question } from './mockQuestions'
import { mockQuestions } from './mockQuestions'
import type { CurrentUser } from '../lib/api'
import { ThumbsUpIcon } from '../components/Icons'
import SidePanel, { type SidePanelPage } from '../components/SidePanel'
import './professor.css'

type Tab = 'open' | 'answered'
type ProfessorPage = SidePanelPage

const professorRoutes: Record<ProfessorPage, string> = {
  questions: '/professor',
  pastLectures: '/professor/past-lectures',
  profile: '/professor/profile',
  settings: '/professor/settings',
}

const professorFullName = 'Alex Morgan'

function pageFromPath(pathname: string): ProfessorPage {
  const path = pathname.replace(/\/$/, '')
  if (path === professorRoutes.pastLectures) return 'pastLectures'
  if (path === professorRoutes.profile) return 'profile'
  if (path === professorRoutes.settings) return 'settings'
  return 'questions'
}

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const lectureDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
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

export default function ProfessorDashboard({ user }: { user: CurrentUser }) {
  const [questions, setQuestions] = useState<Question[]>(() => [
    ...mockQuestions,
  ])
  const [selectedTab, setSelectedTab] = useState<Tab>('open')
  const [page, setPage] = useState<ProfessorPage>(() =>
    pageFromPath(window.location.pathname),
  )
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
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
    const handleLocationChange = () =>
      setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
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

  function navigateTo(nextPage: SidePanelPage) {
    if (nextPage === page) return
    window.history.pushState(null, '', professorRoutes[nextPage])
    setPage(nextPage)
    window.scrollTo(0, 0)
    window.requestAnimationFrame(() => mainHeadingRef.current?.focus())
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
        <div className="flex h-20 items-center px-6">
          <SidePanel
            user={user}
            role="professor"
            page={page}
            onNavigate={navigateTo}
          />
        </div>
      </header>

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
                          aria-label={`${question.upvoteCount} upvotes`}
                        >
                          <ThumbsUpIcon className="size-4" />
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

      {page === 'pastLectures' && (
        <main className="professor-page-enter mx-auto max-w-[848px] px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
          <h1
            ref={mainHeadingRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
          >
            Past Lectures
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Browse questions and answers from previous lectures. This is a mock
            archive for the demo.
          </p>
          <div className="mt-8 space-y-4">
            {mockPastLectures.map((lecture, index) => (
              <details
                key={lecture.id}
                open={index === 0}
                className="rounded-xl border border-slate-200 bg-slate-50"
              >
                <summary className="cursor-pointer px-5 py-5 marker:text-blue-600 hover:bg-slate-100 focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600 sm:px-6">
                  <span className="font-semibold text-slate-900">
                    {lecture.title}
                  </span>
                  <span className="mt-2 block pl-4 text-xs text-slate-600">
                    <time dateTime={lecture.date}>
                      {lectureDateFormatter.format(new Date(lecture.date))}
                    </time>{' '}
                    · {lecture.questions.length} answered questions
                  </span>
                </summary>
                <div className="space-y-3 border-t border-slate-200 px-5 py-5 sm:px-6">
                  {lecture.questions.map((question) => (
                    <article
                      key={question.id}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <h2 className="text-sm font-semibold leading-6 text-slate-900">
                        {question.text}
                      </h2>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-blue-700">
                        Answer
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {question.answer}
                      </p>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
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
