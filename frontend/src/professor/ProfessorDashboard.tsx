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

const questionTabs = ['open', 'answered', 'trash'] as const
type Tab = (typeof questionTabs)[number]
type SortMode = 'votes' | 'newest'
type DeleteTarget = { kind: 'question'; id: string } | { kind: 'allTrash' }
type ProfessorPage = 'questions' | 'pastLectures' | 'profile' | 'settings'

const professorRoutes: Record<ProfessorPage, string> = {
  questions: '/professor',
  pastLectures: '/professor/past-lectures',
  profile: '/professor/profile',
  settings: '/professor/settings',
}

const professorFullName = 'Alex Morgan'
const archivedAnsweredCount = mockPastLectures.reduce(
  (total, lecture) => total + lecture.questions.length,
  0,
)

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

function sortQuestions(questions: Question[], mode: SortMode) {
  return [...questions].sort((a, b) => {
    const voteDifference = b.upvoteCount - a.upvoteCount
    const timeDifference = Date.parse(a.createdAt) - Date.parse(b.createdAt)
    return (
      (mode === 'votes'
        ? voteDifference || timeDifference
        : -timeDifference || voteDifference) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )
  })
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
}

function QuestionStatusSummary({
  lectureCount,
  unansweredCount,
  answeredCount,
}: {
  lectureCount: number
  unansweredCount: number
  answeredCount: number
}) {
  return (
    <section aria-labelledby="all-question-status-title" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="all-question-status-title"
          className="text-lg font-semibold text-slate-900"
        >
          Question status
        </h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
          All {lectureCount} demo lectures
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-amber-900">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-amber-500"
            />
            Unanswered
          </span>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {unansweredCount}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-900">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-emerald-500"
            />
            Answered
          </span>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {answeredCount}
          </p>
        </div>
      </div>
    </section>
  )
}

