import { useEffect, useRef, useState } from 'react'
import {
  changeQuestionStatus,
  deleteQuestion,
  clearOpenQuestions,
  getSummary,
  listArchive,
  listProfessorQuestions,
  startCourseSession,
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
import type { CurrentUser } from '../lib/api'
import type { ProfessorCourse } from './professorProfile'
import CourseChooser from './CourseChooser'
import CourseSettings from './CourseSettings'
import {
  filterOpenQuestions,
  sortQuestions,
  timeFilters,
  type TimeFilter,
} from './questionView'
import { ThumbsUpIcon } from '../components/Icons'
import JoinQrCode from '../components/JoinQrCode'
import { getSessionInvite, joinUrl, type SharedSession } from '../lib/sessions'
import SidePanel, { type SidePanelPage } from '../components/SidePanel'
import './professor.css'

const questionTabs = ['open', 'answered'] as const
type Tab = (typeof questionTabs)[number]
type DeleteTarget =
  | { kind: 'question'; id: string; text: string }
  | { kind: 'allOpen'; lectureId: string; title: string; ids: string[] }
type ProfessorPage = SidePanelPage

const professorRoutes: Record<ProfessorPage, string> = {
  questions: '/professor',
  pastLectures: '/professor/past-lectures',
  profile: '/professor/profile',
  settings: '/professor/settings',
}
const courseSelectionRoute = '/professor/start'
const sessionShareRoute = '/professor/session'

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
function lectureTimeRange(lecture: Lecture) {
  const start = new Date(lecture.startedAt || lecture.lectureTime)
  if (!lecture.endedAt) return timestampFormatter.format(start)
  const end = new Date(lecture.endedAt)
  return timestampFormatter.formatRange(start, end)
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
  courses,
  onSaveCourses,
}: {
  user: CurrentUser
  courses: ProfessorCourse[]
  onSaveCourses: (courses: ProfessorCourse[]) => Promise<void>
}) {
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
  const [mutationError, setMutationError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const selectedLecture = lectures.find((lecture) => lecture.id === lectureId)
  const lectureStartedAt =
    selectedLecture?.startedAt && !selectedLecture.endedAt
      ? selectedLecture.startedAt
      : null
  const questionsPaused = selectedLecture?.questionsPaused ?? false
  const mutationPending = useRef(false)
  const mutationVersion = useRef(0)
  const [selectedTab, setSelectedTab] = useState<Tab>('open')
  const [page, setPage] = useState<ProfessorPage>(() =>
    pageFromPath(window.location.pathname),
  )
  const [courseSelectionPage, setCourseSelectionPage] = useState(
    () => window.location.pathname === courseSelectionRoute,
  )
  const [sessionSharePage, setSessionSharePage] = useState(
    () => window.location.pathname === sessionShareRoute,
  )
  const [invite, setInvite] = useState<SharedSession | null>(null)
  const [sessionError, setSessionError] = useState('')
  const [filter, setFilter] = useState<{
    lectureId: string
    minutes: TimeFilter
  }>({ lectureId: '', minutes: 0 })
  const timeFilter = filter.lectureId === lectureId ? filter.minutes : 0
  const [now, setNow] = useState(Date.now)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [endConfirmationOpen, setEndConfirmationOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogOpen = deleteTarget !== null
  const endDialogRef = useRef<HTMLDialogElement>(null)
  const endTriggerRef = useRef<HTMLButtonElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)
  const openTabRef = useRef<HTMLButtonElement>(null)
  const answeredTabRef = useRef<HTMLButtonElement>(null)
  const mainHeadingRef = useRef<HTMLHeadingElement>(null)
  const tabRefs = {
    open: openTabRef,
    answered: answeredTabRef,
  }

  const openQuestionPool = questions.filter((q) => !q.answered)
  const openQuestions = filterOpenQuestions(questions, timeFilter, now)
  const answeredQuestions = sortQuestions(questions.filter((q) => q.answered))
  const topVotedRanks = new Map(
    openQuestions.slice(0, 3).map((q, index) => [q.id, index + 1]),
  )
  const visibleQuestions =
    selectedTab === 'open' ? openQuestions : answeredQuestions
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleLocationChange = () => {
      setPage(pageFromPath(window.location.pathname))
      setCourseSelectionPage(window.location.pathname === courseSelectionRoute)
      setSessionSharePage(window.location.pathname === sessionShareRoute)
    }
    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  useEffect(() => {
    if (!sessionSharePage || !lectureId || !lectureStartedAt) return
    let active = true
    getSessionInvite(lectureId)
      .then((session) => {
        if (active) {
          setInvite(session)
          setSessionError('')
        }
      })
      .catch((error: unknown) => {
        if (active)
          setSessionError(
            error instanceof Error
              ? error.message
              : 'Could not load the join code.',
          )
      })
    return () => {
      active = false
    }
  }, [sessionSharePage, lectureId, lectureStartedAt])

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
              (managed.some((lecture) => lecture.id === id) ? id : '') ||
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
    if (!lectureId || !selectedLecture?.canManage) return
    rememberLecture(lectureId)
    let active = true
    const load = async () => {
      const version = mutationVersion.current
      try {
        const items = await listProfessorQuestions(lectureId)
        if (
          active &&
          !mutationPending.current &&
          version === mutationVersion.current
        ) {
          setQuestions(items)
          setDeleteTarget((target) =>
            target?.kind === 'allOpen' && target.lectureId === lectureId
              ? {
                  ...target,
                  ids: items.filter((q) => !q.answered).map((q) => q.id),
                }
              : target,
          )
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
  }, [lectureId, selectedLecture?.canManage])

  useEffect(() => {
    if (page !== 'pastLectures' && page !== 'profile') return
    let active = true
    const load = async () => {
      try {
        if (page === 'pastLectures') {
          const items = await listArchive()
          if (active) {
            setArchive(items.filter((item) => item.lecture.canManage))
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
    if (!deleteDialogOpen) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [deleteDialogOpen])

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
    if (
      nextPage === page &&
      window.location.pathname === professorRoutes[nextPage]
    )
      return
    window.history.pushState(
      null,
      '',
      `${professorRoutes[nextPage]}${window.location.search}`,
    )
    setPage(nextPage)
    setCourseSelectionPage(false)
    setSessionSharePage(false)
    window.scrollTo(0, 0)
    window.requestAnimationFrame(() => mainHeadingRef.current?.focus())
  }

  function openCourseSelectionPage() {
    setSessionError('')
    window.history.pushState(null, '', courseSelectionRoute)
    setCourseSelectionPage(true)
    setSessionSharePage(false)
    window.scrollTo(0, 0)
  }

  function openSessionSharePage() {
    setInvite(null)
    setSessionError('')
    window.history.pushState(null, '', sessionShareRoute)
    setCourseSelectionPage(false)
    setSessionSharePage(true)
    window.scrollTo(0, 0)
  }

  function goToQuestions() {
    setSessionError('')
    window.history.pushState(null, '', professorRoutes.questions)
    setCourseSelectionPage(false)
    setSessionSharePage(false)
    window.scrollTo(0, 0)
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
    setMutationError('')
    try {
      await work()
      setNotice(message)
      return true
    } catch (error) {
      setMutationError(
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

  async function chooseCourse(course: ProfessorCourse) {
    if (mutationPending.current) return
    mutationPending.current = true
    mutationVersion.current++
    setBusyId('session')
    setSessionError('')
    try {
      const started = await startCourseSession(course)
      setLectures((items) => [started, ...items])
      setLectureId(started.id)
      setQuestions([])
      setExpandedIds(new Set())
      setFilter({ lectureId: started.id, minutes: 0 })
      setSelectedTab('open')
      openSessionSharePage()
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : 'Could not start this lecture.',
      )
    } finally {
      mutationPending.current = false
      mutationVersion.current++
      setBusyId(null)
    }
  }

  async function copyJoinDetail(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setNotice(`${label} copied.`)
    } catch {
      setNotice('Could not copy automatically. Select the text and copy it.')
    }
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
        'Lecture ended. Its questions and statuses are saved.',
      ))
    ) {
      setInvite(null)
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
      },
      question.answered
        ? 'Question marked unanswered.'
        : 'Question marked answered.',
    )
    window.requestAnimationFrame(() => tabRefs[selectedTab].current?.focus())
  }

  async function prepareClear(trigger: HTMLButtonElement) {
    setMutationError('')
    deleteTriggerRef.current = trigger
    await runMutation(
      'clear-preview',
      async () => {
        const latest = await listProfessorQuestions(lectureId)
        setQuestions(latest)
        const ids = latest.filter((q) => !q.answered).map((q) => q.id)
        if (ids.length)
          setDeleteTarget({
            kind: 'allOpen',
            lectureId,
            title: selectedLecture?.title || 'this lecture',
            ids,
          })
      },
      '',
    )
  }

  async function closeDialog(confirmed: boolean) {
    if (mutationPending.current) return
    const target = deleteTarget
    if (confirmed && target) {
      const succeeded = await runMutation(
        target.kind === 'allOpen' ? 'clear' : target.id,
        async () => {
          if (target.kind === 'allOpen') {
            const result = await clearOpenQuestions(
              target.lectureId,
              target.ids,
            )
            const deleted = new Set(result.deletedIds)
            setQuestions((items) => items.filter((q) => !deleted.has(q.id)))
          } else {
            await deleteQuestion(target.id)
            setQuestions((items) => items.filter((q) => q.id !== target.id))
          }
        },
        target.kind === 'allOpen'
          ? 'Open questions permanently cleared.'
          : 'Question permanently deleted.',
      )
      if (!succeeded) return
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

      {(apiError || mutationError) && (
        <p role="alert" className="mx-auto max-w-[848px] px-5 text-red-700">
          {mutationError || apiError}
        </p>
      )}

      {page === 'questions' && courseSelectionPage && (
        <main className="professor-page-enter min-h-[calc(100dvh-5rem)] bg-[#f7f8fc] px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
          <div className="mx-auto max-w-[640px]">
            <button
              type="button"
              onClick={goToQuestions}
              disabled={busyId === 'session'}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span aria-hidden="true">←</span>
              go back
            </button>
            <h1
              ref={mainHeadingRef}
              tabIndex={-1}
              className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 outline-none sm:text-4xl"
            >
              Choose a course
            </h1>
            <section
              aria-label="Course for new session"
              className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-8"
            >
              <CourseChooser
                courses={courses}
                busy={busyId === 'session'}
                error={sessionError}
                onChoose={chooseCourse}
                onCancel={goToQuestions}
                onSaveCourses={onSaveCourses}
              />
            </section>
          </div>
        </main>
      )}

      {page === 'questions' &&
        sessionSharePage &&
        lectureStartedAt !== null && (
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
                Invite students to{' '}
                {selectedLecture?.course || selectedLecture?.title}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Students can scan the QR code or enter the code after choosing
                Student on the home page.
              </p>
              <section className="mt-8 grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:grid-cols-[256px_1fr] sm:items-center sm:p-8">
                {invite?.id === lectureId ? (
                  <>
                    <div className="mx-auto w-full max-w-64 rounded-xl border border-slate-200 bg-white p-3">
                      <JoinQrCode url={joinUrl(invite.code)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Join code
                      </p>
                      <code className="mt-2 block text-3xl font-bold tracking-[0.12em] text-slate-900 sm:text-4xl">
                        {invite.code}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copyJoinDetail(invite.code, 'Code')}
                        className="mt-4 min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        Copy code
                      </button>
                      <p className="mt-7 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Join link
                      </p>
                      <p className="mt-2 break-all text-sm text-slate-700">
                        {joinUrl(invite.code)}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void copyJoinDetail(joinUrl(invite.code), 'Link')
                        }
                        className="mt-3 min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        Copy link
                      </button>
                    </div>
                  </>
                ) : (
                  <p
                    role={sessionError ? 'alert' : 'status'}
                    className="py-20 text-slate-600 sm:col-span-2"
                  >
                    {sessionError || 'Loading the join code…'}
                  </p>
                )}
              </section>
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
                onClick={goToQuestions}
                className="mt-8 min-h-12 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                Go to questions →
              </button>
            </div>
          </main>
        )}

      {page === 'questions' &&
        lectureStartedAt === null &&
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
                disabled={busyId !== null}
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

      {page === 'questions' &&
        lectureStartedAt !== null &&
        !courseSelectionPage &&
        !sessionSharePage && (
          <main className="professor-page-enter mx-auto max-w-[848px] px-5 pb-20 pt-8 sm:px-6 sm:pt-10">
            <div className="min-[720px]:flex min-[720px]:flex-wrap min-[720px]:items-start min-[720px]:gap-4">
              <div className="min-w-0">
                <h1
                  ref={mainHeadingRef}
                  tabIndex={-1}
                  className="[overflow-wrap:anywhere] text-[28px] leading-tight font-semibold tracking-tight outline-none sm:text-[30px]"
                >
                  {selectedLecture?.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
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
                      className="pointer-events-none invisible absolute left-0 top-full z-30 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-lg bg-slate-900 px-3 py-2 text-xs leading-5 font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
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
                  onClick={openSessionSharePage}
                  disabled={busyId !== null}
                  className="min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Show join code
                </button>
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    aria-pressed={questionsPaused}
                    onClick={toggleQuestionIntake}
                    disabled={busyId !== null}
                    className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    {questionsPaused ? 'Resume questions' : 'Pause questions'}
                  </button>
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
                {selectedTab === 'open' && (
                  <label className="professor-question-sort mb-2 text-xs font-medium text-slate-600">
                    Time filter
                    <select
                      aria-label="Time filter"
                      value={timeFilter}
                      onChange={(e) => {
                        setNow(Date.now())
                        setFilter({
                          lectureId,
                          minutes: Number(e.target.value) as TimeFilter,
                        })
                      }}
                      className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    >
                      {timeFilters.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes
                            ? `Last ${minutes} minutes`
                            : 'All questions'}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            {selectedTab === 'open' && (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={!openQuestionPool.length || busyId !== null}
                  onClick={(e) => void prepareClear(e.currentTarget)}
                  className="min-h-11 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === 'clear' ? 'Clearing…' : 'Clear all questions'}
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
                  <p>
                    {selectedTab === 'open'
                      ? timeFilter
                        ? 'No open questions in this time range.'
                        : 'No open questions.'
                      : 'No answered questions yet.'}
                  </p>
                  {selectedTab === 'open' && timeFilter !== 0 && (
                    <button
                      type="button"
                      className="mt-3 min-h-11 rounded-lg border px-4 font-semibold text-blue-700"
                      onClick={() => setFilter({ lectureId, minutes: 0 })}
                    >
                      Show all questions
                    </button>
                  )}
                </div>
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
                            <p>
                              Submitted:{' '}
                              <time dateTime={question.createdAt}>
                                {timestampFormatter.format(
                                  new Date(question.createdAt),
                                )}
                              </time>
                            </p>
                            <p>Reports: {question.reportCount}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
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

                          <button
                            type="button"
                            onClick={(event) => {
                              setMutationError('')
                              deleteTriggerRef.current = event.currentTarget
                              setDeleteTarget({
                                kind: 'question',
                                id: question.id,
                                text: question.text,
                              })
                            }}
                            disabled={busyId !== null}
                            aria-label="Delete question"
                            title="Delete question"
                            className="ml-auto inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
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
          <div className="mt-6 space-y-2">
            {archive.length === 0 && (
              <p className="text-sm text-slate-600">No past lectures yet.</p>
            )}
            {archive.map(({ lecture, questions }) => (
              <details
                key={lecture.id}
                className="rounded-lg border border-slate-200 bg-slate-50"
              >
                <summary className="cursor-pointer px-4 py-3 marker:text-blue-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600">
                  <span className="font-semibold [overflow-wrap:anywhere]">
                    {lecture.title}
                  </span>
                  {lecture.course && lecture.course !== lecture.title && (
                    <span className="ml-2 text-sm text-slate-600">
                      {lecture.course}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-slate-600">
                    {lectureTimeRange(lecture)} · {questions.length} questions ·{' '}
                    {questions.filter((q) => q.answered).length} answered
                  </span>
                </summary>
                <div className="space-y-2 border-t border-slate-200 p-3">
                  {!questions.length && (
                    <p className="px-1 text-sm text-slate-500">
                      No questions in this lecture.
                    </p>
                  )}
                  {questions.map((question) => (
                    <article
                      key={question.id}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2"
                    >
                      <p className="text-sm leading-6 [overflow-wrap:anywhere]">
                        {question.text}
                      </p>
                      <span
                        className={`text-xs ${question.answered ? 'text-emerald-700' : 'text-slate-500'}`}
                      >
                        {question.answered ? 'Answered' : 'Unanswered'}
                      </span>
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
          <CourseSettings courses={courses} onSaveCourses={onSaveCourses} />
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
            {deleteTarget.kind === 'allOpen'
              ? 'Clear all questions?'
              : 'Permanently delete question?'}
          </h2>
          <p
            id="delete-description"
            className="mt-2 text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]"
          >
            {deleteTarget.kind === 'allOpen'
              ? `Permanently delete all ${deleteTarget.ids.length} open questions from ${deleteTarget.title}? This includes questions outside the selected time range. Answered questions will remain. This cannot be undone.`
              : `Permanently delete “${deleteTarget.text}”? This cannot be undone.`}
          </p>
          {(mutationError || apiError) && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {mutationError || apiError}
            </p>
          )}
          <div className="mt-7 flex justify-end gap-3">
            <button
              type="button"
              autoFocus
              disabled={busyId !== null}
              onClick={() => void closeDialog(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                busyId !== null ||
                (deleteTarget.kind === 'allOpen' &&
                  deleteTarget.ids.length === 0)
              }
              onClick={() => void closeDialog(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              {busyId !== null
                ? 'Deleting…'
                : deleteTarget.kind === 'allOpen'
                  ? 'Clear all questions'
                  : 'Delete permanently'}
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
            New submissions will close. Questions and their statuses will remain
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
