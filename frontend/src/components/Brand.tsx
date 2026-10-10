export default function Brand() {
  return (
    <a className="brand" href="/" aria-label="AskPool home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M8 7h16a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-9l-7 5v-5a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="11" cy="15" r="1.5" fill="currentColor" />
          <circle cx="16" cy="15" r="1.5" fill="currentColor" />
          <circle cx="21" cy="15" r="1.5" fill="currentColor" />
        </svg>
      </span>
      Ask<span>Pool</span>
      <span className="brand-period">.</span>
    </a>
  )
}
