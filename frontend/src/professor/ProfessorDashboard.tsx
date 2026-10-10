import { useEffect, useRef, useState } from 'react'
import { mockPastLectures } from './mockPastLectures'
import type { Question } from './mockQuestions'
import { mockQuestions } from './mockQuestions'
import type { CurrentUser } from '../lib/api'
import { ThumbsUpIcon } from '../components/Icons'
import SidePanel, { type SidePanelPage } from '../components/SidePanel'
import {
  readQuestionIntakePaused,
  saveQuestionIntakePaused,
  subscribeQuestionIntakePaused,
} from '../lib/questionIntake'
import {
  clearLectureStart,
  readLectureStart,
  saveLectureStart,
} from './lectureSession'
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
  const [lectureStartedAt, setLectureStartedAt] = useState<string | null>(() =>
    readLectureStart(user.id),
  )
  const [questionsPaused, setQuestionsPaused] = useState(
    readQuestionIntakePaused,
  )
  const [questions, setQuestions] = useState<Question[]>(() => [
    ...mockQuestions,
  ])
  const [selectedTab, setSelectedTab] = useState<Tab>('open')
  const [page, setPage] = useState<ProfessorPage>(() =>
    pageFromPath(window.location.pathname),
  )
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [endConfirmationOpen, setEndConfirmationOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const endDialogRef = useRef<HTMLDialogElement>(null)
  const endTriggerRef = useRef<HTMLButtonElement>(null)
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

  useEffect(() => subscribeQuestionIntakePaused(setQuestionsPaused), [])

  useEffect(() => {
    if (!deleteId) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [deleteId])

  useEffect(() => {
    if (!endConfirmationOpen) return
    const dialog = endDialogRef.current
    dialog?.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [endConfirmationOpen])

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

  function startLecture() {
    const startedAt = new Date().toISOString()
    setLectureStartedAt(startedAt)
    setQuestionsPaused(false)
    const saved = saveLectureStart(user.id, startedAt)
    const intakeReset = saveQuestionIntakePaused(false)
    if (!saved || !intakeReset) {
      setNotice(
        'Lecture started, but this browser may not remember its controls after a reload.',
      )
    }
  }

  function toggleQuestionIntake() {
    const nextPaused = !questionsPaused
    if (!saveQuestionIntakePaused(nextPaused)) {
      setNotice('Could not update question submissions. Please try again.')
      return
    }
    setQuestionsPaused(nextPaused)
    setNotice(
      nextPaused
        ? 'Pool paused. A little thinking time never hurt.'
        : 'Pool open. Let the questions roll in!',
    )
  }

  function closeEndConfirmation(confirmed: boolean) {
    setEndConfirmationOpen(false)
    if (confirmed) {
      const cleared = clearLectureStart(user.id)
      const intakeReset = saveQuestionIntakePaused(false)
      setLectureStartedAt(null)
      setQuestionsPaused(false)
      setQuestions([...mockQuestions])
      setSelectedTab('open')
      setExpandedIds(new Set())
      setNotice(
        cleared && intakeReset
          ? ''
          : 'The saved session controls could not be cleared and may reappear after a reload.',
      )
    }
    window.requestAnimationFrame(() => {
      if (confirmed) {
        window.scrollTo(0, 0)
        mainHeadingRef.current?.focus({ preventScroll: true })
      } else {
        endTriggerRef.current?.focus()
      }
    })
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

      {page === 'questions' && lectureStartedAt === null && (
        <main className="professor-page-enter grid min-h-[calc(100dvh-5rem)] place-items-center bg-[#f7f8fc] px-5 py-16 sm:px-6">
          <section className="w-full max-w-xl text-center">
            <span
              aria-hidden="true"
              className="mx-auto grid size-20 place-items-center rounded-3xl border border-blue-100 bg-white text-blue-700 shadow-[0_12px_32px_rgba(15,23,42,0.07)]"
            >
              <svg
                className="size-9"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M12 16v4m-4 0h8" />
              </svg>
            </span>
            <h1
              ref={mainHeadingRef}
              tabIndex={-1}
              className="mt-8 text-3xl font-semibold tracking-tight text-slate-900 outline-none sm:text-4xl"
            >
              No session running
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600">
              Start a lecture to open the question pool for this session.
            </p>
            <button
              type="button"
              onClick={startLecture}
              className="mt-9 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(5,150,105,0.2)] hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-emerald-700 motion-safe:transition-[background,transform,box-shadow] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_12px_24px_rgba(5,150,105,0.24)] motion-safe:active:translate-y-0"
            >
              Start lecture
              <svg
                aria-hidden="true"
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>
          </section>
        </main>
      )}

      {page === 'questions' && lectureStartedAt !== null && (
        <main className="professor-page-enter mx-auto max-w-[848px] px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
          <div className="min-[720px]:flex min-[720px]:items-start min-[720px]:justify-between min-[720px]:gap-4 min-[720px]:border-b min-[720px]:border-slate-200 min-[720px]:pb-6">
            <div className="border-b border-slate-200 pb-8 min-[720px]:min-w-0 min-[720px]:border-0 min-[720px]:pb-0">
              <h1
                ref={mainHeadingRef}
                tabIndex={-1}
                className="text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
              >
                Lecture questions
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Started{' '}
                <time dateTime={lectureStartedAt}>
                  {timestampFormatter.format(new Date(lectureStartedAt))}
                </time>
              </p>
            </div>
            <section
              aria-labelledby="session-control-title"
              className={`mt-6 flex flex-col gap-5 rounded-2xl border px-5 py-5 transition-colors min-[720px]:mt-0 min-[720px]:w-[328px] min-[720px]:shrink-0 min-[720px]:gap-3 min-[720px]:py-4 ${questionsPaused ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <h2
                  id="session-control-title"
                  className="text-sm font-semibold text-slate-900"
                >
                  Session Control
                </h2>
                <span className="group relative inline-flex">
                  <span
                    tabIndex={0}
                    aria-describedby="pool-status-description"
                    className={`inline-flex cursor-help items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${questionsPaused ? 'border-amber-300 bg-amber-100 text-amber-900' : 'border-emerald-300 bg-emerald-100 text-emerald-900'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-1.5 rounded-full ${questionsPaused ? 'bg-amber-600' : 'bg-emerald-600'}`}
                    />
                    {questionsPaused ? 'Pool paused' : 'Pool open'}
                  </span>
                  <span
                    id="pool-status-description"
                    role="tooltip"
                    className="pointer-events-none invisible absolute left-0 top-full z-30 mt-2 w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-5 font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  >
                    {questionsPaused
                      ? 'Students cannot submit new questions until you resume the pool.'
                      : 'Students can submit new questions to this lecture.'}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-3 sm:shrink-0">
                <button
                  type="button"
                  aria-pressed={questionsPaused}
                  onClick={toggleQuestionIntake}
                  className="min-h-11 rounded-lg border border-blue-300 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-600 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 min-[720px]:px-3"
                >
                  {questionsPaused ? 'Resume questions' : 'Pause questions'}
                </button>
                <button
                  ref={endTriggerRef}
                  type="button"
                  onClick={() => setEndConfirmationOpen(true)}
                  className="min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:border-rose-700 hover:bg-rose-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 min-[720px]:px-3"
                >
                  End lecture
                </button>
              </div>
            </section>
          </div>
          <div
            role="tablist"
            aria-label="Question status"
            className="mt-8 flex gap-6 border-b border-slate-200 min-[720px]:mt-6"
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
          <p
            key={notice}
            className="professor-toast rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl"
          >
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

      {endConfirmationOpen && (
        <dialog
          ref={endDialogRef}
          aria-labelledby="end-lecture-title"
          aria-describedby="end-lecture-description"
          onCancel={(event) => {
            event.preventDefault()
            closeEndConfirmation(false)
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
              closeEndConfirmation(false)
          }}
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/40"
        >
          <h2 id="end-lecture-title" className="text-xl font-semibold">
            End this lecture?
          </h2>
          <p
            id="end-lecture-description"
            className="mt-2 text-sm leading-6 text-slate-600"
          >
            This demo session and any question changes will be discarded.
          </p>
          <div className="mt-7 flex justify-end gap-3">
            <button
              type="button"
              autoFocus
              onClick={() => closeEndConfirmation(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => closeEndConfirmation(true)}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
            >
              End lecture
            </button>
          </div>
        </dialog>
      )}
    </div>
  )
}
