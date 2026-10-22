// Change history of one object (GET /transactions/history/objects/{Class}/{handle}).
// Usable on object pages (<ObjectRevisions cls="Person" handle=… />) and via /revisions?class=Person&handle=….
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { OBJECT_HISTORY_MAX_ITEMS as MAX_ITEMS, useRevisionsObjectHistoryInfiniteQuery } from '@/api/enhanced/revisions'
import { useAuth } from '@/lib/auth'
import { formatTimestamp, timeAgo } from '@/lib/format'
import { transVerb } from './history'
import { ClassIcon } from './parts'

/** Normalises "person" / "Person" to the API class name. */
export function objectClassName(kind: string) {
  const k = kind.toLowerCase()
  return k.charAt(0).toUpperCase() + k.slice(1)
}

export function ObjectRevisions({ cls, handle, lastChange }: { cls: string; handle: string; lastChange?: number }) {
  const { t, i18n } = useTranslation('revisions')
  const { can } = useAuth()
  const objClass = objectClassName(cls)
  // only the most recent revisions are listed (see objectHistory)
  const q = useRevisionsObjectHistoryInfiniteQuery(can('ViewPrivate') && handle ? { objClass, handle } : skipToken)

  if (!can('ViewPrivate')) return null
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-6" />
  if (!q.data) return <RowsSkeleton rows={3} />

  const items = q.data.pages.flatMap((p) => p.items)
  const total = q.data.pages[0]?.total ?? 0
  const lang = i18n.language

  return (
    <div className="space-y-3">
      {!!lastChange && (
        <p className="text-sm text-muted-foreground">
          {t('object.lastChanged', { when: timeAgo(lastChange, lang) })}
          <span className="ml-1 tabular-nums">({formatTimestamp(lastChange, lang)})</span>
        </p>
      )}
      {!items.length ? (
        <EmptyState icon={History} title={t('object.empty')} className="py-8" />
      ) : (
        <ul className="grid gap-0.5">
          {items.map((c, i) => {
            const who = c.connection?.user?.full_name || c.connection?.user?.name || t('object.unknownUser')
            const body = (
              <>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <ClassIcon cls={c.obj_class} className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{t(`verb.${transVerb[c.trans_type] ?? 'changed'}`)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{who}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground" title={formatTimestamp(c.timestamp, lang)}>
                  {timeAgo(c.timestamp, lang)}
                  {c.transaction_id != null && <span className="block tabular-nums">#{c.transaction_id}</span>}
                </span>
              </>
            )
            return (
              <li key={`${c.transaction_id ?? 'x'}-${i}`}>
                {c.transaction_id != null ? (
                  <Link to={`/revision/${c.transaction_id}`} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors duration-150 hover:bg-accent">
                    {body}
                  </Link>
                ) : (
                  <div className="-mx-2 flex items-center gap-3 px-2 py-2">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {items.length < total &&
        (items.length >= MAX_ITEMS ? (
          <p className="text-sm text-muted-foreground">{t('object.onlyRecent')}</p>
        ) : (
          <Button variant="secondary" className="h-11 rounded-full px-4 sm:h-9" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            {q.isFetchingNextPage && <Loader2 className="animate-spin" />}
            {t('object.showMore')}
          </Button>
        ))}
    </div>
  )
}
