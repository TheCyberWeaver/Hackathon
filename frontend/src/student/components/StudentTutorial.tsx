import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { SendIcon, ThumbsUpIcon } from './Icons'
import './student-tutorial.css'

const steps = [
  {
    eyebrow: '01 / JOIN',
    title: 'Join your lecture',
    description:
      'Scan the QR code your professor shares to join this lecture’s question pool.',
    visual: 'join',
  },
  {
    eyebrow: '02 / ASK',
    title: 'Ask about this lecture',
    description:
      'Send a question to see it under Your questions. Other Questions shows classmates’ questions. Your name is not shown.',
    visual: 'ask',
  },
  {
    eyebrow: '03 / UPVOTE',
    title: 'Upvote questions you want answered',
    description:
      'Upvote other students’ questions, or tap again to remove your vote. You are not allowed to upvote your own question.',
    visual: 'vote',
  },
  {
    eyebrow: '04 / PROFESSOR POV',
    title: 'More upvotes, more visibility',
    description:
      'The professor sees Open questions ranked by upvotes and can filter by submission time. Answers are given verbally.',
    visual: 'queue',
  },
] as const

const qrCells = Array.from({ length: 21 * 21 }, (_, index) => {
  const x = index % 21
  const y = Math.floor(index / 21)
  const inFinder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)
  return !inFinder && (x * 17 + y * 11 + x * y * 3) % 7 < 3 ? { x, y } : null
}).filter((cell): cell is { x: number; y: number } => cell !== null)

function SampleQr() {
  return (
    <svg
      className="student-tutorial-qr"
      viewBox="0 0 210 210"
      role="img"
      aria-label="Illustrative QR code; this example is not scannable"
    >
      <rect width="210" height="210" rx="15" fill="white" />
      {qrCells.map(({ x, y }) => (
        <rect
          key={`${x}-${y}`}
          x={x * 8 + 21}
          y={y * 8 + 21}
          width="7"
          height="7"
          rx="1"
          fill="#0f172a"
        />
      ))}
      {[
        [21, 21],
        [133, 21],
        [21, 133],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="56" height="56" rx="3" fill="#0f172a" />
          <rect
            x={x + 8}
            y={y + 8}
            width="40"
            height="40"
            rx="2"
            fill="white"
          />
          <rect
            x={x + 16}
            y={y + 16}
            width="24"
            height="24"
            rx="2"
            fill="#0f172a"
          />
        </g>
      ))}
    </svg>
  )
}

function AskPreview() {
  return (
    <div
      className="student-tutorial-ask-preview"
      role="img"
      aria-label="Example question composer with a lecture question and no author name"
    >
      <h3>What&apos;s your question?</h3>
      <div className="student-tutorial-ask-composer">
        <p>How does the induction hypothesis help prove the next case?</p>
        <div className="student-tutorial-ask-composer-bottom">
          <span>Your name is not shown on question cards.</span>
          <span className="student-tutorial-ask-send" aria-hidden="true">
            <SendIcon width="26" height="26" />
          </span>
        </div>
      </div>
    </div>
  )
}

function VotePreview() {
  return (
    <div
      className="student-tutorial-vote-preview"
      role="img"
      aria-label="Two lecture questions with 42 and 37 upvotes"
    >
      <h3>Other questions</h3>
      <div className="student-tutorial-vote-question">
        <p>Could you go through the base case of the induction proof again?</p>
        <span>
          <ThumbsUpIcon width="19" height="19" /> 42
        </span>
      </div>
      <div className="student-tutorial-vote-question">
        <p>How does the induction hypothesis help prove the next case?</p>
        <span>
          <ThumbsUpIcon width="19" height="19" /> 37
        </span>
      </div>
    </div>
  )
}

