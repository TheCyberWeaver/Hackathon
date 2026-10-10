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
      <rect x="4" y="4.5" width="16" height="15" rx="2" />
      <path d="M10 4.5v15" />
    </Icon>
  )
}

export function ProfileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </Icon>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.8 3.8 10.2 2h3.6l.4 1.8a8.7 8.7 0 0 1 1.8.8l1.6-.9 2.5 2.5-.9 1.6c.3.6.6 1.2.8 1.8l1.8.4v3.6l-1.8.4a8.7 8.7 0 0 1-.8 1.8l.9 1.6-2.5 2.5-1.6-.9a8.7 8.7 0 0 1-1.8.8l-.4 1.8h-3.6l-.4-1.8a8.7 8.7 0 0 1-1.8-.8l-1.6.9-2.5-2.5.9-1.6a8.7 8.7 0 0 1 .8-1.8L2 13.8v-3.6l1.8-.4a8.7 8.7 0 0 1 .8-1.8l-.9-1.6 2.5-2.5 1.6.9a8.7 8.7 0 0 1 1.8-.8Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function ThumbsUpIcon({
  filled = false,
  ...props
}: IconProps & { filled?: boolean }) {
  return (
    <Icon strokeWidth="1.7" {...props}>
      <path
        d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 4.7-7.1A2 2 0 0 1 15.4 4v1.2c0 .5-.1 1-.3 1.5L14 10h5.5a2.5 2.5 0 0 1 2.5 3l-1.4 6a2.5 2.5 0 0 1-2.4 2H7"
        fill={filled ? 'currentColor' : 'none'}
      />
    </Icon>
  )
}
