import { cn } from '@/lib/utils'

/** Three generations joined: two parents above, one child below. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('text-primary', className)}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <g fill="none" stroke="var(--primary-foreground)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M16 25V15" />
        <path d="M16 15c-4 0-6-2.5-6-6" />
        <path d="M16 15c4 0 6-2.5 6-6" />
      </g>
      <g fill="var(--primary-foreground)">
        <circle cx="10" cy="8" r="2.6" />
        <circle cx="22" cy="8" r="2.6" />
        <circle cx="16" cy="26" r="2.6" />
      </g>
    </svg>
  )
}
