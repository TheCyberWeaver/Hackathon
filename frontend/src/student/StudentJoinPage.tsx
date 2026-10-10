import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { parseJoinCode } from '../lib/sessions'

function CameraScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onCodeRef = useRef(onCode)
  const [error, setError] = useState(() =>
    !window.isSecureContext || !navigator.mediaDevices?.getUserMedia
      ? 'Camera scanning needs HTTPS or localhost. You can enter the code instead.'
      : '',
  )

  useEffect(() => {
    onCodeRef.current = onCode
  }, [onCode])

  useEffect(() => {
    let disposed = false
    let controls: IScannerControls | undefined
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      return
    }
    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        if (disposed || !videoRef.current) return
        const reader = new BrowserQRCodeReader()
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current,
          (result, _error, scanControls) => {
            if (!result || disposed) return
            const code = parseJoinCode(result.getText())
            if (!code) {
              setError('This QR code is not an AskPool lecture link.')
              return
            }
            scanControls.stop()
            onCodeRef.current(code)
          },
        )
        if (disposed) controls.stop()
      } catch {
        if (!disposed)
          setError(
            'Could not use the camera. Check permission or enter the code instead.',
          )
      }
    }
    void startScanner()
    return () => {
      disposed = true
      controls?.stop()
    }
  }, [])

  return (
    <div className="student-join-scanner">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="QR scanner camera preview"
      />
      <p className="student-join-scanner-hint">
        Point your camera at the professor’s QR code.
      </p>
      {error && (
        <p role="alert" className="student-join-error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="student-join-secondary"
        onClick={onClose}
      >
        Close camera
      </button>
    </div>
  )
}

export default function StudentJoinPage({
  busy,
  checking,
  error,
  onJoin,
}: {
  busy: boolean
  checking: boolean
  error: string
  onJoin: (code: string) => void
}) {
  const [code, setCode] = useState(
    () => new URLSearchParams(window.location.search).get('code') || '',
  )
  const [localError, setLocalError] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)

  function submit(value: string) {
    const parsed = parseJoinCode(value)
    if (!parsed) {
      setLocalError('Enter the numeric lecture ID shown by your professor.')
      return
    }
    setLocalError('')
    onJoin(parsed)
  }

  return (
    <main className="student-join-page">
      <section
        className="student-join-content"
        aria-labelledby="student-join-title"
      >
        <p className="student-join-eyebrow">JOIN A LECTURE</p>
        <h1 id="student-join-title">Join your class</h1>
        <p className="student-join-intro">
          Enter the code your professor shared, or scan the QR code to open this
          lecture question pool.
        </p>
        <div className="student-join-card">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              submit(code)
            }}
          >
            <label htmlFor="student-join-code">Lecture code</label>
            <input
              id="student-join-code"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              maxLength={256}
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                setLocalError('')
              }}
              placeholder="e.g. 42"
              disabled={checking || busy}
              aria-describedby="student-join-help"
            />
            <p id="student-join-help" className="student-join-help">
              Enter the numeric lecture ID shown by your professor.
            </p>
            {(localError || error) && (
              <p role="alert" className="student-join-error">
                {localError || error}
              </p>
            )}
            <button
              type="submit"
              className="student-join-primary"
              disabled={checking || busy}
            >
              {checking
                ? 'Checking your lectures…'
                : busy
                  ? 'Joining…'
                  : 'Join lecture'}
            </button>
          </form>
          <div className="student-join-divider">
            <span>or</span>
          </div>
          {scannerOpen ? (
            <CameraScanner
              onCode={(scannedCode) => {
                setScannerOpen(false)
                setCode(scannedCode)
                submit(scannedCode)
              }}
              onClose={() => setScannerOpen(false)}
            />
          ) : (
            <button
              type="button"
              className="student-join-secondary"
              onClick={() => setScannerOpen(true)}
              disabled={checking || busy}
            >
              Scan QR code with camera
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
