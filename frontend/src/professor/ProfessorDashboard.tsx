import { useEffect, useRef, useState } from 'react'
import { mockPastLectures } from './mockPastLectures'
import type { Question } from './mockQuestions'
import { mockQuestions } from './mockQuestions'

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
  const drawerRef = useRef<HTMLDialogElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
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
    if (!deleteTarget) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [deleteTarget])

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
          <p className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
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
    </div>
  )
}
