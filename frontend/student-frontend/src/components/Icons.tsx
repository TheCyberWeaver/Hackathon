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

export function ProfileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
    </Icon>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M10 2.5h4l.5 2.1a7.8 7.8 0 0 1 1.8.8l1.9-1.1 2.8 2.8-1.1 1.9c.4.6.6 1.2.8 1.8l2.1.5v4l-2.1.5a7.8 7.8 0 0 1-.8 1.8l1.1 1.9-2.8 2.8-1.9-1.1a7.8 7.8 0 0 1-1.8.8L14 23h-4l-.5-2.1a7.8 7.8 0 0 1-1.8-.8l-1.9 1.1L3 18.4l1.1-1.9a7.8 7.8 0 0 1-.8-1.8L1.2 14v-4l2.1-.5a7.8 7.8 0 0 1 .8-1.8L3 5.8 5.8 3l1.9 1.1a7.8 7.8 0 0 1 1.8-.8L10 2.5Z"
        transform="translate(0 0) scale(.96)"
      />
      <circle cx="11.5" cy="12.2" r="3" />
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

export function LikeIcon({
  filled = false,
  ...props
}: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props}>
      <path
        d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 4.3-6.6A2 2 0 0 1 13 2.5c.9 0 1.5.8 1.3 1.7L13.4 8H19a2.5 2.5 0 0 1 2.4 3.2l-2.1 7.8A2.5 2.5 0 0 1 16.9 21H7"
        fill={filled ? 'currentColor' : 'none'}
      />
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
