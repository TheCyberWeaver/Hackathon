import { useEffect, useRef, useState } from 'react'
import {
  changeQuestionStatus,
  deleteQuestion,
  emptyTrash,
  getSummary,
  listArchive,
  listProfessorQuestions,
  permanentlyDeleteQuestion,
  restoreQuestion as restoreSavedQuestion,
  type ArchivedLecture,
  type Question,
  type Summary,
} from './professorApi'
import {
  changeLectureSession,
  initialLectureId,
  rememberLecture,
  watchLectures,
  type Lecture,
} from '../lib/poolApi'
import LecturePicker from '../components/LecturePicker'
import type { CurrentUser } from '../lib/api'
import { ThumbsUpIcon } from '../components/Icons'
import SidePanel, { type SidePanelPage } from '../components/SidePanel'
import './professor.css'

const questionTabs = ['open', 'answered', 'trash'] as const
type Tab = (typeof questionTabs)[number]
type SortMode = 'votes' | 'newest'
type DeleteTarget = { kind: 'question'; id: string } | { kind: 'allTrash' }
type ProfessorPage = SidePanelPage

const professorRoutes: Record<ProfessorPage, string> = {
  questions: '/professor',
  pastLectures: '/professor/past-lectures',
  profile: '/professor/profile',
  settings: '/professor/settings',
}

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
          All {lectureCount} lectures
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

