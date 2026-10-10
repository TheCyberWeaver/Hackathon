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
  readTutorialDismissed,
  saveTutorialCompleted,
  saveTutorialDismissed,
} from './lib/tutorialProgress'
import type { CurrentUser } from '../lib/api'
import {
  ApiRequestError,
  getLecture,
  rememberLecture,
  type Lecture,
} from '../lib/poolApi'
import {
  getJoinedSession,
  joinSession,
  leaveJoinedSession,
  parseJoinCode,
  type SharedSession,
} from '../lib/sessions'
import './student.css'
import {
  listQuestions,
  deleteQuestion,
  reportQuestion,
  setVote,
  submitQuestion,
  visitLecture,
  removeLectureFromHistory,
  watchLectureHistory,
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
  const [locationVersion, setLocationVersion] = useState(0)
  const [joinedSession, setJoinedSession] = useState<SharedSession | null>(null)
  const [sessionChecking, setSessionChecking] = useState(true)
  const [joinBusy, setJoinBusy] = useState(false)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [viewedLecture, setViewedLecture] = useState<Lecture | null>(null)
  const [lectureId, setLectureId] = useState('')
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [removingHistoryId, setRemovingHistoryId] = useState<string | null>(
    null,
  )
  const selectedLecture = viewedLecture
  const readOnly =
    !selectedLecture?.startedAt ||
    !!selectedLecture.endedAt ||
    joinedSession?.id !== lectureId
  const questionsPaused = readOnly || !!selectedLecture?.questionsPaused
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [sending, setSending] = useState(false)
  const [votePendingCount, setVotePendingCount] = useState(0)
  const [mobileView, setMobileView] = useState<'other' | 'mine'>('other')
  const [reportTarget, setReportTarget] = useState<Question | null>(null)
  const [toast, setToast] = useState('')
  const [moderationWarning, setModerationWarning] = useState<number | null>(
    null,
  )
  const [newQuestionId, setNewQuestionId] = useState<string | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialCompleted, setTutorialCompleted] = useState(() =>
    readTutorialCompleted(user.id),
  )
  const [tutorialDismissed, setTutorialDismissed] = useState(() =>
    readTutorialDismissed(user.id),
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
  const historyVersion = useRef(0)
  const sessionVersion = useRef(0)
  const historyMutationPending = useRef(false)
  const selectedIdRef = useRef('')
  const selectionBusy =
    sending ||
    votePendingCount > 0 ||
    deletingIds.size > 0 ||
    joinBusy ||
    leaveBusy

  function selectLecture(lecture: Lecture | null) {
    selectedIdRef.current = lecture?.id || ''
    mutationVersion.current++
    setViewedLecture(lecture)
    setLectureId(lecture?.id || '')
    setQuestions([])
    setDraft('')
    setReportTarget(null)
    setModerationWarning(null)
    setFocused(false)
  }

  function rememberVisit(lecture: Lecture) {
    setLectures((items) => [
      lecture,
      ...items.filter((item) => item.id !== lecture.id),
    ])
  }

  function showLecture(lecture: Lecture, includeLink = true) {
    selectLecture(lecture)
    window.history.pushState(
      null,
      '',
      includeLink
        ? `${basePath}?lecture=${encodeURIComponent(lecture.id)}`
        : basePath,
    )
    setPage('questions')
    window.scrollTo(0, 0)
  }

  async function returnToCurrentLecture() {
    if (selectionBusy) return
    if (
      !joinedSession ||
      (joinedSession.id === lectureId && selectedLecture?.endedAt)
    ) {
      selectLecture(null)
      window.history.pushState(null, '', `${basePath}/join`)
      setPage('questions')
      return
    }
    try {
      // Returning to the active pool must not restore a removed history entry.
      showLecture(await getLecture(joinedSession.id), false)
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Could not load your current lecture.',
      )
    }
  }

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

  function dismissTutorialInvite() {
    setTutorialDismissed(true)
    saveTutorialDismissed(user.id)
  }

  function showToast(message: string) {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 3500)
  }

  async function joinLecture(code: string) {
    if (selectionBusy || historyMutationPending.current) return
    const id = parseJoinCode(code)
    if (!id) {
      setJoinError('Enter a valid numeric lecture ID.')
      return
    }
    setJoinBusy(true)
    setJoinError('')
    sessionVersion.current++
    historyMutationPending.current = true
    historyVersion.current++
    try {
      const lecture = await visitLecture(id)
      rememberVisit(lecture)
      if (lecture.startedAt && !lecture.endedAt) {
        const session = await joinSession(id)
        setJoinedSession(session)
        showToast(`Joined ${session.course || 'lecture'}.`)
      }
      showLecture(lecture)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not open this lecture.'
      setJoinError(message)
      if (lectureId) showToast(message)
    } finally {
      sessionVersion.current++
      historyVersion.current++
      historyMutationPending.current = false
      setJoinBusy(false)
    }
  }

  async function removeFromHistory(lecture: Lecture) {
    if (historyMutationPending.current) return
    historyMutationPending.current = true
    historyVersion.current++
    setRemovingHistoryId(lecture.id)
    try {
      await removeLectureFromHistory(lecture.id)
      setLectures((items) => items.filter((item) => item.id !== lecture.id))
      showToast('Lecture removed from your history.')
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Could not remove this lecture from your history.',
      )
    } finally {
      historyVersion.current++
      historyMutationPending.current = false
      setRemovingHistoryId(null)
    }
  }

  async function leaveLecture() {
    if (selectionBusy) return
    setLeaveBusy(true)
    sessionVersion.current++
    try {
      await leaveJoinedSession()
      setJoinedSession(null)
      selectLecture(null)
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
      sessionVersion.current++
      setLeaveBusy(false)
    }
  }

  function navigate(nextPage: Page) {
    if (nextPage === 'questions') {
      void returnToCurrentLecture()
      return
    }
    const path = `${basePath}/${nextPage === 'pastLectures' ? 'past-lectures' : nextPage}`
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path)
    }
    setPage(nextPage)
    setFocused(false)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    function syncPage() {
      setPage(currentPage())
      setSessionChecking(true)
      setLocationVersion((version) => version + 1)
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
    return watchLectureHistory(
      (items) => {
        if (historyMutationPending.current) return
        setLectures(items)
        setHistoryLoading(false)
        setHistoryError('')
      },
      (error) => {
        setHistoryLoading(false)
        setHistoryError(
          error instanceof Error
            ? error.message
            : 'Could not load your lecture history.',
        )
      },
      () => historyVersion.current,
    )
  }, [user.id])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams(window.location.search)
    const linkedCode =
      currentPage() === 'questions'
        ? params.get('code') || params.get('lecture')
        : null
    async function loadSession() {
      const session = await getJoinedSession()
      if (!active) return
      setJoinedSession(session)
      if (linkedCode) {
        const id = parseJoinCode(linkedCode)
        if (!id) throw new Error('Enter a valid numeric lecture ID.')
        const lecture = await visitLecture(id)
        if (!active) return
        rememberVisit(lecture)
        if (lecture.startedAt && !lecture.endedAt) {
          const joined = await joinSession(id)
          if (!active) return
          setJoinedSession(joined)
        }
        selectLecture(lecture)
        rememberLecture(lecture.id)
      } else if (session) {
        const lecture = await getLecture(session.id)
        if (active) selectLecture(lecture)
      } else if (currentPage() === 'questions') {
        selectLecture(null)
      }
    }
    void loadSession()
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
  }, [user.id, locationVersion])

  useEffect(() => {
    let active = true
    const timer = window.setInterval(() => {
      const version = sessionVersion.current
      getJoinedSession()
        .then((session) => {
          if (!active || version !== sessionVersion.current) return
          setJoinedSession(session)
        })
        .catch(() => {
          // Keep the current screen during a transient network failure.
        })
    }, 10_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [user.id])

  useEffect(() => {
    if (!lectureId) return
    let active = true
    const load = () => {
      const version = mutationVersion.current
      void getLecture(lectureId)
        .then((lecture) => {
          if (active) setViewedLecture(lecture)
        })
        .catch(() => {})
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
    try {
      // Only render questions after the server accepts them. Rejected text
      // must never briefly appear in the pool as an optimistic card.
      const created = await submitQuestion(lectureId, text)
      flushSync(() => {
        setQuestions((items) =>
          items.some((item) => item.id === created.id)
            ? items
            : [...items, created],
        )
        setNewQuestionId(created.id)
        setDraft('')
        setModerationWarning(null)
        setMobileView('mine')
      })
      if (textareaRef.current) growTextarea(textareaRef.current)
      await sleep(prefersReducedMotion() ? 20 : 200)
      const newCard = Array.from(
        document.querySelectorAll<HTMLElement>('[data-question-id]'),
      ).find(
        (card) =>
          card.dataset.questionId === created.id &&
          card.getClientRects().length > 0,
      )
      if (newCard)
        newCard.scrollIntoView({
          behavior: prefersReducedMotion() ? 'instant' : 'smooth',
          block: 'center',
        })
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === 'QUESTION_BLOCKED'
      ) {
        setModerationWarning(error.warningCount ?? 1)
        window.requestAnimationFrame(() => textareaRef.current?.focus())
      } else {
        showToast(
          error instanceof Error
            ? error.message
            : 'Could not send your question.',
        )
      }
    } finally {
      setSending(false)
      pendingSend.current = false
      mutationVersion.current++
      window.setTimeout(() => setNewQuestionId(null), 2200)
    }
  }

  async function handleVote(question: Question) {
    if (readOnly || question.mine || pendingVotes.current.has(question.id))
      return
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
      readOnly ||
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
      const requestedLectureId = lectureId
      const refreshed = await listQuestions(lectureId)
      if (
        selectedIdRef.current !== requestedLectureId ||
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
    if (readOnly || !reportTarget) return
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
  const others = questions.filter((question) => !question.mine)

  function cards(items: Question[], isMine: boolean) {
    if (items.length === 0) {
      return (
        <p className="empty-message">
          {isMine
            ? 'Questions you send will appear here.'
            : 'No questions from other students yet.'}
        </p>
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
            readOnly={readOnly}
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
      {page === 'questions' && !lectureId ? (
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
                    {selectedLecture?.endedAt
                      ? 'Past lecture'
                      : readOnly
                        ? 'Lecture review'
                        : 'Current lecture'}
                  </span>
                  <span className="student-session-course">
                    {selectedLecture?.course ||
                      selectedLecture?.title ||
                      'Lecture'}
                  </span>
                  <span className="student-session-code">Code {lectureId}</span>
                </div>
                {!readOnly ? (
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
                ) : (
                  <div className="student-review-actions">
                    <button
                      type="button"
                      className="student-session-leave"
                      onClick={() => navigate('pastLectures')}
                    >
                      Back to past lectures
                    </button>
                    <button
                      type="button"
                      className="student-session-leave"
                      disabled={selectionBusy}
                      onClick={() => void returnToCurrentLecture()}
                    >
                      {joinedSession && joinedSession.id !== lectureId
                        ? 'Return to current lecture'
                        : 'Join another lecture'}
                    </button>
                  </div>
                )}
              </div>
              <h1 ref={heroHeadingRef} tabIndex={-1}>
                {selectedLecture?.endedAt
                  ? 'This lecture has ended'
                  : readOnly
                    ? selectedLecture?.startedAt
                      ? 'Lecture question pool'
                      : 'This lecture has not started'
                    : questionsPaused
                      ? 'Questions are paused'
                      : "What's your question?"}
              </h1>
              {readOnly ? (
                <p className="student-review-note">
                  You can review the questions and answers from this lecture.
                </p>
              ) : (
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
                    aria-describedby={`question-input-status${moderationWarning === null ? '' : ' question-moderation-warning'}`}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onChange={(event) => {
                      const next = event.target.value.slice(0, 200)
                      event.target.value = next
                      setDraft(next)
                      setModerationWarning(null)
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
                        ? 'Submissions are closed right now.'
                        : "Your name isn't shown on cards."}
                    </span>
                    <div className="composer__send">
                      {draft.length > 160 && (
                        <span className="character-counter">
                          {draft.length}/200
                        </span>
                      )}
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
                    </div>
                  </div>
                </div>
              )}
              {moderationWarning !== null && (
                <div
                  id="question-moderation-warning"
                  className="question-moderation-warning"
                  role="alert"
                >
                  <strong>
                    {moderationWarning < 10
                      ? `Question not sent · Warning ${moderationWarning}`
                      : moderationWarning === 10
                        ? 'Warning 10 · Nice try, still not posting'
                        : 'Question not sent · Try a different wording'}
                  </strong>
                  <span>
                    {moderationWarning < 10
                      ? 'This wording isn’t allowed. Edit your question and try again.'
                      : moderationWarning === 10
                        ? 'Seriously, this wording won’t make it into the pool. Rephrase your lecture question and send it again.'
                        : 'Focus on the lecture point you want explained, and leave out the blocked wording. You can edit and send it again.'}
                  </span>
                </div>
              )}
              {!readOnly && !tutorialCompleted && !tutorialDismissed && (
                <div className="student-tutorial-invite">
                  <div className="student-tutorial-invite__prompt">
                    <svg
                      className="student-tutorial-arrow"
                      aria-hidden="true"
                      viewBox="0 0 72 38"
                      fill="none"
                    >
                      <path
                        d="M6 7C7 17 20 19 57 20m-8-7 8 7-8 7"
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
                      Need a quick tutorial?
                    </button>
                  </div>
                  <button
                    type="button"
                    className="student-tutorial-dismiss"
                    aria-label="Dismiss tutorial suggestion"
                    onClick={dismissTutorialInvite}
                  >
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M5 5l10 10M15 5L5 15"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
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
                {page === 'pastLectures' && historyLoading && (
                  <p role="status">Loading your lecture history…</p>
                )}
                {page === 'pastLectures' && historyError && (
                  <p role="alert">{historyError}</p>
                )}
                {page === 'pastLectures' &&
                  !historyLoading &&
                  !historyError &&
                  lectures.length === 0 && (
                    <p>
                      You haven’t visited any lectures yet. Join a lecture to
                      save it here.
                    </p>
                  )}
                {page === 'pastLectures' &&
                  lectures.map((lecture) => (
                    <div key={lecture.id} className="student-history-item">
                      <button
                        type="button"
                        className="text-blue-700 underline"
                        disabled={selectionBusy || removingHistoryId !== null}
                        onClick={() => void joinLecture(lecture.id)}
                      >
                        {lecture.title} —{' '}
                        {new Date(lecture.lectureTime).toLocaleString()}
                      </button>
                      <button
                        type="button"
                        className="student-history-remove"
                        aria-label={`Remove ${lecture.title} from history`}
                        disabled={removingHistoryId !== null || joinBusy}
                        onClick={() => void removeFromHistory(lecture)}
                      >
                        {removingHistoryId === lecture.id
                          ? 'Removing…'
                          : 'Remove from history'}
                      </button>
                    </div>
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
