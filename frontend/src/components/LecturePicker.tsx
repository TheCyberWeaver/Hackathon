import { useState } from 'react'
import { createLecture, type Lecture } from '../lib/poolApi'

type Props = {
  lectures: Lecture[]
  lectureId: string
  onSelect: (id: string) => void
  onCreated?: (lecture: Lecture) => void
  disabled?: boolean
}

export default function LecturePicker({
  lectures,
  lectureId,
  onSelect,
  onCreated,
  disabled,
}: Props) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const joinLink = lectureId
    ? `${window.location.origin}/student?lecture=${encodeURIComponent(lectureId)}`
    : ''
  return (
    <div className="my-4 space-y-3 text-sm">
      <label className="flex flex-wrap items-center gap-2">
        Lecture
        <select
          className="max-w-full rounded border border-slate-300 bg-white p-2 text-slate-900"
          value={lectureId}
          disabled={disabled || busy}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="" disabled>
            Choose a lecture
          </option>
          {lectures.map((lecture) => (
            <option key={lecture.id} value={lecture.id}>
              {lecture.title} — {new Date(lecture.lectureTime).toLocaleString()}
            </option>
          ))}
        </select>
      </label>
      {lectures.length === 0 && <p>No lectures are available yet.</p>}
      {onCreated && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            setError('')
            try {
              const lecture = await createLecture(
                title.trim(),
                new Date().toISOString(),
              )
              onCreated(lecture)
              setTitle('')
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Could not create lecture.',
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          <input
            className="rounded border border-slate-300 p-2"
            aria-label="New lecture title"
            placeholder="New lecture title"
            maxLength={200}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button
            className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
            disabled={disabled || busy || !title.trim()}
          >
            Create lecture
          </button>
        </form>
      )}
      {onCreated && joinLink && (
        <p>
          Student join link:{' '}
          <a className="break-all text-blue-700 underline" href={joinLink}>
            {joinLink}
          </a>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
