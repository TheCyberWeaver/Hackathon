import { useEffect, useRef } from 'react'
import type { Lecture } from '../lib/poolApi'
import { sessionStart } from '../lib/courseHistory'
import './SessionRemovalDialog.css'

type Props = {
  lecture: Lecture
  everyone?: boolean
  busy: boolean
  error: string
  onCancel: () => void
  onConfirm: () => void
}

export default function SessionRemovalDialog({
  lecture,
  everyone = false,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const trigger = document.activeElement
    const dialog = dialogRef.current
    dialog?.showModal()
    cancelRef.current?.focus()
    return () => {
      dialog?.close()
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus()
      else document.querySelector<HTMLElement>('.course-history h1')?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialogRef}
      className="session-removal-dialog"
      aria-labelledby="session-removal-title"
      aria-describedby="session-removal-description"
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <h2 id="session-removal-title">
        {everyone
          ? 'Delete this session for everyone?'
          : 'Remove this session from your history?'}
      </h2>
      <p className="session-removal-context">
        <strong>{lecture.title}</strong>
        <span>
          {sessionStart(lecture).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      </p>
      <p id="session-removal-description">
        {everyone
          ? 'This permanently deletes this session and all its questions for everyone in the course, including students. Other sessions will remain. This cannot be undone.'
          : 'This removes this session from your history only. The professor and other students will still have access to it.'}
      </p>
      {error && (
        <p className="session-removal-error" role="alert">
          {error}
        </p>
      )}
      <div className="session-removal-actions">
        <button
          ref={cancelRef}
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="session-removal-confirm"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy
            ? everyone
              ? 'Deleting…'
              : 'Removing…'
            : everyone
              ? 'Delete session'
              : 'Remove from history'}
        </button>
      </div>
    </dialog>
  )
}
