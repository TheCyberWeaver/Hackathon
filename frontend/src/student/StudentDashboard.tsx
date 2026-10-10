import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { QuestionCard } from './components/QuestionCard'
import StudentJoinPage from './StudentJoinPage'
import { SendIcon } from './components/Icons'
import SidePanel, { type SidePanelPage } from '../components/SidePanel'
import { ViewSwitchButton } from './components/ViewSwitchButton'
import StudentTutorial from './components/StudentTutorial'
import { animateScrollTo, prefersReducedMotion } from './lib/motion'
import {
  readTutorialCompleted,
  saveTutorialCompleted,
} from './lib/tutorialProgress'
import type { CurrentUser } from '../lib/api'
import { watchLectures, rememberLecture, type Lecture } from '../lib/poolApi'
import {
  getJoinedSession,
  joinSession,
  leaveJoinedSession,
  type SharedSession,
} from '../lib/sessions'
import './student.css'
import {
  listQuestions,
  deleteQuestion,
  reportQuestion,
  setVote,
  submitQuestion,
  type Question,
} from './lib/studentApi'

const examples = [
  'Could you explain the base case once more?',
  'How did we choose this invariant?',
  'What changes if we reverse the quantifiers?',
  'Can we see another worked example?',
  'Where does this step in the proof come from?',
]

type Page = SidePanelPage
const basePath = '/student'

function currentPage(): Page {
  const path = window.location.pathname.replace(/\/$/, '')
  if (path === `${basePath}/past-lectures`) return 'pastLectures'
  if (path === `${basePath}/profile`) return 'profile'
  if (path === `${basePath}/settings`) return 'settings'
  return 'questions'
}

