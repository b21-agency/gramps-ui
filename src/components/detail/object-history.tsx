import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { ChevronUp, FilePen, FilePlus2, FileX2, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useObjectHistoryInfiniteQuery } from '@/api/enhanced/revisions'
import { useAuth } from '@/lib/auth'
import { timeAgo } from '@/lib/format'

const verbs = ['added', 'changed', 'deleted'] as const
const icons = [FilePlus2, FilePen, FileX2]

/**
 * Change history of an object, docked at the bottom of the screen: a small handle
 * ("History · 10 · 9 hours ago") that pulls up a bottom sheet with the full list.
 * Only for users who may see private records (the endpoint requires it).
 */
export function ObjectHistory({ objClass, handle, lastChange }: { objClass: string; handle: string; lastChange?: number; id?: string }) {
  const { t, i18n } = useTranslation(['revisions', 'detail'])
  const { can } = useAuth()
  const allowed = can('ViewPrivate')
  const [open, setOpen] = useState(false)
  // pages of OBJECT_HISTORY_PAGE, up to OBJECT_HISTORY_MAX; refetched after writes (Transactions tag)
  const q = useObjectHistoryInfiniteQuery(allowed && handle ? { objClass, handle, lastChange } : skipToken)
  if (!allowed) return null
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  const total = q.data?.pages[0]?.total ?? 0
  const latest = items[0]?.timestamp ?? lastChange

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(var(--tabbar-h)+0.75rem)] right-4 z-30 flex h-11 items-center gap-2 rounded-full border bg-popover/95 py-1 pl-3 pr-4 text-sm shadow-lg backdrop-blur transition-transform duration-150 ease-out active:scale-[0.97] sm:right-6 lg:right-10 2xl:right-14"
        aria-haspopup="dialog"
        data-dock
      >
        <History className="size-4 text-brass" aria-hidden />
        <span className="font-medium">{t('detail:sections.revisions')}</span>
        {total > 0 && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums">{total}</span>}
        {latest ? <span className="hidden text-xs text-muted-foreground sm:inline">{timeAgo(latest, i18n.language)}</span> : null}
        <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[80dvh] pb-safe">
          <DrawerHeader className="text-left sm:px-8">
            <DrawerTitle className="font-serif text-2xl font-medium">
              {t('detail:sections.revisions')}
              {total > 0 && <span className="ml-2 text-base tabular-nums text-muted-foreground">{total}</span>}
            </DrawerTitle>
            <DrawerDescription>
              {latest ? t('objectHistory.lastChanged', { when: timeAgo(latest, i18n.language) }) : ''}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto overscroll-contain px-4 pb-6 sm:px-8">
            {q.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : items.length === 0 ? null : (
              <>
                <ol className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((c, i) => {
                    const Icon = icons[c.trans_type] ?? FilePen
                    const user = c.connection?.user?.full_name || c.connection?.user?.name
                    const body = (
                      <>
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{t(`verb.${verbs[c.trans_type] ?? 'changed'}`)}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[user && t('by', { name: user }), timeAgo(c.timestamp, i18n.language)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </>
                    )
                    return (
                      <li key={`${c.transaction_id ?? 'x'}-${i}`}>
                        {c.transaction_id ? (
                          <Link
                            to={`/revision/${c.transaction_id}`}
                            onClick={() => setOpen(false)}
                            className="-mx-2 flex min-h-11 gap-3 rounded-lg px-2 py-1.5 hover:bg-accent"
                          >
                            {body}
                          </Link>
                        ) : (
                          <div className="-mx-2 flex gap-3 px-2 py-1.5">{body}</div>
                        )}
                      </li>
                    )
                  })}
                </ol>
                {q.hasNextPage ? (
                  <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                    {t('objectHistory.showMore')}
                  </Button>
                ) : items.length < total ? (
                  <p className="mt-2 text-xs text-muted-foreground">{t('objectHistory.onlyRecent')}</p>
                ) : null}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>,
    document.body,
  )
}
