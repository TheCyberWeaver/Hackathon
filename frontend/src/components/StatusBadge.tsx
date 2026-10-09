type StatusBadgeProps = { status: 'ready' | 'loading' | 'success' | 'error' }

const labels = {
  ready: 'Ready to connect',
  loading: 'Connecting',
  success: 'API connected',
  error: 'Connection failed',
}
const tones = {
  ready: 'bg-slate-100 text-slate-600',
  loading: 'bg-indigo-50 text-indigo-700',
  success: 'bg-emerald-50 text-emerald-800',
  error: 'bg-red-50 text-red-700',
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ' +
        tones[status]
      }
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {labels[status]}
    </span>
  )
}
