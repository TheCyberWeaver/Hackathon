import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import './student-tutorial.css'

const steps = [
  {
    eyebrow: '01 / JOIN',
    title: 'Join your lecture',
    description:
      'Your professor shares a QR code. Scan it with your phone to open the lecture question pool.',
    note: 'One scan takes you to the right session.',
  },
  {
    eyebrow: '02 / ASK',
    title: 'Ask what is on your mind',
    description:
      'Type your question and tap the arrow to send it. Your name is hidden from classmates; professors can view authors.',
    note: 'A good question can help the whole room.',
    image: '/tutorial/student-ask.jpg',
    imageAlt: 'AskPool student page with an example question in the composer',
  },
  {
    eyebrow: '03 / VOTE',
    title: 'Like questions you share',
    description:
      'Browse the question pool and tap the thumbs-up beside a question you also want answered.',
    note: 'More likes move a question higher in the queue.',
    image: '/tutorial/student-vote.jpg',
    imageAlt:
      'AskPool student question list with example questions and vote counts',
  },
  {
    eyebrow: '04 / PROFESSOR POV',
    title: 'The top question gets noticed',
    description:
      'On the professor dashboard, questions with the most likes appear at the top. That puts what matters most to students where the professor sees it first.',
    note: 'The professor can then work through and answer questions.',
    image: '/tutorial/professor-queue.jpg',
    imageAlt:
      'AskPool professor dashboard showing example questions ranked by their number of likes',
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
            <div className="student-tutorial-note">
              <span aria-hidden="true">✦</span>
              {current.note}
            </div>
          </div>

          <div className="student-tutorial-visual">
            {'image' in current ? (
              <>
                <img
                  className={`student-tutorial-image student-tutorial-image--${step}`}
                  src={current.image}
                  alt={current.imageAlt}
                />
                {step === 3 && (
                  <span className="student-tutorial-pov">PROFESSOR POV</span>
                )}
              </>
            ) : (
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
            )}
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