export default function ProfessorDashboard({
  user,
  onResetOnboarding,
}: {
  user: CurrentUser
  onResetOnboarding?: () => boolean
}) {
  const [resetError, setResetError] = useState('')
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [lectureId, setLectureId] = useState(initialLectureId)
  const [questions, setQuestions] = useState<Question[]>([])
  const [archive, setArchive] = useState<ArchivedLecture[]>([])
  const [summary, setSummary] = useState<Summary>({
    lectureCount: 0,
    unansweredCount: 0,
    answeredCount: 0,
  })
  const [apiError, setApiError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})
  const selectedLecture = lectures.find((lecture) => lecture.id === lectureId)
  const lectureStartedAt =
    selectedLecture?.startedAt && !selectedLecture.endedAt
      ? selectedLecture.startedAt
      : null
  const questionsPaused = selectedLecture?.questionsPaused ?? false
  const trashedIds = new Set(
    questions
      .filter((question) => question.deletedAt)
      .map((question) => question.id),
  )
  const mutationPending = useRef(false)
  const mutationVersion = useRef(0)
  const [selectedTab, setSelectedTab] = useState<Tab>('open')
  const [page, setPage] = useState<ProfessorPage>(() =>
    pageFromPath(window.location.pathname),
  )
  const [sortMode, setSortMode] = useState<SortMode>('votes')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [endConfirmationOpen, setEndConfirmationOpen] = useState(false)
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

  useEffect(
    () =>
      watchLectures(
        (items) => {
          if (mutationPending.current) return
          const managed = items.filter((lecture) => lecture.canManage)
          setLectures(managed)
          setApiError('')
          setLectureId(
            (id) =>
              id ||
              managed.find((lecture) => lecture.startedAt && !lecture.endedAt)
                ?.id ||
              managed[0]?.id ||
              '',
          )
        },
        (error) =>
          setApiError(
            error instanceof Error ? error.message : 'Could not load lectures.',
          ),
        () => mutationVersion.current,
      ),
    [],
  )

  useEffect(() => {
    if (!lectureId) return
    rememberLecture(lectureId)
    let active = true
    const load = async () => {
      const version = mutationVersion.current
      try {
        const items = await listProfessorQuestions(lectureId, true)
        if (
          active &&
          !mutationPending.current &&
          version === mutationVersion.current
        ) {
          setQuestions(items)
          setApiError('')
        }
      } catch (error) {
        if (active)
          setApiError(
            error instanceof Error
              ? error.message
              : 'Could not load questions.',
          )
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [lectureId])

  useEffect(() => {
    if (page !== 'pastLectures' && page !== 'profile') return
    let active = true
    const load = async () => {
      try {
        if (page === 'pastLectures') {
          const items = await listArchive()
          if (active) {
            setArchive(items)
            setApiError('')
          }
        } else {
          const counts = await getSummary()
          if (active) {
            setSummary(counts)
            setApiError('')
          }
        }
      } catch (error) {
        if (active)
          setApiError(
            error instanceof Error
              ? error.message
              : 'Could not load saved lecture data.',
          )
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [page])

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
    window.history.pushState(
      null,
      '',
      `${professorRoutes[nextPage]}${window.location.search}`,
    )
    setPage(nextPage)
    window.scrollTo(0, 0)
    window.requestAnimationFrame(() => mainHeadingRef.current?.focus())
  }

  async function runMutation(
    id: string,
    work: () => Promise<void>,
    message: string,
  ) {
    if (mutationPending.current) return false
    mutationPending.current = true
    mutationVersion.current++
    setBusyId(id)
    setApiError('')
    try {
      await work()
      setNotice(message)
      return true
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Could not save this change.',
      )
      return false
    } finally {
      mutationPending.current = false
      mutationVersion.current++
      setBusyId(null)
    }
  }

  async function updateSession(
    action: 'start' | 'pause' | 'resume' | 'end',
    message: string,
  ) {
    if (!lectureId) {
      setNotice('Create or choose a lecture first.')
      return false
    }
    return runMutation(
      'session',
      async () => {
        const updated = await changeLectureSession(lectureId, action)
        setLectures((items) =>
          items.map((lecture) =>
            lecture.id === updated.id ? updated : lecture,
          ),
        )
      },
      message,
    )
  }

  async function startLecture() {
    await updateSession(
      'start',
      'Lecture started. Students can now submit questions.',
    )
  }

  async function toggleQuestionIntake() {
    await updateSession(
      questionsPaused ? 'resume' : 'pause',
      questionsPaused
        ? 'Pool open. Let the questions roll in!'
        : 'Pool paused. A little thinking time never hurt.',
    )
  }

  async function closeEndConfirmation(confirmed: boolean) {
    setEndConfirmationOpen(false)
    if (
      confirmed &&
      (await updateSession(
        'end',
        'Lecture ended. Its questions and answers are saved.',
      ))
    ) {
      setExpandedIds(new Set())
      navigateTo('pastLectures')
    } else {
      window.requestAnimationFrame(() => endTriggerRef.current?.focus())
    }
  }

  async function changeStatus(question: Question) {
    await runMutation(
      question.id,
      async () => {
        const updated = await changeQuestionStatus(
          question.id,
          question.answered ? 'open' : 'answered',
        )
        setQuestions((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        )
        setAnswerDrafts((items) => {
          const next = { ...items }
          delete next[question.id]
          return next
        })
      },
      question.answered
        ? 'Question marked unanswered.'
        : 'Question marked answered.',
    )
    window.requestAnimationFrame(() => tabRefs[selectedTab].current?.focus())
  }

  async function saveAnswer(question: Question) {
    await runMutation(
      question.id,
      async () => {
        const updated = await changeQuestionStatus(
          question.id,
          'answered',
          answerDrafts[question.id] ?? question.answer ?? '',
        )
        setQuestions((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        )
      },
      'Written answer saved.',
    )
  }

  async function selectQuestion(question: Question) {
    await runMutation(
      question.id,
      async () => {
        const updated = await changeQuestionStatus(
          question.id,
          question.status === 'selected' ? 'open' : 'selected',
        )
        setQuestions((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        )
      },
      question.status === 'selected'
        ? 'Question unselected.'
        : 'Question selected for answering.',
    )
  }

  async function restoreQuestion(question: Question) {
    await runMutation(
      question.id,
      async () => {
        const updated = await restoreSavedQuestion(question.id)
        setQuestions((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        )
      },
      `Question restored to ${question.answered ? 'Answered' : 'Open'}.`,
    )
    window.requestAnimationFrame(() => trashTabRef.current?.focus())
  }

  async function closeDialog(confirmed: boolean) {
    const target = deleteTarget
    setDeleteTarget(null)
    if (confirmed && target) {
      const permanent = target.kind === 'allTrash' || trashedIds.has(target.id)
      await runMutation(
        target.kind === 'allTrash' ? 'trash' : target.id,
        async () => {
          if (target.kind === 'allTrash') {
            await emptyTrash(lectureId)
            setQuestions(await listProfessorQuestions(lectureId, true))
          } else if (permanent) {
            await permanentlyDeleteQuestion(target.id)
            setQuestions((items) =>
              items.filter((item) => item.id !== target.id),
            )
          } else {
            await deleteQuestion(target.id)
            setQuestions(await listProfessorQuestions(lectureId, true))
          }
        },
        permanent
          ? 'Deleted questions permanently removed.'
          : 'Question moved to Deleted.',
      )
    }
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
        <div className="mx-auto max-w-[848px] px-5 sm:px-6">
          <LecturePicker
            lectures={lectures}
            lectureId={lectureId}
            disabled={busyId !== null}
            onSelect={(id) => {
              setLectureId(id)
              setQuestions([])
              setExpandedIds(new Set())
              setAnswerDrafts({})
            }}
            onCreated={(lecture) => {
              setLectures((items) => [lecture, ...items])
              setLectureId(lecture.id)
              setQuestions([])
              setExpandedIds(new Set())
              setAnswerDrafts({})
            }}
          />
        </div>
      )}
      {apiError && (
        <p role="alert" className="mx-auto max-w-[848px] px-5 text-red-700">
          {apiError}
        </p>
      )}

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
              disabled={
                !selectedLecture || !!selectedLecture.endedAt || busyId !== null
              }
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
        <main className="professor-page-enter mx-auto max-w-[848px] px-5 pb-20 pt-8 sm:px-6 sm:pt-10">
          <div className="min-[720px]:flex min-[720px]:items-center min-[720px]:justify-between min-[720px]:gap-6">
            <div className="min-w-0">
              <h1
                ref={mainHeadingRef}
                tabIndex={-1}
                className="text-[28px] leading-tight font-semibold tracking-tight outline-none sm:text-[30px]"
              >
                Lecture questions
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-sm text-slate-500">
                  Started{' '}
                  <time dateTime={lectureStartedAt}>
                    {timestampFormatter.format(new Date(lectureStartedAt))}
                  </time>
                </p>
                <span className="group relative inline-flex">
                  <span
                    tabIndex={0}
                    aria-describedby="pool-status-description"
                    className={`inline-flex cursor-help items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${questionsPaused ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}
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
                    className="pointer-events-none invisible absolute right-0 top-full z-30 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-lg bg-slate-900 px-3 py-2 text-xs leading-5 font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  >
                    {questionsPaused
                      ? 'Students cannot submit new questions until you resume the pool.'
                      : 'Students can submit new questions to this lecture.'}
                  </span>
                </span>
              </div>
            </div>
            <div
              role="group"
              aria-label="Session controls"
              className="mt-5 flex flex-wrap gap-2 min-[720px]:mt-0 min-[720px]:shrink-0"
            >
              <span className="group relative inline-flex">
                <button
                  type="button"
                  aria-pressed={questionsPaused}
                  aria-describedby="question-intake-action-description"
                  onClick={toggleQuestionIntake}
                  disabled={busyId !== null}
                  className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {questionsPaused ? 'Resume questions' : 'Pause questions'}
                </button>
                <span
                  id="question-intake-action-description"
                  role="tooltip"
                  className="pointer-events-none invisible absolute left-0 top-full z-30 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-lg bg-slate-900 px-3 py-2 text-xs leading-5 font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 min-[720px]:left-auto min-[720px]:right-0"
                >
                  {questionsPaused
                    ? 'Allow students to submit new questions again.'
                    : 'Pause new question submissions. Existing questions stay visible.'}
                </span>
              </span>
              <button
                ref={endTriggerRef}
                type="button"
                onClick={() => setEndConfirmationOpen(true)}
                disabled={busyId !== null}
                className="min-h-11 rounded-lg border border-rose-200 bg-rose-100 px-3.5 py-2 text-sm font-semibold text-rose-800 transition-colors hover:border-rose-300 hover:bg-rose-200 hover:text-rose-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
              >
                End lecture
              </button>
            </div>
          </div>
          <div className="professor-question-toolbar mt-8 min-[720px]:mt-6">
            <div className="professor-question-toolbar__layout">
              <div
                role="tablist"
                aria-label="Question sections"
                className="professor-question-tabs flex min-w-0 flex-wrap gap-x-3 sm:gap-x-5"
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
                      if (
                        event.key !== 'ArrowLeft' &&
                        event.key !== 'ArrowRight'
                      )
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
              <details
                ref={sortMenuRef}
                className="professor-question-sort relative w-full max-w-[204px]"
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
                <summary className="relative flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-lg border border-slate-200 bg-white py-2 pr-8 pl-3 text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
                  <span className="text-xs text-slate-500">Sort:</span>
                  <span className="text-sm font-medium">
                    {sortMode === 'votes' ? 'Most votes' : 'Newest first'}
                  </span>
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-500"
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
                  className="absolute right-0 left-0 z-30 mt-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
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
                        if (sortMenuRef.current)
                          sortMenuRef.current.open = false
                        sortMenuRef.current?.querySelector('summary')?.focus()
                      }}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${sortMode === mode ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      <span>{label}</span>
                      {sortMode === mode && (
                        <span aria-hidden="true" className="text-blue-700">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </div>

          {selectedTab === 'trash' && (
            <div className="mt-4">
              <button
                type="button"
                disabled={trashQuestions.length === 0 || busyId !== null}
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
            </div>
          )}

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
                          <p>
                            Submitted:{' '}
                            <time dateTime={question.createdAt}>
                              {timestampFormatter.format(
                                new Date(question.createdAt),
                              )}
                            </time>
                          </p>
                          <p>Reports: {question.reportCount}</p>
                          {selectedTab !== 'trash' && (
                            <div className="mt-3 space-y-2">
                              <label
                                className="block text-sm font-medium"
                                htmlFor={`answer-${question.id}`}
                              >
                                Written answer (optional)
                              </label>
                              <textarea
                                id={`answer-${question.id}`}
                                className="w-full rounded-lg border border-slate-300 bg-white p-3"
                                rows={3}
                                maxLength={4000}
                                value={
                                  answerDrafts[question.id] ??
                                  question.answer ??
                                  ''
                                }
                                onChange={(event) =>
                                  setAnswerDrafts((items) => ({
                                    ...items,
                                    [question.id]: event.target.value,
                                  }))
                                }
                                disabled={busyId !== null}
                              />
                              <button
                                type="button"
                                className="rounded-lg bg-blue-700 px-3 py-2 text-white"
                                disabled={busyId !== null}
                                onClick={() => void saveAnswer(question)}
                              >
                                Save answer and mark answered
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                        {selectedTab === 'open' && (
                          <button
                            type="button"
                            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700"
                            disabled={busyId !== null}
                            onClick={() => void selectQuestion(question)}
                          >
                            {question.status === 'selected'
                              ? 'Unselect question'
                              : 'Select to answer'}
                          </button>
                        )}
                        {selectedTab === 'trash' ? (
                          <button
                            type="button"
                            onClick={() => restoreQuestion(question)}
                            disabled={busyId !== null}
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
                            disabled={busyId !== null}
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
                          disabled={busyId !== null}
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
            Browse saved questions and answers from ended lectures.
          </p>
          <div className="mt-8 space-y-4">
            {archive.map(({ lecture, questions }, index) => (
              <details
                key={lecture.id}
                open={index === 0}
                className="rounded-xl border border-slate-200 bg-slate-50"
              >
                <summary className="cursor-pointer px-5 py-5 marker:text-blue-600 hover:bg-slate-100 focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600 sm:px-6">
                  <span className="block pl-4 text-xs font-semibold text-blue-700">
                    Course · {lecture.course || 'Not specified'}
                  </span>
                  <span className="mt-1 block pl-4 font-semibold text-slate-900">
                    {lecture.title}
                  </span>
                  <span className="mt-2 block pl-4 text-xs text-slate-600">
                    Time slot ·{' '}
                    <time dateTime={lecture.startedAt || lecture.lectureTime}>
                      {lectureDateFormatter.format(
                        new Date(lecture.startedAt || lecture.lectureTime),
                      )}
                    </time>{' '}
                    ·{' '}
                    {timestampFormatter.format(
                      new Date(lecture.startedAt || lecture.lectureTime),
                    )}
                    –
                    {lecture.endedAt
                      ? timestampFormatter.format(new Date(lecture.endedAt))
                      : ''}
                  </span>
                  <span className="mt-1 block pl-4 text-xs text-slate-500">
                    {questions.length} questions ·{' '}
                    {questions.filter((question) => question.answered).length}{' '}
                    answered
                  </span>
                </summary>
                <div className="space-y-3 border-t border-slate-200 px-5 py-5 sm:px-6">
                  {questions.map((question) => (
                    <article
                      key={question.id}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <h2 className="text-sm font-semibold leading-6 text-slate-900">
                        {question.text}
                      </h2>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-blue-700">
                        {question.answered ? 'Answer' : 'Unanswered'}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {question.answer ||
                          (question.answered
                            ? 'Answered during the lecture; no written answer was saved.'
                            : 'Awaiting an answer.')}
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
              {user.name}
            </p>
          </section>
          <QuestionStatusSummary
            lectureCount={summary.lectureCount}
            unansweredCount={summary.unansweredCount}
            answeredCount={summary.answeredCount}
          />
          <p className="mt-3 text-xs text-slate-500">
            Counts cover your saved lecture pools and exclude deleted questions.
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

      {import.meta.env.DEV && page === 'settings' && onResetOnboarding && (
        <div className="fixed bottom-4 right-4 z-10 max-w-[calc(100%-2rem)] text-right">
          <button
            type="button"
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm hover:border-slate-400 hover:text-slate-900"
            onClick={() => {
              if (!onResetOnboarding())
                setResetError(
                  'Could not reset the saved courses in this browser. Try again.',
                )
            }}
          >
            Reset onboarding (dev)
          </button>
          <p className="mt-1 text-xs text-slate-500">
            Clears saved courses and starts again.
          </p>
          {resetError && (
            <p role="alert" className="mt-2 max-w-xs text-xs text-red-700">
              {resetError}
            </p>
          )}
        </div>
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
            New submissions will close. Questions and answers will remain
            available in Past Lectures.
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
