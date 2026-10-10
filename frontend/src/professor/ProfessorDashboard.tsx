import { useEffect, useRef, useState } from 'react'
import { mockPastLectures } from './mockPastLectures'
import type { Question } from './mockQuestions'
import { mockQuestions } from './mockQuestions'
import type { CurrentUser } from '../lib/api'
import { ThumbsUpIcon } from '../components/Icons'
import JoinQrCode from '../components/JoinQrCode'
import SidePanel, { type SidePanelPage } from '../components/SidePanel'
import {
  createSession,
  endSession,
  getActiveSession,
  joinUrl,
} from '../lib/sessions'
import {
  readQuestionIntakePaused,
  saveQuestionIntakePaused,
  subscribeQuestionIntakePaused,
} from '../lib/questionIntake'
import {
  clearLectureSession,
  readLectureSession,
  saveLectureSession,
} from './lectureSession'
import type { LectureSession } from './lectureSession'
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
const courseSelectionRoute = '/professor/start'
const sessionShareRoute = '/professor/session'

const professorFullName = 'Alex Morgan'
const archivedAnsweredCount = mockPastLectures.reduce(
  (total, lecture) => total + lecture.questions.length,
  0,
)
const courseOptions = [
  ...new Set(mockPastLectures.map((lecture) => lecture.course)),
]
const otherCourseOption = '__other__'

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

