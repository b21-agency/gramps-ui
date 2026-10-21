import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'
import { FilePlus2, FilePen, FileX2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRaw } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { timeAgo } from '@/lib/format'
import { DetailSection } from './sections'

interface ObjectChange {
  trans_type: 0 | 1 | 2
  timestamp: number
  transaction_id?: number
  connection?: { user?: { name?: string; full_name?: string } }
}

const PAGE = 10
const MAX = 50
const verbs = ['added', 'changed', 'deleted'] as const
const icons = [FilePlus2, FilePen, FileX2]

/**
 * "History" section of an object page: the changes recorded for this object
 * (`/transactions/history/objects/{Class}/{handle}`), each linking to its revision.
 * Only shown to users who may see private records (the endpoint requires it).
 */
export function ObjectHistory({ objClass, handle, lastChange, id = 'history' }: { objClass: string; handle: string; lastChange?: number; id?: string }) {
  const { t, i18n } = useTranslation(['revisions', 'detail'])
  const { can } = useAuth()
  const allowed = can('ViewPrivate')
  const q = useInfiniteQuery({
    queryKey: ['object-history', objClass, handle, lastChange],
    enabled: allowed && !!handle,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiRaw<ObjectChange[]>(`/transactions/history/objects/${objClass}/${handle}`, {
        query: { sort: '-id', page: pageParam, pagesize: PAGE },
      }),
    getNextPageParam: (last, all) => {
      const n = all.reduce((s, p) => s + p.data.length, 0)
      return n < (last.total ?? 0) && n < MAX && last.data.length === PAGE ? all.length + 1 : undefined
    },
  })
  if (!allowed) return null
  const items = q.data?.pages.flatMap((p) => p.data) ?? []
  const total = q.data?.pages[0]?.total ?? 0
  return (
    <DetailSection id={id} title={t('detail:sections.revisions')} count={total || undefined}>
      {q.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : items.length === 0 ? (
        lastChange ? (
          <p className="text-sm text-muted-foreground">{t('objectHistory.lastChanged', { when: timeAgo(lastChange, i18n.language) })}</p>
        ) : null
      ) : (
        <>
          <ol className="space-y-0.5">
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
                    <Link to={`/revision/${c.transaction_id}`} className="-mx-2 flex gap-3 rounded-lg px-2 py-1.5 hover:bg-accent">
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
    </DetailSection>
  )
}
