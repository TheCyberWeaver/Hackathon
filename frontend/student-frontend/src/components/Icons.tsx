import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function PanelIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Icon>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </Icon>
  )
}

export function UpIcon({
  filled = false,
  ...props
}: IconProps & { filled?: boolean }) {
  if (filled) {
    return (
      <Icon {...props} stroke="none">
        <path d="M12 3 3 12h5.4v9h7.2v-9H21L12 3Z" fill="currentColor" />
      </Icon>
    )
  }
  return (
    <Icon {...props}>
      <path d="M12 19V5m-6 6 6-6 6 6" />
    </Icon>
  )
}

export function SwitchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4" />
    </Icon>
  )
}

export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12 4 4L19 6" />
    </Icon>
  )
}