function CourseChooser({
  submitLabel,
  busy = false,
  error = '',
  currentCourse,
  onChoose,
  onCancel,
}: {
  submitLabel: string
  busy?: boolean
  error?: string
  currentCourse?: string | null
  onChoose: (course: string) => void
  onCancel: () => void
}) {
  const [selectedCourse, setSelectedCourse] = useState(() =>
    currentCourse
      ? courseOptions.includes(currentCourse)
        ? currentCourse
        : otherCourseOption
      : '',
  )
  const [otherCourse, setOtherCourse] = useState(() =>
    currentCourse && !courseOptions.includes(currentCourse)
      ? currentCourse
      : '',
  )
  const course =
    selectedCourse === otherCourseOption ? otherCourse.trim() : selectedCourse

  return (
    <form
      className="mt-6 text-left"
      onSubmit={(event) => {
        event.preventDefault()
        if (course && !busy) onChoose(course)
      }}
    >
      <label
        htmlFor="lecture-course"
        className="block text-sm font-semibold text-slate-800"
      >
        Course
      </label>
      <p
        id="lecture-course-help"
        className="mt-1 text-xs leading-5 text-slate-500"
      >
        Choose a demo course or enter a different course name.
      </p>
      <select
        id="lecture-course"
        aria-describedby="lecture-course-help"
        autoFocus
        required
        disabled={busy}
        value={selectedCourse}
        onChange={(event) => setSelectedCourse(event.target.value)}
        className="mt-3 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <option value="">Select a course</option>
        {courseOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={otherCourseOption}>Another course…</option>
      </select>
      {selectedCourse === otherCourseOption && (
        <div className="mt-4">
          <label
            htmlFor="other-course"
            className="block text-sm font-semibold text-slate-800"
          >
            Course name
          </label>
          <input
            id="other-course"
            type="text"
            autoFocus
            required
            disabled={busy}
            maxLength={80}
            value={otherCourse}
            onChange={(event) => setOtherCourse(event.target.value)}
            placeholder="e.g. Linear Algebra"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!course || busy}
          className="min-h-11 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {busy ? 'Please wait…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default function ProfessorDashboard({ user }: { user: CurrentUser }) {
  const [lectureSession, setLectureSession] = useState<LectureSession | null>(
    () => readLectureSession(user.id),
  )
  const [courseSelectionPage, setCourseSelectionPage] = useState(
    () =>
      lectureSession === null &&
      window.location.pathname.replace(/\/$/, '') === courseSelectionRoute,
  )
  const [sessionSharePage, setSessionSharePage] = useState(
    () => window.location.pathname.replace(/\/$/, '') === sessionShareRoute,
  )
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [courseChooserOpen, setCourseChooserOpen] = useState(false)
  const [questionsPaused, setQuestionsPaused] = useState(
    readQuestionIntakePaused,
  )
  const [questions, setQuestions] = useState<Question[]>(() => [
    ...mockQuestions,
  ])
  const [trashedIds, setTrashedIds] = useState<Set<string>>(() => new Set())
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
  const joinCodeTriggerRef = useRef<HTMLButtonElement>(null)
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
    let active = true
    getActiveSession()
      .then((shared) => {
        if (!active) return
        if (shared) {
          const session: LectureSession = shared
          setLectureSession(session)
          saveLectureSession(user.id, session)
          if (
            window.location.pathname.replace(/\/$/, '') === courseSelectionRoute
          ) {
            window.history.replaceState(null, '', sessionShareRoute)
            setCourseSelectionPage(false)
            setSessionSharePage(true)
          }
        } else {
          const cached = readLectureSession(user.id)
          if (cached?.code) {
            clearLectureSession(user.id)
            setLectureSession(null)
            if (
              window.location.pathname.replace(/\/$/, '') === sessionShareRoute
            ) {
              window.history.replaceState(null, '', professorRoutes.questions)
              setSessionSharePage(false)
            }
          }
        }
      })
      .catch(() => {
        if (active)
          setSessionError('Could not check active lectures. Please retry.')
      })
      .finally(() => {
        if (active) setSessionLoading(false)
      })
    return () => {
      active = false
    }
  }, [user.id])

  useEffect(() => {
    if (
      !sessionLoading &&
      lectureSession &&
      window.location.pathname.replace(/\/$/, '') === courseSelectionRoute
    ) {
      window.history.replaceState(
        null,
        '',
        lectureSession.code ? sessionShareRoute : professorRoutes.questions,
      )
    }
    const handleLocationChange = () => {
      setPage(pageFromPath(window.location.pathname))
      const onCourseSelectionPage =
        window.location.pathname.replace(/\/$/, '') === courseSelectionRoute
      const onSessionSharePage =
        window.location.pathname.replace(/\/$/, '') === sessionShareRoute
      if (onCourseSelectionPage && lectureSession) {
        window.history.replaceState(
          null,
          '',
          lectureSession.code ? sessionShareRoute : professorRoutes.questions,
        )
      }
      setSessionSharePage(
        onSessionSharePage ||
          (onCourseSelectionPage && Boolean(lectureSession?.code)),
      )
      setCourseSelectionPage(onCourseSelectionPage && lectureSession === null)
    }
    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [lectureSession, sessionLoading])

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
    if (nextPage === page && !courseSelectionPage && !sessionSharePage) return
    window.history.pushState(null, '', professorRoutes[nextPage])
    setPage(nextPage)
    setCourseSelectionPage(false)
    setSessionSharePage(false)
    window.scrollTo(0, 0)
    window.requestAnimationFrame(() => mainHeadingRef.current?.focus())
  }

  function openCourseSelectionPage() {
    window.history.pushState(null, '', courseSelectionRoute)
    setCourseSelectionPage(true)
    setSessionSharePage(false)
    setSessionError('')
    window.scrollTo(0, 0)
    window.requestAnimationFrame(() => mainHeadingRef.current?.focus())
  }

  function leaveCourseSelectionPage() {
    window.history.replaceState(null, '', professorRoutes.questions)
    setCourseSelectionPage(false)
    setSessionError('')
    window.scrollTo(0, 0)
    window.requestAnimationFrame(() => mainHeadingRef.current?.focus())
  }

  function showSessionSharePage() {
    window.history.pushState(null, '', sessionShareRoute)
    setSessionSharePage(true)
    setCourseSelectionPage(false)
    window.scrollTo(0, 0)
    window.requestAnimationFrame(() => mainHeadingRef.current?.focus())
  }

  function showLectureQuestions() {
    window.history.pushState(null, '', professorRoutes.questions)
    setSessionSharePage(false)
    window.scrollTo(0, 0)
    window.requestAnimationFrame(() => mainHeadingRef.current?.focus())
  }

  async function copyJoinDetail(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setNotice(`${label} copied.`)
    } catch {
      setNotice('Could not copy automatically. Select the text and copy it.')
    }
  }

  async function chooseCourse(course: string) {
    if (lectureSession?.code) return
    setSessionBusy(true)
    setSessionError('')
    try {
      const shared = await createSession(course)
      const nextSession: LectureSession = shared
      setLectureSession(nextSession)
      setCourseChooserOpen(false)
      window.history.replaceState(null, '', sessionShareRoute)
      setCourseSelectionPage(false)
      setSessionSharePage(true)
      setQuestionsPaused(false)
      saveQuestionIntakePaused(false)
      window.scrollTo(0, 0)
      window.requestAnimationFrame(() => mainHeadingRef.current?.focus())
      if (!saveLectureSession(user.id, nextSession)) {
        setNotice(
          'The lecture is running, but this browser could not cache it.',
        )
      }
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : 'Could not save this lecture.',
      )
    } finally {
      setSessionBusy(false)
    }
  }

  function closeCourseChooser() {
    setCourseChooserOpen(false)
    window.requestAnimationFrame(() => joinCodeTriggerRef.current?.focus())
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

  async function closeEndConfirmation(confirmed: boolean) {
    setEndConfirmationOpen(false)
    if (confirmed) {
      if (lectureSession?.code) {
        setSessionBusy(true)
        try {
          await endSession()
        } catch (error) {
          setNotice(
            error instanceof Error
              ? error.message
              : 'Could not end this lecture.',
          )
          setSessionBusy(false)
          window.requestAnimationFrame(() => endTriggerRef.current?.focus())
          return
        }
        setSessionBusy(false)
      }
      const cleared = clearLectureSession(user.id)
      const intakeReset = saveQuestionIntakePaused(false)
      setLectureSession(null)
      setCourseSelectionPage(false)
      setSessionSharePage(false)
      setCourseChooserOpen(false)
      setQuestionsPaused(false)
      setQuestions([...mockQuestions])
      setTrashedIds(new Set())
      setSelectedTab('open')
      setSortMode('votes')
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
        <div className="flex h-20 items-center px-6">
          <SidePanel
            user={user}
            role="professor"
            page={page}
            onNavigate={navigateTo}
          />
        </div>
      </header>

      {page === 'questions' && sessionLoading && (
        <main
          className="grid min-h-[calc(100dvh-5rem)] place-items-center bg-[#f7f8fc] px-5 text-sm text-slate-600"
          role="status"
        >
          Checking your lecture session…
        </main>
      )}

      {page === 'questions' &&
        !sessionLoading &&
        lectureSession === null &&
        !courseSelectionPage && (
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
                onClick={openCourseSelectionPage}
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
              {sessionError && (
                <p
                  role="alert"
                  className="mx-auto mt-5 max-w-md text-sm text-red-700"
                >
                  {sessionError}
                </p>
              )}
            </section>
          </main>
        )}

      {page === 'questions' &&
        !sessionLoading &&
        lectureSession === null &&
        courseSelectionPage && (
          <main className="professor-page-enter min-h-[calc(100dvh-5rem)] bg-[#f7f8fc] px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
            <div className="mx-auto max-w-[640px]">
              <button
                type="button"
                onClick={leaveCourseSelectionPage}
                disabled={sessionBusy}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <span aria-hidden="true">←</span>
                go back
              </button>
              <p className="mt-10 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                New lecture session
              </p>
              <h1
                ref={mainHeadingRef}
                tabIndex={-1}
                className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 outline-none sm:text-4xl"
              >
                Choose a course
              </h1>
              <p className="mt-3 max-w-lg text-base leading-7 text-slate-600">
                Choose which course this session belongs to. The question pool
                opens after you start the session.
              </p>
              <section
                aria-label="Course for new session"
                className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-8"
              >
                <CourseChooser
                  submitLabel="Start session"
                  busy={sessionBusy}
                  error={sessionError}
                  onChoose={chooseCourse}
                  onCancel={leaveCourseSelectionPage}
                />
              </section>
            </div>
          </main>
        )}

      {page === 'questions' &&
        !sessionLoading &&
        lectureSession?.code &&
        sessionSharePage && (
          <main className="professor-page-enter min-h-[calc(100dvh-5rem)] bg-[#f7f8fc] px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
            <div className="mx-auto max-w-[760px]">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                Session ready
              </p>
              <h1
                ref={mainHeadingRef}
                tabIndex={-1}
                className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 outline-none sm:text-4xl"
              >
                Invite students to {lectureSession.course}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Students can scan the QR code or enter the code after choosing
                Student on the home page.
              </p>
              <section className="mt-8 grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:grid-cols-[256px_1fr] sm:items-center sm:p-8">
                <div className="mx-auto w-full max-w-64 rounded-xl border border-slate-200 bg-white p-3">
                  <JoinQrCode url={joinUrl(lectureSession.code)} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Join code
                  </p>
                  <code className="mt-2 block text-3xl font-bold tracking-[0.12em] text-slate-900 sm:text-4xl">
                    {lectureSession.code}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      void copyJoinDetail(lectureSession.code!, 'Code')
                    }
                    className="mt-4 min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Copy code
                  </button>
                  <p className="mt-7 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Join link
                  </p>
                  <p className="mt-2 break-all text-sm text-slate-700">
                    {joinUrl(lectureSession.code)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      void copyJoinDetail(joinUrl(lectureSession.code!), 'Link')
                    }
                    className="mt-3 min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Copy link
                  </button>
                </div>
              </section>
              {sessionError && (
                <p role="alert" className="mt-4 text-sm text-red-700">
                  {sessionError}
                </p>
              )}
              {(window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1') && (
                <p className="mt-4 text-sm text-amber-800">
                  This local address only works on this computer. For students
                  on other devices, open AskPool at a shared network or public
                  address before showing the QR code.
                </p>
              )}
              <button
                type="button"
                onClick={showLectureQuestions}
                className="mt-8 min-h-12 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                Go to questions →
              </button>
            </div>
          </main>
        )}

      {page === 'questions' &&
        !sessionLoading &&
        lectureSession !== null &&
        (!sessionSharePage || !lectureSession.code) && (
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${lectureSession.course ? 'bg-blue-50 text-blue-800' : 'bg-amber-100 text-amber-900'}`}
                  >
                    {lectureSession.course ?? 'Course not set'}
                  </span>
                  <button
                    ref={joinCodeTriggerRef}
                    type="button"
                    aria-expanded={!lectureSession.code ? courseChooserOpen : undefined}
                    aria-controls={!lectureSession.code ? 'active-course-chooser' : undefined}
                    onClick={
                      lectureSession.code
                        ? showSessionSharePage
                        : () => setCourseChooserOpen(true)
                    }
                    className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    {lectureSession.code
                      ? 'Show join code'
                      : 'Create join code'}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-sm text-slate-500">
                    Started{' '}
                    <time dateTime={lectureSession.startedAt}>
                      {timestampFormatter.format(
                        new Date(lectureSession.startedAt),
                      )}
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
                <button
                  type="button"
                  aria-pressed={questionsPaused}
                  onClick={toggleQuestionIntake}
                  className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {questionsPaused ? 'Resume questions' : 'Pause questions'}
                </button>
                <button
                  ref={endTriggerRef}
                  type="button"
                  onClick={() => setEndConfirmationOpen(true)}
                  disabled={sessionBusy}
                  className="min-h-11 rounded-lg border border-rose-200 bg-rose-100 px-3.5 py-2 text-sm font-semibold text-rose-800 transition-colors hover:border-rose-300 hover:bg-rose-200 hover:text-rose-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
                >
                  End lecture
                </button>
              </div>
            </div>
            {courseChooserOpen && !lectureSession.code && (
              <section
                id="active-course-chooser"
                aria-label="Choose lecture course"
                className="mt-6 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-5"
              >
                <h2 className="text-base font-semibold text-slate-900">
                  Lecture course
                </h2>
                <CourseChooser
                  currentCourse={lectureSession.course}
                  submitLabel="Create join code"
                  busy={sessionBusy}
                  error={sessionError}
                  onChoose={chooseCourse}
                  onCancel={closeCourseChooser}
                />
              </section>
            )}
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
                            Top voted <span aria-hidden="true">·</span> #
                            {topRank}
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
                              Restore to{' '}
                              {question.answered ? 'Answered' : 'Open'}
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
