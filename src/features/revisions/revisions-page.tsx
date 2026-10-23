import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ShieldOff } from 'lucide-react'
import { AlbumPage } from '@/components/album-page'
import { EmptyState } from '@/components/states'
import { useGetTransactionsHistoryQuery } from '@/api/enhanced/transactions-slice-enhanced'
import { useAuth } from '@/lib/auth'
import { useTitle } from '@/hooks/use-title'
import { ObjectRevisions, objectClassName } from './object-revisions'
import { PAGE_SIZE, RevisionTimeline, RevisionsSplit, useMinWidth } from './timeline'
import { RevisionDetail } from './revision-page'

export function RevisionsPage() {
  const { t } = useTranslation('revisions')
  const { can } = useAuth()
  useTitle(t('title'))
  if (!can('ViewPrivate'))
    return (
      <AlbumPage title={t('title')}>
        <div className="rounded-3xl bg-card">
          <EmptyState icon={ShieldOff} title={t('noAccess.title')}>
            {t('noAccess.body')}
          </EmptyState>
        </div>
      </AlbumPage>
    )
  return <RevisionsList />
}

/** /revisions?class=Person&handle=… shows the history of one object. */
function ObjectHistory({ cls, handle }: { cls: string; handle: string }) {
  const { t } = useTranslation('revisions')
  return (
    <AlbumPage
      back={
        <Link
          to="/revisions"
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground sm:h-9"
        >
          <ChevronLeft className="size-4" />
          {t('title')}
        </Link>
      }
      title={t('object.title')}
      description={t('object.description', { object: t(`objectClass.${objectClassName(cls)}`, { defaultValue: cls }) })}
    >
      <div className="max-w-3xl rounded-3xl bg-card p-5 sm:p-6">
        <ObjectRevisions cls={cls} handle={handle} />
      </div>
    </AlbumPage>
  )
}

function RevisionsList() {
  const { t } = useTranslation('revisions')
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const objCls = params.get('class')
  const objHandle = params.get('handle')
  const wide = useMinWidth(1280)
  // same cache entry as the timeline: the newest change of the page opens next to it on wide screens
  const q = useGetTransactionsHistoryQuery({ page, pagesize: PAGE_SIZE, sort: '-id', old: true, new: true }, { skip: !!(objCls && objHandle) || !wide })
  const go = (p: number) => {
    setParams(p > 1 ? { page: String(p) } : {})
    window.scrollTo({ top: 0 })
  }

  if (objCls && objHandle) return <ObjectHistory cls={objCls} handle={objHandle} />
  const firstId = q.data?.items[0]?.id

  return (
    <AlbumPage title={t('title')} description={t('description')}>
      <RevisionsSplit
        timeline={<RevisionTimeline page={page} onPage={go} activeId={wide ? firstId : undefined} linkSuffix={page > 1 ? `?page=${page}` : ''} compact={wide} />}
        detail={wide && firstId != null ? <RevisionDetail id={firstId} embedded /> : null}
      />
    </AlbumPage>
  )
}
