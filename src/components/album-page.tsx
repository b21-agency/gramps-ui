import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * Page frame for the non-object screens in the "Album" direction (blog, tasks, tools,
 * settings, DNA …): full content width, big serif headline, a quiet intro line and the
 * main actions as pills. Mirrors the home page header.
 */

export function AlbumPage({
  title,
  lead,
  description,
  actions,
  children,
  className,
  back,
}: {
  title?: ReactNode
  /** small gold line above the title (date, context) */
  lead?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** small link row above the header (e.g. "All posts") */
  back?: ReactNode
}) {
  return (
    <div className={cn(albumFrame, className)}>
      {back && <div className="-ml-2 mb-4">{back}</div>}
      {(title || actions) && <AlbumHeader title={title} lead={lead} description={description} actions={actions} />}
      {children}
    </div>
  )
}

export function AlbumHeader({
  title,
  lead,
  description,
  actions,
  className,
}: {
  title?: ReactNode
  lead?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-8 flex flex-col gap-5 sm:mb-10 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="min-w-0">
        {lead && <p className="mb-2 text-sm font-semibold text-brass">{lead}</p>}
        {title && (
          <h1 className="font-serif text-[2.6rem] font-medium leading-[1] tracking-[-0.02em] text-balance [overflow-wrap:anywhere] sm:text-6xl lg:text-[4rem]">
            {title}
          </h1>
        )}
        {description && <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Full-width page padding shared by all album screens. */
export const albumFrame = 'px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14'

/** Pill button sizing used across album screens: 44px on phones, 40px from sm up. */
export const pill = 'h-11 rounded-full px-5 text-sm sm:h-10'

/** Panel-like surface without a title (for lists that bring their own headings). */
export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('min-w-0 rounded-3xl bg-card p-5 sm:p-6', className)}>{children}</section>
}