async function runTransition(update: () => void): Promise<void> {
  if (!prefersReducedMotion() && document.startViewTransition) {
    await document.startViewTransition(() => flushSync(update))
      .updateCallbackDone
  } else {
    flushSync(update)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function StudentDashboard({ user }: { user: CurrentUser }) {
  const [page, setPage] = useState<Page>(currentPage)
  const [joinedSession, setJoinedSession] = useState<SharedSession | null>(null)
  const [sessionChecking, setSessionChecking] = useState(true)
  const [joinBusy, setJoinBusy] = useState(false)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [lectureId, setLectureId] = useState('')
  const selectedLecture = lectures.find((lecture) => lecture.id === lectureId)
  const questionsPaused =
    !selectedLecture ||
    !selectedLecture.startedAt ||
    !!selectedLecture.endedAt ||
    selectedLecture.questionsPaused
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [sending, setSending] = useState(false)
  const [votePendingCount, setVotePendingCount] = useState(0)
  const [mobileView, setMobileView] = useState<'other' | 'mine'>('other')
  const [reportTarget, setReportTarget] = useState<Question | null>(null)
  const [toast, setToast] = useState('')
  const [newQuestionId, setNewQuestionId] = useState<string | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialCompleted, setTutorialCompleted] = useState(() =>
    readTutorialCompleted(user.id),
  )
  const [placeholder] = useState(
    () => examples[Math.floor(Math.random() * examples.length)],
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const heroHeadingRef = useRef<HTMLHeadingElement>(null)
  const mobileListRef = useRef<HTMLElement>(null)
  const pendingVotes = useRef(new Set<string>())
  const pendingDeletes = useRef(new Set<string>())
  const [deletingIds, setDeletingIds] = useState(new Set<string>())
  const mutationVersion = useRef(0)
  const pendingSend = useRef(false)
  const switchingView = useRef(false)
  const toastTimer = useRef<number | undefined>(undefined)
  const tutorialReturnFocus = useRef<HTMLElement | null>(null)
  const joinedSessionId = joinedSession?.id

  function openTutorial() {
    tutorialReturnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    textareaRef.current?.blur()
    setFocused(false)
    setTutorialOpen(true)
  }

  function closeTutorial(completed: boolean) {
    if (completed) {
      setTutorialCompleted(true)
      saveTutorialCompleted(user.id)
    }
    setTutorialOpen(false)
    window.requestAnimationFrame(() => {
      const target = tutorialReturnFocus.current?.isConnected
        ? tutorialReturnFocus.current
        : heroHeadingRef.current
      target?.focus()
    })
  }

  function showToast(message: string) {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 3500)
  }

  async function joinLecture(code: string) {
    if (joinBusy) return
    setJoinBusy(true)
    setJoinError('')
    try {
      const session = await joinSession(code, user.id)
      setJoinedSession(session)
      setLectureId(session.id)
      setQuestions([])
      window.history.replaceState(null, '', basePath)
      showToast(`Joined ${session.course || 'lecture'}.`)
    } catch (error) {
      setJoinError(
        error instanceof Error ? error.message : 'Could not join this lecture.',
      )
    } finally {
      setJoinBusy(false)
    }
  }

  async function leaveLecture() {
    if (leaveBusy) return
    setLeaveBusy(true)
    try {
      leaveJoinedSession(user.id)
      setJoinedSession(null)
      setLectureId('')
      setQuestions([])
      setDraft('')
      setJoinError('')
      window.history.replaceState(null, '', `${basePath}/join`)
      setPage('questions')
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Could not leave this lecture.',
      )
    } finally {
      setLeaveBusy(false)
    }
  }

  function navigate(nextPage: Page) {
    const path =
      nextPage === 'questions'
        ? basePath
        : `${basePath}/${nextPage === 'pastLectures' ? 'past-lectures' : nextPage}`
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', `${path}${window.location.search}`)
    }
    setPage(nextPage)
    setFocused(false)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    function syncPage() {
      setPage(currentPage())
      setFocused(false)
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', syncPage)
    return () => window.removeEventListener('popstate', syncPage)
  }, [])

  useEffect(() => {
    document.title = `AskPool — ${page === 'questions' ? 'Student' : page === 'pastLectures' ? 'Past Lectures' : page === 'profile' ? 'Profile' : 'Settings'}`
  }, [page])

  useEffect(() => {
    if (questionsPaused) {
      textareaRef.current?.blur()
    }
  }, [questionsPaused])

  useEffect(() => {
    return watchLectures(
      (items) => {
        setLectures(items)
      },
      (error) =>
        showToast(
          error instanceof Error ? error.message : 'Could not load lectures.',
        ),
    )
  }, [])

  useEffect(() => {
    let active = true
    const code = new URLSearchParams(window.location.search).get('code')
    const sessionRequest = code
      ? joinSession(code, user.id)
      : getJoinedSession(user.id)
    sessionRequest
      .then((session) => {
        if (!active) return
        setJoinedSession(session)
        setLectureId(session?.id || '')
        if (code && session) window.history.replaceState(null, '', basePath)
      })
      .catch((error: unknown) => {
        if (active)
          setJoinError(
            error instanceof Error
              ? error.message
              : 'Could not check your lecture. Please try again.',
          )
      })
      .finally(() => {
        if (active) setSessionChecking(false)
      })
    return () => {
      active = false
    }
  }, [user.id])

  useEffect(() => {
    if (!joinedSessionId) return
    let active = true
    const timer = window.setInterval(() => {
      getJoinedSession(user.id)
        .then((session) => {
          if (!active) return
          if (session?.id === joinedSessionId) {
            setJoinedSession(session)
          } else {
            setJoinedSession(null)
            setLectureId('')
            setQuestions([])
            setJoinError('This lecture has ended. Enter another code to join.')
            window.history.replaceState(null, '', `${basePath}/join`)
          }
        })
        .catch(() => {
          // Keep the current screen during a transient network failure.
        })
    }, 10_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [joinedSessionId, user.id])

  useEffect(() => {
    if (!lectureId) return
    rememberLecture(lectureId)
    let active = true
    const load = () => {
      const version = mutationVersion.current
      return listQuestions(lectureId)
        .then((items) => {
          if (
            active &&
            version === mutationVersion.current &&
            !pendingSend.current &&
            !pendingVotes.current.size &&
            !pendingDeletes.current.size
          )
            setQuestions(items)
        })
        .catch(() => {
          if (active)
            showToast(
              'Could not load questions. Check your lecture link and try again.',
            )
        })
    }
    void load()
    const timer = window.setInterval(() => {
      void load()
    }, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
      window.clearTimeout(toastTimer.current)
    }
  }, [lectureId])

  useEffect(() => {
    const viewport = window.visualViewport
    function updateHeight() {
      document.documentElement.style.setProperty(
        '--visible-height',
        `${viewport?.height ?? window.innerHeight}px`,
      )
    }
    updateHeight()
    viewport?.addEventListener('resize', updateHeight)
    window.addEventListener('resize', updateHeight)
    return () => {
      viewport?.removeEventListener('resize', updateHeight)
      window.removeEventListener('resize', updateHeight)
    }
  }, [])

  function growTextarea(element: HTMLTextAreaElement) {
    const currentHeight = element.getBoundingClientRect().height
    element.style.transition = 'none'
    element.style.height = '36px'
    // Measure at the minimum height; an in-flight height transition otherwise
    // leaves scrollHeight at the previous, taller size after deleting lines.
    void element.offsetHeight
    const nextHeight = Math.max(36, element.scrollHeight)
    element.style.height = `${currentHeight}px`
    void element.offsetHeight
    element.style.transition = ''
    element.style.height = `${nextHeight}px`
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || pendingSend.current || !lectureId || questionsPaused) return
    setSending(true)
    pendingSend.current = true
    mutationVersion.current++
    textareaRef.current?.blur()
    setFocused(false)
    const optimisticId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimisticQuestion: Question = {
      id: optimisticId,
      text,
      votes: 0,
      createdAt: new Date().toISOString(),
      status: 'open',
      mine: true,
      votedByMe: false,
    }

    // Show the expected result immediately. The server response is checked
    // after the send animation so network timing cannot delay the reveal.
    flushSync(() => {
      setQuestions((items) => [...items, optimisticQuestion])
      setNewQuestionId(optimisticId)
      setDraft('')
      setMobileView('other')
    })
    if (textareaRef.current) growTextarea(textareaRef.current)

    const result = submitQuestion(lectureId, text).then(
      (created) => ({ created, error: null }),
      (error: unknown) => ({ created: null, error }),
    )
    await sleep(prefersReducedMotion() ? 20 : 200)
    await animateScrollTo(
      document.documentElement.scrollHeight - window.innerHeight,
      1000,
    )
    const { created, error } = await result
    if (created) {
      setQuestions((items) =>
        items.map((item) => (item.id === optimisticId ? created : item)),
      )
      setNewQuestionId(created.id)
    } else {
      setQuestions((items) => items.filter((item) => item.id !== optimisticId))
      showToast(
        error instanceof Error
          ? error.message
          : 'Could not send your question.',
      )
      setDraft(text)
    }
    setSending(false)
    pendingSend.current = false
    mutationVersion.current++
    window.setTimeout(() => setNewQuestionId(null), 2200)
  }

  async function handleVote(question: Question) {
    if (pendingVotes.current.has(question.id)) return
    pendingVotes.current.add(question.id)
    setVotePendingCount(pendingVotes.current.size)
    mutationVersion.current++
    const voted = !question.votedByMe
    setQuestions((items) =>
      items.map((item) =>
        item.id === question.id
          ? { ...item, votedByMe: voted, votes: item.votes + (voted ? 1 : -1) }
          : item,
      ),
    )
    try {
      const updated = await setVote(question.id, voted)
      setQuestions((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      )
    } catch {
      setQuestions((items) =>
        items.map((item) => (item.id === question.id ? question : item)),
      )
      showToast('Vote could not be saved. Please try again.')
    } finally {
      pendingVotes.current.delete(question.id)
      setVotePendingCount(pendingVotes.current.size)
      mutationVersion.current++
    }
  }

  async function handleDelete(question: Question) {
    if (
      !question.mine ||
      question.id.startsWith('pending-') ||
      pendingDeletes.current.has(question.id)
    )
      return
    pendingDeletes.current.add(question.id)
    setDeletingIds(new Set(pendingDeletes.current))
    mutationVersion.current++
    try {
      await deleteQuestion(question.id)
      setQuestions((items) => items.filter((item) => item.id !== question.id))
      showToast('Your question was deleted.')
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Could not delete your question. Please try again.',
      )
    } finally {
      pendingDeletes.current.delete(question.id)
      setDeletingIds(new Set(pendingDeletes.current))
      mutationVersion.current++
    }
  }

  async function switchMobileView() {
    if (switchingView.current) return
    switchingView.current = true
    const next = mobileView === 'other' ? 'mine' : 'other'
    const previousScroll = window.scrollY
    const section = mobileListRef.current
    const sectionTop = section
      ? window.scrollY + section.getBoundingClientRect().top
      : 0
    const listTop = Math.max(0, sectionTop - 16)

    // Keep enough scrollable space while a long list becomes a short one.
    if (section) {
      section.style.minHeight = `${Math.ceil(previousScroll + window.innerHeight - sectionTop + 2)}px`
    }

    try {
      flushSync(() => setMobileView(next))
      window.scrollTo(0, previousScroll)
      if (section) {
        const content = section.querySelector('.question-list, .empty-message')
        const contentBottom = content
          ? window.scrollY + content.getBoundingClientRect().bottom
          : sectionTop
        const usefulScroll = Math.max(
          listTop,
          contentBottom - window.innerHeight + 80,
        )
        if (window.scrollY > usefulScroll + 24) {
          await animateScrollTo(listTop, 500)
        }
      }
    } finally {
      if (section) section.style.minHeight = ''
      switchingView.current = false
    }

    try {
      if (
        !lectureId ||
        pendingSend.current ||
        pendingVotes.current.size ||
        pendingDeletes.current.size
      )
        return
      const version = mutationVersion.current
      const refreshed = await listQuestions(lectureId)
      if (
        version !== mutationVersion.current ||
        pendingSend.current ||
        pendingVotes.current.size ||
        pendingDeletes.current.size
      )
        return
      await runTransition(() => setQuestions(refreshed))
    } catch {
      showToast(
        'Could not refresh the order. Showing the latest loaded questions.',
      )
    }
  }

  async function confirmReport() {
    if (!reportTarget) return
    const target = reportTarget
    setReportTarget(null)
    try {
      await reportQuestion(target.id)
      showToast("Thanks, we'll take a look.")
    } catch {
      showToast('Could not send the report. Please try again.')
    }
  }

  const mine = questions
    .filter((question) => question.mine)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const others = questions
  const counterOpacity = Math.max(0, Math.min(1, (draft.length - 160) / 40))

  function cards(items: Question[], isMine: boolean) {
    if (isMine && items.length === 0) {
      return (
        <p className="empty-message">Questions you send will appear here.</p>
      )
    }
    return (
      <div className="question-list">
        {items.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            highlighted={question.id === newQuestionId}
            onVote={handleVote}
            onReport={setReportTarget}
            onDelete={(question) => void handleDelete(question)}
            deleting={deletingIds.has(question.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="student-app">
      <SidePanel
        user={user}
        role="student"
        page={page}
        onNavigate={navigate}
        launcherClassName="side-panel-launcher--student"
      />
      {page === 'questions' && !joinedSession ? (
        <StudentJoinPage
          busy={joinBusy}
          checking={sessionChecking}
          error={joinError}
          onJoin={(code) => void joinLecture(code)}
        />
      ) : page === 'questions' ? (
        <main>
          <section
            className={`hero ${focused ? 'hero--focused' : ''}`}
            aria-label="Ask a question"
          >
            <div className="hero__content page-column">
              <div className="student-session-bar">
                <div className="student-session-summary">
                  <span className="student-session-kicker">
                    Current lecture
                  </span>
                  <span className="student-session-course">
                    {joinedSession?.course ||
                      selectedLecture?.title ||
                      'Lecture'}
                  </span>
                  <span className="student-session-code">
                    Code {joinedSession?.code}
                  </span>
                </div>
                <button
                  type="button"
                  className="student-session-leave"
                  onClick={() => void leaveLecture()}
                  disabled={leaveBusy}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 17l5-5-5-5M15 12H3M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" />
                  </svg>
                  {leaveBusy ? 'Leaving…' : 'Leave lecture'}
                </button>
              </div>
              <h1 ref={heroHeadingRef} tabIndex={-1}>
                {selectedLecture?.endedAt
                  ? 'This lecture has ended'
                  : questionsPaused
                    ? 'Questions are paused'
                    : "What's your question?"}
              </h1>
              <div
                className={`composer ${focused ? 'composer--focused' : ''} ${questionsPaused ? 'composer--paused' : ''}`}
              >
                <label className="sr-only" htmlFor="question-input">
                  Your anonymous question
                </label>
                <textarea
                  id="question-input"
                  ref={textareaRef}
                  rows={1}
                  maxLength={200}
                  value={draft}
                  placeholder={
                    questionsPaused
                      ? 'Question submissions are closed'
                      : placeholder
                  }
                  disabled={questionsPaused}
                  aria-describedby="question-input-status"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onChange={(event) => {
                    const next = event.target.value.slice(0, 200)
                    event.target.value = next
                    setDraft(next)
                    growTextarea(event.target)
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      (event.metaKey || event.ctrlKey)
                    ) {
                      event.preventDefault()
                      void handleSend()
                    }
                  }}
                />
                <div className="composer__bottom">
                  <span
                    id="question-input-status"
                    className="anonymous-note"
                    aria-live="polite"
                  >
                    {questionsPaused
                      ? 'Submissions are unavailable until the professor opens this lecture.'
                      : 'Your name is not shown on question cards.'}
                  </span>
                  <div className="composer__send">
                    <button
                      type="button"
                      className="send-button"
                      aria-label="Send question"
                      disabled={
                        !draft.trim() ||
                        sending ||
                        !lectureId ||
                        questionsPaused
                      }
                      onClick={() => void handleSend()}
                    >
                      <SendIcon width="23" height="23" />
                    </button>
                    <span
                      className="character-counter"
                      style={{ opacity: counterOpacity }}
                      aria-hidden={counterOpacity === 0}
                    >
                      {draft.length}/200
                    </span>
                  </div>
                </div>
              </div>
              {!tutorialCompleted && (
                <div className="student-tutorial-invite">
                  <svg aria-hidden="true" viewBox="0 0 72 38" fill="none">
                    <path
                      d="M3 3c18 0 20 27 52 27m-9-9 10 9-11 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <button
                    type="button"
                    className="student-tutorial-trigger"
                    aria-haspopup="dialog"
                    onClick={openTutorial}
                  >
                    New here? Need a quick tutorial?
                  </button>
                </div>
              )}
            </div>
          </section>

          <section
            className="desktop-your page-column"
            aria-labelledby="your-heading"
          >
            <h2 id="your-heading" className="section-heading">
              Your questions
            </h2>
            {cards(mine, true)}
          </section>

          <section
            className="desktop-other page-column"
            aria-labelledby="other-heading-desktop"
          >
            <h2 id="other-heading-desktop" className="section-heading">
              Other Questions
            </h2>
            {cards(others, false)}
          </section>

          <section
            ref={mobileListRef}
            className="mobile-questions page-column"
            aria-labelledby="mobile-questions-heading"
          >
            <div className="mobile-section-heading">
              <h2 id="mobile-questions-heading" className="section-heading">
                {mobileView === 'other' ? 'Other Questions' : 'Your questions'}
              </h2>
              <ViewSwitchButton
                showingMine={mobileView === 'mine'}
                onClick={() => void switchMobileView()}
              />
            </div>
            {mobileView === 'other' ? cards(others, false) : cards(mine, true)}
          </section>
        </main>
      ) : (
        <main className="placeholder-page">
          <section className="placeholder-page__content page-column">
            <h1>
              {page === 'pastLectures'
                ? 'Past Lectures'
                : page === 'profile'
                  ? 'Profile'
                  : 'Settings'}
            </h1>
            {page === 'settings' ? (
              <div className="placeholder-page__card student-settings-card">
                <div>
                  <h2>Tutorial</h2>
                  <p>
                    Need a refresher? You can replay the student guide anytime.
                  </p>
                </div>
                <button
                  type="button"
                  className="student-settings-open-tutorial"
                  onClick={openTutorial}
                >
                  Open tutorial <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : (
              <div className="placeholder-page__card">
                <h2>
                  {page === 'pastLectures' ? 'Past lectures' : 'Your profile'}
                </h2>
                <p>
                  {page === 'pastLectures'
                    ? 'Choose a saved lecture to review its question pool.'
                    : 'Your profile will appear here.'}
                </p>
                {page === 'pastLectures' &&
                  lectures.map((lecture) => (
                    <p key={lecture.id}>
                      <button
                        type="button"
                        className="text-blue-700 underline"
                        disabled={
                          sending ||
                          votePendingCount > 0 ||
                          deletingIds.size > 0
                        }
                        onClick={() => {
                          setQuestions([])
                          setLectureId(lecture.id)
                          rememberLecture(lecture.id)
                          navigate('questions')
                        }}
                      >
                        {lecture.title} —{' '}
                        {new Date(lecture.lectureTime).toLocaleString()}
                      </button>
                    </p>
                  ))}
              </div>
            )}
          </section>
        </main>
      )}

      {reportTarget && (
        <div className="dialog-backdrop" onClick={() => setReportTarget(null)}>
          <div
            className="report-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="report-title">Report this question?</h2>
            <p>We&apos;ll flag it for review.</p>
            <div className="report-sheet__actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setReportTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void confirmReport()}
              >
                Report
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && <div className="toast">{toast}</div>}
      </div>
      {tutorialOpen && <StudentTutorial onClose={closeTutorial} />}
    </div>
  )
}
