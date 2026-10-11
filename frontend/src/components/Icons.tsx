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
      <path d="M10.3 2h3.4l.4 2 1.7.7 1.7-1.1 2.9 2.9-1.1 1.7.7 1.7 2 .4v3.4l-2 .4-.7 1.7 1.1 1.7-2.9 2.9-1.7-1.1-1.7.7-.4 2h-3.4l-.4-2-1.7-.7-1.7 1.1-2.9-2.9 1.1-1.7-.7-1.7-2-.4v-3.4l2-.4.7-1.7-1.1-1.7 2.9-2.9 1.7 1.1 1.7-.7.4-2Z" />
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
