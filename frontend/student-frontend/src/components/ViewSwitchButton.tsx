import { SwitchIcon } from './Icons'

type Props = {
  showingMine: boolean
  onClick: () => void
}

export function ViewSwitchButton({ showingMine, onClick }: Props) {
  return (
    <button
      type="button"
      className="view-switch"
      onClick={onClick}
      aria-label={`Show ${showingMine ? 'other' : 'your'} questions`}
      title={`Show ${showingMine ? 'other' : 'your'} questions`}
    >
      <SwitchIcon width="20" height="20" />
    </button>
  )
}