export default function ProfessorDashboard() {
  const [page, setPage] = useState<ProfessorPage>(() =>
    pageFromPath(window.location.pathname),
  )
  const [questions, setQuestions] = useState<Question[]>(() => [
    ...mockQuestions,
  ])
  const [trashedIds, setTrashedIds] = useState<Set<string>>(() => new Set())
  const [selectedTab, setSelectedTab] = useState<Tab>('open')
  const [sortMode, setSortMode] = useState<SortMode>('votes')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [notice, setNotice] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const endDialogRef = useRef<HTMLDialogElement>(null)
  const endTriggerRef = useRef<HTMLButtonElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)
  const openTabRef = useRef<HTMLButtonElement>(null)
  const answeredTabRef = useRef<HTMLButtonElement>(null)
  const trashTabRef = useRef<HTMLButtonElement>(null)
  const mainHeadingRef = useRef<HTMLHeadingElement>(null)
  const sortMenuRef = useRef<HTMLDetailsElement>(null)
  const tabRefs = {
    open: openTabRef,
    answered: answeredTabRef,
    trash: trashTabRef,
  }

  const openQuestionPool = questions.filter(
    (question) => !trashedIds.has(question.id) && !question.answered,
  )
  const answeredQuestionPool = questions.filter(
    (question) => !trashedIds.has(question.id) && question.answered,
  )
  const trashQuestionPool = questions.filter((question) =>
    trashedIds.has(question.id),
  )
  const openQuestions = sortQuestions(openQuestionPool, sortMode)
  const answeredQuestions = sortQuestions(answeredQuestionPool, sortMode)
  const trashQuestions = sortQuestions(trashQuestionPool, sortMode)
  const topVotedRanks = new Map(
    sortQuestions(openQuestionPool, 'votes')
      .slice(0, 3)
      .map((question, index) => [question.id, index + 1] as const),
  )
  const visibleQuestions = {
    open: openQuestions,
    answered: answeredQuestions,
    trash: trashQuestions,
  }[selectedTab]
  const isPermanentDelete =
    deleteTarget?.kind === 'question' && trashedIds.has(deleteTarget.id)

  useEffect(() => {
    function closeSortMenuOnOutsideClick(event: PointerEvent) {
      const menu = sortMenuRef.current
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false
    }
    document.addEventListener('pointerdown', closeSortMenuOnOutsideClick)
    return () =>
      document.removeEventListener('pointerdown', closeSortMenuOnOutsideClick)
  }, [])

  useEffect(() => {
    const handleLocationChange = () =>
      setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  useEffect(() => subscribeQuestionIntakePaused(setQuestionsPaused), [])

  useEffect(() => {
    if (!deleteTarget) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [deleteTarget])

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
    window.requestAnimationFrame(() => tabRefs[selectedTab].current?.focus())
  }

  function restoreQuestion(question: Question) {
    setTrashedIds((current) => {
      const next = new Set(current)
      next.delete(question.id)
      return next
    })
    setExpandedIds((current) => {
      const next = new Set(current)
      next.delete(question.id)
      return next
    })
    setNotice(
      `Question restored to ${question.answered ? 'Answered' : 'Open'}.`,
    )
    window.requestAnimationFrame(() => trashTabRef.current?.focus())
  }

  function closeDialog(confirmed: boolean) {
    if (confirmed && deleteTarget) {
      if (deleteTarget.kind === 'allTrash') {
        setQuestions((current) =>
          current.filter((question) => !trashedIds.has(question.id)),
        )
        setTrashedIds(new Set())
        setExpandedIds((current) => {
          const next = new Set(current)
          for (const id of trashedIds) next.delete(id)
          return next
        })
        setNotice('All deleted questions permanently removed.')
      } else {
        const deleteId = deleteTarget.id
        if (trashedIds.has(deleteId)) {
          setQuestions((current) =>
            current.filter((question) => question.id !== deleteId),
          )
          setTrashedIds((current) => {
            const next = new Set(current)
            next.delete(deleteId)
            return next
          })
          setNotice('Question permanently deleted.')
        } else {
          setTrashedIds((current) => new Set(current).add(deleteId))
          setNotice('Question moved to Deleted.')
        }
        setExpandedIds((current) => {
          const next = new Set(current)
          next.delete(deleteId)
          return next
        })
      }
    }
    setDeleteTarget(null)
    window.requestAnimationFrame(() => {
      const focusTarget = confirmed
        ? tabRefs[selectedTab].current
        : deleteTriggerRef.current
      if (focusTarget?.isConnected) focusTarget.focus()
      else tabRefs[selectedTab].current?.focus()
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
          <span className="text-lg font-bold tracking-[0.12em] text-blue-700">
            ASKPOOL
          </span>
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
            <span className="text-lg font-bold tracking-[0.12em] text-blue-700">
              ASKPOOL
            </span>
          </div>
          <nav
            aria-label="Professor navigation"
            className="mt-12 flex flex-col gap-1"
          >
            {(
              [
                ['questions', 'Current Lecture'],
                ['pastLectures', 'Past Lectures'],
              ] as const
            ).map(([destination, label]) => (
              <button
                key={destination}
                type="button"
                onClick={() => navigateTo(destination)}
                aria-current={page === destination ? 'page' : undefined}
                className={`rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600 ${page === destination ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto border-t border-slate-200 pt-5">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
              <button
                type="button"
                onClick={() => navigateTo('profile')}
                aria-current={page === 'profile' ? 'page' : undefined}
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 ${page === 'profile' ? 'bg-blue-50' : ''}`}
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
            aria-label="Question sections"
            className="mt-8 flex gap-6 overflow-x-auto border-b border-slate-200"
          >
            {questionTabs.map((tab) => (
              <button
                key={tab}
                ref={tabRefs[tab]}
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
                  const currentIndex = questionTabs.indexOf(tab)
                  const direction = event.key === 'ArrowRight' ? 1 : -1
                  const next =
                    questionTabs[
                      (currentIndex + direction + questionTabs.length) %
                        questionTabs.length
                    ]
                  setSelectedTab(next)
                  tabRefs[next].current?.focus()
                }}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 text-sm font-semibold focus-visible:rounded-t focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selectedTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
              >
                {tab === 'open'
                  ? 'Open'
                  : tab === 'answered'
                    ? 'Answered'
                    : 'Deleted'}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${selectedTab === tab ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}
                >
                  {tab === 'open'
                    ? openQuestions.length
                    : tab === 'answered'
                      ? answeredQuestions.length
                      : trashQuestions.length}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            {selectedTab === 'trash' && (
              <button
                type="button"
                disabled={trashQuestions.length === 0}
                onClick={(event) => {
                  deleteTriggerRef.current = event.currentTarget
                  setDeleteTarget({ kind: 'allTrash' })
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-700 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
              >
                <svg
                  aria-hidden="true"
                  className="size-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v7M14 10v7" />
                </svg>
                Delete all
              </button>
            )}
            <details
              ref={sortMenuRef}
              className="relative ml-auto w-full max-w-[240px]"
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  event.currentTarget.open = false
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                event.preventDefault()
                event.currentTarget.open = false
                event.currentTarget.querySelector('summary')?.focus()
              }}
            >
              <summary className="relative cursor-pointer list-none rounded-lg border border-[#d8c6d3] bg-[#faf6f9] pt-1.5 pr-9 pb-1.5 pl-3 text-[#61395c] shadow-sm transition-colors hover:border-[#a6809f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70476a] [&::-webkit-details-marker]:hidden">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-[#8d6b83]">
                  Sort questions
                </span>
                <span className="mt-0.5 block text-sm font-semibold">
                  {sortMode === 'votes'
                    ? 'Most votes'
                    : 'Time asked (newest first)'}
                </span>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#70476a]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m6 9 6 6 6-6"
                  />
                </svg>
              </summary>
              <div
                role="group"
                aria-label="Sort questions by"
                className="absolute right-0 left-0 z-30 mt-1 rounded-lg border border-[#d8c6d3] bg-white p-1 shadow-lg"
              >
                {(
                  [
                    ['votes', 'Most votes'],
                    ['newest', 'Time asked (newest first)'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={sortMode === mode}
                    onClick={() => {
                      setSortMode(mode)
                      if (sortMenuRef.current) sortMenuRef.current.open = false
                      sortMenuRef.current?.querySelector('summary')?.focus()
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[#70476a] ${sortMode === mode ? 'bg-[#f5edf3] font-semibold text-[#61395c]' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    <span>{label}</span>
                    {sortMode === mode && (
                      <span aria-hidden="true" className="text-[#70476a]">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </details>
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
                  : selectedTab === 'answered'
                    ? 'No answered questions yet.'
                    : 'No deleted questions.'}
              </p>
            ) : (
              <div className="space-y-3">
                {visibleQuestions.map((question) => {
                  const expanded = expandedIds.has(question.id)
                  const topRank =
                    selectedTab === 'open'
                      ? topVotedRanks.get(question.id)
                      : undefined
                  const topQuestion = topRank !== undefined
                  return (
                    <article
                      key={question.id}
                      className={`rounded-xl border ${topQuestion ? 'border-orange-200 border-l-[3px] border-l-orange-500 bg-orange-50/70' : `bg-slate-50 ${expanded ? 'border-blue-300' : 'border-slate-200'}`}`}
                    >
                      {topQuestion && (
                        <div className="flex items-center gap-1.5 px-4 pt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-orange-700 sm:px-5 sm:pt-5">
                          <svg
                            aria-hidden="true"
                            className="size-4 shrink-0"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 22c4.4 0 7-3.1 7-7.1 0-3.3-1.8-5.6-3.5-7.2.1 2.1-1.1 3.1-2.2 3.5C13.8 7.7 11.8 4.5 8.9 2c.2 3.3-1.1 5.1-2.5 7C5.5 10.3 5 12 5 14.9 5 19 7.6 22 12 22Z" />
                          </svg>
                          Top voted <span aria-hidden="true">·</span> #{topRank}
                        </div>
                      )}
                      <div
                        className={`flex items-start gap-3 px-4 sm:px-5 ${topQuestion ? 'pt-2' : 'pt-4 sm:pt-5'}`}
                      >
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
                          className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${topQuestion ? 'bg-orange-100 text-orange-800' : 'bg-white text-slate-700'}`}
                          aria-label={`${question.upvoteCount} votes`}
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
                        {selectedTab === 'trash' ? (
                          <button
                            type="button"
                            onClick={() => restoreQuestion(question)}
                            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[#70476a] bg-[#70476a] px-3 py-2 text-sm font-semibold text-white transition-colors hover:border-[#583651] hover:bg-[#583651] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70476a]"
                          >
                            <svg
                              aria-hidden="true"
                              className="size-4 shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-2" />
                            </svg>
                            Restore to {question.answered ? 'Answered' : 'Open'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => changeStatus(question)}
                            className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70476a] ${question.answered ? 'border-[#bd9db6] bg-[#f5edf3]/80 text-[#61395c] hover:border-[#a6809f] hover:bg-[#eadce7]' : 'border-[#70476a] bg-[#70476a] text-white hover:border-[#583651] hover:bg-[#583651]'}`}
                          >
                            <svg
                              aria-hidden="true"
                              className="size-4 shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              {question.answered ? (
                                <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-2" />
                              ) : (
                                <path d="m5 12 4.5 4.5L19 7" />
                              )}
                            </svg>
                            {question.answered
                              ? 'Mark unanswered'
                              : 'Mark answered'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            deleteTriggerRef.current = event.currentTarget
                            setDeleteTarget({
                              kind: 'question',
                              id: question.id,
                            })
                          }}
                          aria-label={
                            selectedTab === 'trash'
                              ? undefined
                              : 'Delete question'
                          }
                          title={
                            selectedTab === 'trash'
                              ? undefined
                              : 'Delete question'
                          }
                          className={`ml-auto inline-flex min-h-9 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selectedTab === 'trash' ? 'border-red-200 bg-red-50/70 px-3 py-2 text-sm font-semibold text-red-700 hover:border-red-300 hover:bg-red-100' : 'size-9 border-slate-300/70 bg-white/50 text-slate-600 hover:border-red-200 hover:bg-red-50/80 hover:text-red-700'}`}
                        >
                          {selectedTab === 'trash' ? (
                            'Delete permanently'
                          ) : (
                            <svg
                              aria-hidden="true"
                              className="size-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v7M14 10v7" />
                            </svg>
                          )}
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
                  <span className="block pl-4 text-xs font-semibold text-blue-700">
                    Course · {lecture.course}
                  </span>
                  <span className="mt-1 block pl-4 font-semibold text-slate-900">
                    {lecture.title}
                  </span>
                  <span className="mt-2 block pl-4 text-xs text-slate-600">
                    Time slot ·{' '}
                    <time dateTime={lecture.date}>
                      {lectureDateFormatter.format(new Date(lecture.date))}
                    </time>{' '}
                    · {lecture.startsAt}–{lecture.endsAt} (Zurich time)
                  </span>
                  <span className="mt-1 block pl-4 text-xs text-slate-500">
                    {lecture.questions.length} answered questions
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
          <QuestionStatusSummary
            lectureCount={mockPastLectures.length + 1}
            unansweredCount={openQuestions.length}
            answeredCount={answeredQuestions.length + archivedAnsweredCount}
          />
          <p className="mt-3 text-xs text-slate-500">
            The mock archive contains answered questions only.
          </p>
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

      {deleteTarget && (
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
            {deleteTarget.kind === 'allTrash'
              ? 'Permanently delete all questions?'
              : isPermanentDelete
                ? 'Permanently delete question?'
                : 'Delete question?'}
          </h2>
          <p
            id="delete-description"
            className="mt-2 text-sm leading-6 text-slate-600"
          >
            {deleteTarget.kind === 'allTrash'
              ? 'Every question in Deleted will be removed from this session and cannot be restored.'
              : isPermanentDelete
                ? 'This question cannot be restored after permanent deletion.'
                : 'You can restore this question from Deleted later.'}
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
              {deleteTarget.kind === 'allTrash'
                ? 'Delete all permanently'
                : isPermanentDelete
                  ? 'Delete permanently'
                  : 'Delete question'}
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
