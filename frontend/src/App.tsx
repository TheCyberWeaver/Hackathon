import { useState } from 'react'
import StatusBadge from './components/StatusBadge'
import { getHello } from './lib/api'

export default function App() {
  const [status, setStatus] = useState<
    'ready' | 'loading' | 'success' | 'error'
  >('ready')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function connect() {
    setStatus('loading')
    setError('')
    try {
      setMessage((await getHello()).message)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <a
            href="/"
            className="flex items-center gap-3 font-semibold tracking-tight"
          >
            <span
              className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white"
              aria-hidden="true"
            >
              H
            </span>
            Hackathon
          </a>
          <span className="text-sm text-slate-500">
            Your next idea starts here
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
        <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-indigo-600">
          STARTER PROJECT
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Less setup.
          <br />
          More building.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-500">
          A clean starting point for your hackathon. Connect the interface to
          Java, then make it your own.
        </p>

        <section
          aria-labelledby="connection-title"
          className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 id="connection-title" className="text-lg font-semibold">
                Make the first connection
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Send a request to the backend and see the response.
              </p>
            </div>
            <div aria-live="polite">
              <StatusBadge status={status} />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm">
            <span className="text-xs font-bold text-emerald-700">GET</span>
            <code>/api/hello</code>
          </div>
          <button
            onClick={connect}
            disabled={status === 'loading'}
            aria-busy={status === 'loading'}
            className="mt-5 inline-flex items-center gap-3 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 disabled:opacity-60"
          >
            {status === 'loading' ? 'Connecting...' : 'Call Java API'}
            <span aria-hidden="true">→</span>
          </button>

          {status === 'success' && (
            <div
              className="mt-6 border-t border-slate-100 pt-5"
              aria-live="polite"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Response
              </p>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm leading-6 text-emerald-300">
                {JSON.stringify({ message }, null, 2)}
              </pre>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-700"
            >
              {error}. Check that the Java backend is running, then try again.
            </p>
          )}
        </section>

        <section
          aria-label="Project stack"
          className="mt-6 grid gap-4 sm:grid-cols-3"
        >
          {[
            ['Interface', 'React + TypeScript', 'Fast feedback with Vite'],
            ['Styles', 'Tailwind CSS v4', 'Utility classes, ready to use'],
            ['Backend', 'Java 21 + Spring Boot', 'A REST API you can extend'],
          ].map(([label, title, description]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <h2 className="mt-2 text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {description}
              </p>
            </div>
          ))}
        </section>
        <p className="mt-8 text-center text-xs leading-6 text-slate-400">
          Build one working feature. Then build the next.
        </p>
      </main>
    </div>
  )
}
