import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, History, ShieldOff, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Page } from '@/components/app-shell'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { apiRaw } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatTimestamp, timeAgo } from '@/lib/format'
import { useTitle } from '@/hooks/use-title'
import { isUndo, summarize, useTypeMaps, type Transaction, type TypeMaps } from './history'
import { ClassIcon } from './parts'
import type { TFunction } from 'i18next'

const PAGE_SIZE = 20

export function RevisionsPage() {
  const { t } = useTranslation('revisions')
  const { can } = useAuth()
  useTitle(t('title'))
  if (!can('ViewPrivate'))
    return (
      <Page title={t('title')}>
        <EmptyState icon={ShieldOff} title={t('noAccess.title')}>
          {t('noAccess.body')}
        </EmptyState>
      </Page>
    )
  return <RevisionsList />
}

function RevisionsList() {
  const { t, i18n } = useTranslation('revisions')
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data: maps } = useTypeMaps()
  const q = useQuery({
    queryKey: ['transactions', 'history', 'list', page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const r = await apiRaw<Transaction[]>('/transactions/history/', {
        query: { sort: '-id', page, pagesize: PAGE_SIZE, old: 1, new: 1 },
      })
      return { items: r.data, total: r.total ?? r.data.length }
    },
  })
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / PAGE_SIZE)) : 1
  const go = (p: number) => {
    setParams(p > 1 ? { page: String(p) } : {})
    window.scrollTo({ top: 0 })
  }

  return (
    <Page title={t('title')} description={t('description')}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <RowsSkeleton rows={10} />
      ) : !q.data.items.length ? (
        <EmptyState icon={History} title={t('empty.title')}>
          {t('empty.body')}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card">
            {q.data.items.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} maps={maps} t={t} lang={i18n.language} />
            ))}
          </ul>
          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t('pagination')}>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
                <ChevronLeft />
                {t('newer')}
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">{t('pageOf', { page, pages })}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => go(page + 1)}>
                {t('older')}
                <ChevronRight />
              </Button>
            </nav>
          )}
        </>
      )}
    </Page>
  )
}

function TransactionRow({ tx, maps, t, lang }: { tx: Transaction; maps?: TypeMaps; t: TFunction; lang: string }) {
  const { headline, more, first } = summarize(tx, maps, t)
  const who = tx.connection?.user?.full_name || tx.connection?.user?.name
  return (
    <li>
      <Link to={`/revision/${tx.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/60 sm:items-center">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground sm:mt-0">
          <ClassIcon cls={first?.obj_class} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            {headline}
            {more > 0 && <span className="text-muted-foreground"> {t('andMore', { count: more })}</span>}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {who && <span>{who}</span>}
            {isUndo(tx) && (
              <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px">
                <Undo2 className="size-3" />
                {t('undoBadge')}
              </span>
            )}
            <span className="sm:hidden" title={formatTimestamp(tx.timestamp, lang)}>
              {timeAgo(tx.timestamp, lang)}
            </span>
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block" title={formatTimestamp(tx.timestamp, lang)}>
          {timeAgo(tx.timestamp, lang)}
          <span className="block tabular-nums">#{tx.id}</span>
        </span>
      </Link>
    </li>
  )
}
