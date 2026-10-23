import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ChevronLeft, ChevronRight, History, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/states'
import { ObjectThumb } from '@/components/object-thumb'
import { useGetTransactionsHistoryQuery } from '@/api/enhanced/transactions-slice-enhanced'
import { formatTimestamp, timeAgo } from '@/lib/format'
import type { MediaRef } from '@/lib/types'
import { cn } from '@/lib/utils'
import { changeObject, isUndo, objectKind, rawTitle, summarize, transVerb, useTypeMaps, type Change, type Transaction, type TypeMaps } from './history'
import { ClassIcon } from './parts'

export const PAGE_SIZE = 20

/** True while the viewport is at least `px` wide (for split views that only exist on wide screens). */
export function useMinWidth(px: number) {
  const query = `(min-width: ${px}px)`
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const on = () => setMatch(mql.matches)
    on()
    mql.addEventListener('change', on)
    return () => mql.removeEventListener('change', on)
  }, [query])
  return match
}

/** Gramps descriptions like "Merge People" or "Import" say more than the derived headline; plain add/edit/delete ones do not. */
function informative(description: string | undefined) {
  return !!description && !/^(add|new|edit|update|delete|remove)\b/i.test(description.trim())
}

const dayKey = (ts: number) => new Date(ts * 1000).toDateString()

function dayLabel(ts: number, lang: string) {
  const d = new Date(ts * 1000)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }).format(d)
}

/** Colour of the verb pill: added = moss/primary, deleted = destructive, changed = gold. */
export const verbTone: Record<(typeof transVerb)[number], string> = {
  added: 'bg-chart-1/15 text-chart-1',
  changed: 'bg-brass/15 text-brass',
  deleted: 'bg-destructive/15 text-destructive',
}

/** The picture for a change: the person's portrait / the photo itself, else the record kind's icon. */
export function ChangeThumb({ change, size = 44, className }: { change?: Change | null; size?: number; className?: string }) {
  const kind = change ? objectKind(change.obj_class) : null
  if (!change || !kind)
    return (
      <span
        className={cn('inline-flex shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground', className)}
        style={{ width: size, height: size }}
      >
        <ClassIcon cls={change?.obj_class} className="size-[18px]" />
      </span>
    )
  const o = changeObject(change)
  const media = (o?.media_list as MediaRef[] | undefined)?.[0]
  const gender = o?.gender as number | undefined
  const name = typeof o?.gramps_id === 'string' ? o.gramps_id : ''
  return (
    <ObjectThumb
      kind={kind}
      handle={change.obj_handle}
      mediaRef={media ? { ref: media.ref, rect: media.rect } : null}
      name={name}
      sex={gender === 0 ? 'F' : gender === 1 ? 'M' : undefined}
      size={size}
      className={className}
    />
  )
}

/**
 * The change history as a timeline grouped by day: gold serif day headings, a thin line,
 * every entry with the face/photo of the changed record. Used full width on /revisions and
 * as the left column next to a change on wide screens.
 */
