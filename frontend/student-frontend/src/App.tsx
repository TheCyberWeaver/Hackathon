import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { QuestionCard } from './components/QuestionCard'
import { PanelIcon, ProfileIcon, SendIcon } from './components/Icons'
import { ViewSwitchButton } from './components/ViewSwitchButton'
import { animateScrollTo, prefersReducedMotion } from './lib/motion'
import {
  listQuestions,
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

type Page = 'questions' | 'profile' | 'settings'

const navigation: { page: Page; label: string; href: string }[] = [
  { page: 'questions', label: 'Questions', href: '/' },
  { page: 'profile', label: 'Profile', href: '/profile' },
  { page: 'settings', label: 'Settings', href: '/settings' },
]

function currentPage(basePath: string): Page {
  if (window.location.pathname === `${basePath}/profile`) return 'profile'
  if (window.location.pathname === `${basePath}/settings`) return 'settings'
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

export default function App({
  basePath = '',
  user,
}: {
  basePath?: string
  user?: { id: string; name: string }
} = {}) {
  const [page, setPage] = useState<Page>(() => currentPage(basePath))
  const [questions, setQuestions] = useState<Question[]>([])
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'other' | 'mine'>('other')
  const [reportTarget, setReportTarget] = useState<Question | null>(null)
  const [toast, setToast] = useState('')
  const [newQuestionId, setNewQuestionId] = useState<string | null>(null)
  const [placeholder] = useState(
    () => examples[Math.floor(Math.random() * examples.length)],
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mobileListRef = useRef<HTMLElement>(null)
  const pendingVotes = useRef(new Set<string>())
  const switchingView = useRef(false)
  const toastTimer = useRef<number | undefined>(undefined)

  function showToast(message: string) {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 3500)
  }

  function navigate(nextPage: Page) {
    const path =
      nextPage === 'questions' ? basePath || '/' : `${basePath}/${nextPage}`
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path)
    }
    setPage(nextPage)
    setSidebarOpen(false)
    setFocused(false)
    window.scrollTo(0, 0)
  }

  function handleNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    nextPage: Page,
  ) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    navigate(nextPage)
  }

  useEffect(() => {
    function syncPage() {
      setPage(currentPage(basePath))
      setSidebarOpen(false)
      setFocused(false)
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', syncPage)
    return () => window.removeEventListener('popstate', syncPage)
  }, [basePath])

  useEffect(() => {
    if (!sidebarOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [sidebarOpen])

  useEffect(() => {
    document.title = `AskPool — ${page === 'questions' ? 'Student demo' : page === 'profile' ? 'Profile' : 'Settings'}`
  }, [page])

  useEffect(() => {
    let active = true
    listQuestions()
      .then((items) => {
        if (active) setQuestions(items)
      })
      .catch(() => {
        if (active)
          showToast('Could not load questions. Please refresh to try again.')
      })
    return () => {
      active = false
      window.clearTimeout(toastTimer.current)
    }
  }, [])

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
    if (!text || sending) return
    setSending(true)
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

    const result = submitQuestion(text).then(
      (created) => ({ created, error: null }),
      (error: unknown) => ({ created: null, error }),
    )
    await sleep(prefersReducedMotion() ? 20 : 200)
    await animateScrollTo(
      document.documentElement.scrollHeight - window.innerHeight,
      1000,
    )
    setSending(false)

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
    }
    window.setTimeout(() => setNewQuestionId(null), 2200)
  }

  async function handleVote(question: Question) {
    if (pendingVotes.current.has(question.id)) return
    pendingVotes.current.add(question.id)
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
      const refreshed = await listQuestions()
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
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        className="sidebar-trigger"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <PanelIcon width="22" height="22" />
      </button>
      <a
        className="brand-mark"
        href={basePath || '/'}
        onClick={(event) => handleNavigation(event, 'questions')}
      >
        ASKPOOL
      </a>
      <div
        className={`sidebar-scrim ${sidebarOpen ? 'sidebar-scrim--open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}
        aria-hidden={!sidebarOpen}
      >
        <div className="sidebar__identity">
          <span className="sidebar__avatar">
            <ProfileIcon width="25" height="25" />
          </span>
          <span className="sidebar__name">{user?.name || 'Student'}</span>
        </div>
        <div className="sidebar__divider" />
        <nav className="sidebar__nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <a
              key={item.page}
              href={
                item.page === 'questions'
                  ? basePath || '/'
                  : `${basePath}${item.href}`
              }
              className={`sidebar__link ${page === item.page ? 'sidebar__link--active' : ''}`}
              aria-current={page === item.page ? 'page' : undefined}
              onClick={(event) => handleNavigation(event, item.page)}
            >
              {item.label}
            </a>
          ))}
          {user && (
            <a className="sidebar__link" href="/">
              Switch space
            </a>
          )}
        </nav>
      </aside>

      {page === 'questions' ? (
        <main>
          <section
            className={`hero ${focused ? 'hero--focused' : ''}`}
            aria-label="Ask a question"
          >
            <div className="hero__content page-column">
              <h1>What&apos;s your question?</h1>
              <div className={`composer ${focused ? 'composer--focused' : ''}`}>
                <label className="sr-only" htmlFor="question-input">
                  Your anonymous question
                </label>
                <textarea
                  id="question-input"
                  ref={textareaRef}
                  rows={1}
                  maxLength={200}
                  value={draft}
                  placeholder={placeholder}
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
                  <span className="anonymous-note">Fully anonymous.</span>
                  <div className="composer__send">
                    <button
                      type="button"
                      className="send-button"
                      aria-label="Send question"
                      disabled={!draft.trim() || sending}
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
            <h1>{page === 'profile' ? 'Profile' : 'Settings'}</h1>
            <div className="placeholder-page__card">
              <h2>
                {page === 'profile' ? 'Profile settings' : 'Settings page'}
              </h2>
              <p>
                {page === 'profile'
                  ? 'This is a placeholder for your profile settings.'
                  : 'This is a placeholder for your settings.'}
              </p>
            </div>
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
    </>
  )
}