function QueuePreview() {
  return (
    <div
      className="student-tutorial-queue-preview"
      role="img"
      aria-label="Professor question queue: a question with 24 upvotes appears above one with 18 upvotes"
    >
      <div className="student-tutorial-queue-heading">
        <span>Open questions</span>
        <span>All questions</span>
      </div>
      <div className="student-tutorial-queue-item student-tutorial-queue-item--top">
        <span className="student-tutorial-queue-rank">1</span>
        <p>Could you explain correlation and causation again?</p>
        <span className="student-tutorial-queue-votes">
          <ThumbsUpIcon width="17" height="17" /> 24
        </span>
      </div>
      <div className="student-tutorial-queue-item">
        <span className="student-tutorial-queue-rank">2</span>
        <p>Why does the gradient point uphill?</p>
        <span className="student-tutorial-queue-votes">
          <ThumbsUpIcon width="17" height="17" /> 18
        </span>
      </div>
    </div>
  )
}

type Props = {
  onClose: (completed: boolean) => void
}

export default function StudentTutorial({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const [closing, setClosing] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  const closeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
      if (dialog?.open) dialog.close()
    }
  }, [])

  function requestClose(completed = false) {
    if (closeTimerRef.current !== null) return
    setClosing(true)
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    closeTimerRef.current = window.setTimeout(
      () => onClose(completed),
      reducedMotion ? 0 : 280,
    )
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      requestClose()
    }
  }

  const current = steps[step]

  return (
    <dialog
      ref={dialogRef}
      className="student-tutorial-dialog"
      data-closing={closing}
      aria-labelledby="student-tutorial-title"
      aria-describedby="student-tutorial-description"
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={handleBackdropClick}
      onKeyDown={(event) => {
        if (closing) return
        if (event.key === 'ArrowRight' && step < steps.length - 1) {
          event.preventDefault()
          setStep(step + 1)
        }
        if (event.key === 'ArrowLeft' && step > 0) {
          event.preventDefault()
          setStep(step - 1)
        }
      }}
    >
      <div className="student-tutorial-shell">
        <header className="student-tutorial-header">
          <span className="student-tutorial-brand">
            ASKPOOL <span>GUIDE</span>
          </span>
          <button
            type="button"
            className="student-tutorial-close"
            aria-label="Close tutorial"
            onClick={() => requestClose()}
            autoFocus
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 5l14 14M19 5 5 19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="student-tutorial-body" key={step}>
          <div className="student-tutorial-copy">
            <span className="student-tutorial-eyebrow">{current.eyebrow}</span>
            <h2 id="student-tutorial-title" ref={headingRef} tabIndex={-1}>
              {current.title}
            </h2>
            <p id="student-tutorial-description">{current.description}</p>
          </div>

          <div className="student-tutorial-visual">
            {current.visual === 'join' ? (
              <div className="student-tutorial-join-scene">
                <div className="student-tutorial-projector">
                  <div className="student-tutorial-projector-top">
                    <span>ASKPOOL</span>
                    <span>LIVE LECTURE</span>
                  </div>
                  <strong>Scan to join</strong>
                  <SampleQr />
                  <small>Illustrative example</small>
                </div>
                <div className="student-tutorial-phone" aria-hidden="true">
                  <span className="student-tutorial-phone-camera" />
                  <span className="student-tutorial-phone-scan" />
                  <span>Point your camera at the code</span>
                </div>
              </div>
            ) : current.visual === 'ask' ? (
              <AskPreview />
            ) : current.visual === 'vote' ? (
              <VotePreview />
            ) : current.visual === 'queue' ? (
              <>
                <QueuePreview />
                <span className="student-tutorial-pov">PROFESSOR POV</span>
              </>
            ) : null}
          </div>
        </div>

        <footer className="student-tutorial-footer">
          <button
            type="button"
            className="student-tutorial-nav"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            <span aria-hidden="true">←</span> Back
          </button>
          <nav className="student-tutorial-dots" aria-label="Tutorial steps">
            {steps.map((item, index) => (
              <button
                key={item.eyebrow}
                type="button"
                className={index === step ? 'is-active' : ''}
                aria-label={`Go to step ${index + 1}: ${item.title}`}
                aria-current={index === step ? 'step' : undefined}
                onClick={() => setStep(index)}
              />
            ))}
          </nav>
          <button
            type="button"
            className="student-tutorial-nav student-tutorial-nav--next"
            onClick={() =>
              step === steps.length - 1 ? requestClose(true) : setStep(step + 1)
            }
          >
            {step === steps.length - 1 ? 'Got it' : 'Next'}
            <span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
    </dialog>
  )
}
