import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlert, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation()
  const status = (error as { status?: number })?.status
  const message =
    status === 404
      ? t('error.notFound')
      : error instanceof TypeError
        ? t('error.network')
        : error instanceof ApiError
          ? error.message
          : String((error as Error)?.message ?? error)
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-16 text-center', className)}>
      <CircleAlert className="size-8 text-destructive" aria-hidden />
      <div>
        <p className="font-serif text-lg">{status === 404 ? t('noResults') : t('error.title')}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && status !== 404 && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon = SearchX,
  title,
  children,
  className,
}: {
  icon?: typeof SearchX
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-14 text-center', className)}>
      <Icon className="size-7 text-muted-foreground/70" aria-hidden />
      <p className="font-serif text-lg">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

export function RowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" style={{ opacity: 1 - i / (rows + 2) }} />
      ))}
    </div>
  )
}