export function RevisionTimeline({
  page,
  onPage,
  activeId,
  linkSuffix = '',
  compact,
}: {
  page: number
  onPage: (p: number) => void
  activeId?: number
  linkSuffix?: string
  compact?: boolean
}) {
  const { t, i18n } = useTranslation('revisions')
  const { data: maps } = useTypeMaps()
  // `data` keeps the previous page while the next one loads
  const q = useGetTransactionsHistoryQuery({ page, pagesize: PAGE_SIZE, sort: '-id', old: true, new: true })
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / PAGE_SIZE)) : 1
  const lang = i18n.language

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!q.data)
    return (
      <div className="space-y-3">
        <Skeleton className="h-7 w-48" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    )
  if (!q.data.items.length)
    return (
      <EmptyState icon={History} title={t('empty.title')}>
        {t('empty.body')}
      </EmptyState>
    )

  const days: Array<{ key: string; ts: number; items: Transaction[] }> = []
  for (const tx of q.data.items) {
    const k = dayKey(tx.timestamp)
    const last = days[days.length - 1]
    if (last?.key === k) last.items.push(tx)
    else days.push({ key: k, ts: tx.timestamp, items: [tx] })
  }

  return (
    <>
      <div className={cn('space-y-8', q.isFetching && 'opacity-70 transition-opacity')}>
        {days.map((d) => (
          <section key={d.key} aria-label={dayLabel(d.ts, lang)}>
            <h2 className={cn('mb-3 font-serif font-medium text-brass', compact ? 'text-xl' : 'text-2xl')}>{dayLabel(d.ts, lang)}</h2>
            <ol className="relative">
              <span aria-hidden className="absolute top-6 bottom-6 left-[1.875rem] w-0.5 rounded-full bg-lineage/50" />
              {d.items.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  maps={maps}
                  t={t}
                  lang={lang}
                  active={tx.id === activeId}
                  to={`/revision/${tx.id}${linkSuffix}`}
                />
              ))}
            </ol>
          </section>
        ))}
      </div>
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label={t('pagination')}>
          <Button variant="secondary" className="h-11 rounded-full px-4 sm:h-10" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft />
            {t('newer')}
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">{t('pageOf', { page, pages })}</span>
          <Button variant="secondary" className="h-11 rounded-full px-4 sm:h-10" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            {t('older')}
            <ChevronRight />
          </Button>
        </nav>
      )}
    </>
  )
}

function TransactionRow({
  tx,
  maps,
  t,
  lang,
  active,
  to,
}: {
  tx: Transaction
  maps?: TypeMaps
  t: TFunction
  lang: string
  active?: boolean
  to: string
}) {
  const { headline, more, first } = summarize(tx, maps, t)
  const who = tx.connection?.user?.full_name || tx.connection?.user?.name
  const verb = first ? transVerb[first.trans_type] : null
  const title = first ? rawTitle(first.obj_class, changeObject(first), maps, t) : ''
  const time = new Intl.DateTimeFormat(lang, { timeStyle: 'short' }).format(tx.timestamp * 1000)
  return (
    <li>
      <Link
        to={to}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex items-center gap-3 rounded-2xl px-2 py-2.5 outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent sm:gap-4',
          active && 'bg-accent',
        )}
      >
        <span className="relative z-10 rounded-xl ring-4 ring-card">
          <ChangeThumb change={first} size={44} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            {first && title ? title : headline}
            {more > 0 && <span className="font-normal text-muted-foreground"> {t('andMore', { count: more })}</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {verb && (
              <span className={cn('rounded-full px-2 py-px font-medium', verbTone[verb])}>
                {t(`verb.${verb}`)} · {t(`objectClass.${first!.obj_class}`, { defaultValue: first!.obj_class })}
              </span>
            )}
            {who && <span>{who}</span>}
            {first && informative(tx.description) && <span>{tx.description}</span>}
            {isUndo(tx) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-px">
                <Undo2 className="size-3" />
                {t('undoBadge')}
              </span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs text-muted-foreground" title={`${formatTimestamp(tx.timestamp, lang)} · ${timeAgo(tx.timestamp, lang)}`}>
          <span className="block tabular-nums">{time}</span>
          <span className="block tabular-nums">#{tx.id}</span>
        </span>
      </Link>
    </li>
  )
}

/** Timeline on the left, the selected change on the right (xl+); one column below. */
export function RevisionsSplit({ timeline, detail }: { timeline: ReactNode; detail: ReactNode }) {
  return (
    <div className={detail ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]' : ''}>
      <div className={detail ? 'min-w-0 rounded-3xl bg-card p-4 sm:p-5 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto' : 'min-w-0 rounded-3xl bg-card p-4 sm:p-6'}>
        {timeline}
      </div>
      {detail && <div className="min-w-0">{detail}</div>}
    </div>
  )
}
