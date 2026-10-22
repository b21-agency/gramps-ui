import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, Copy, ExternalLink, Minus, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState, RowsSkeleton } from '@/components/states'
import { useMetadata } from '@/lib/queries'
import { SettingsBlock } from './parts'
import { ResearcherBlock } from './admin-extra'
import { useAuth } from '@/lib/auth'

type Meta = Record<string, Record<string, unknown> | undefined>

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words tabular-nums">{children}</dd>
    </div>
  )
}

function YesNo({ value }: { value: unknown }) {
  const { t } = useTranslation('settings')
  return value ? (
    <span className="inline-flex items-center gap-1 text-primary">
      <Check className="size-4" />
      {t('info.on')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus className="size-4" />
      {t('info.off')}
    </span>
  )
}

export function InfoSection() {
  const { t } = useTranslation('settings')
  const q = useMetadata()
  const { tree } = useAuth()
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!q.data) return <RowsSkeleton rows={8} />
  const m = q.data as unknown as Meta
  const db = m.database ?? {}
  const server = (m.server ?? {}) as Record<string, unknown>
  const thumbs = (server.thumbnails ?? {}) as Record<string, unknown>
  const version = (k: string) => (m[k]?.version as string | undefined) ?? '–'

  const copy = () => {
    void navigator.clipboard?.writeText(JSON.stringify(q.data, null, 2))
    toast.success(t('info.copied'))
  }

  const features: Array<[string, unknown]> = [
    ['taskQueue', server.task_queue],
    ['email', server.email],
    ['multiTree', server.multi_tree],
    ['semanticSearch', server.semantic_search],
    ['chat', server.chat],
    ['ocr', server.ocr],
    ['faceDetection', server.face_detection],
    ['backups', server.backups],
    ['pdfThumbnails', thumbs.pdf],
    ['videoThumbnails', thumbs.video],
  ]

  // only sent to server administrators: configuration options that are going away
  const deprecations = ((q.data as unknown as { deprecations?: Array<{ option: string; replacement?: string; message?: string; removed_in?: string }> }).deprecations ?? [])

  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      {!!deprecations.length && (
        <SettingsBlock title={t('info.warnings')} description={t('info.warningsDescription')}>
          <ul className="grid gap-3">
            {deprecations.map((d) => (
              <li key={d.option} className="flex gap-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brass" />
                <div className="min-w-0">
                  <p>
                    <code>{d.option}</code>
                    {d.replacement && (
                      <>
                        {' → '}
                        <code>{d.replacement}</code>
                      </>
                    )}
                  </p>
                  {d.message && <p className="text-muted-foreground">{d.message}</p>}
                  {d.removed_in && <p className="text-muted-foreground">{t('info.removedIn', { version: d.removed_in })}</p>}
                </div>
              </li>
            ))}
          </ul>
        </SettingsBlock>
      )}
      <SettingsBlock
        title={t('info.versions')}
        description={t('info.description')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy />
              {t('info.copy')}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/api/swagger-ui/" target="_blank" rel="noreferrer">
                <ExternalLink />
                {t('info.apiDocs')}
              </a>
            </Button>
          </div>
        }
      >
        <dl className="divide-y divide-border/60">
          <Row label="Gramps">{version('gramps')}</Row>
          <Row label="Gramps Web API">{version('gramps_webapi')}</Row>
          <Row label={t('info.apiSchema')}>{(m.gramps_webapi?.schema as string) ?? '–'}</Row>
          <Row label="Gramps QL">{version('gramps_ql')}</Row>
          <Row label={t('info.searchEngine')}>{version('search')}</Row>
          <Row label="yclade">{version('yclade')}</Row>
        </dl>
      </SettingsBlock>

      <SettingsBlock title={t('info.database')}>
        <dl className="divide-y divide-border/60">
          <Row label={t('info.dbName')}>{(db.name as string) ?? '–'}</Row>
          {tree && tree !== db.id && (
            <Row label={t('info.treeId')}>
              <code className="text-xs">{tree}</code>
            </Row>
          )}
          <Row label={t('info.dbId')}>
            <code className="text-xs">{(db.id as string) ?? '–'}</code>
          </Row>
          <Row label={t('info.dbType')}>
            {[db.type, db.version].filter(Boolean).join(' ')}
          </Row>
          <Row label={t('info.dbSchema')}>{(db.schema as string) ?? '–'}</Row>
          <Row label={t('info.locale')}>{(m.locale?.description as string) ?? '–'}</Row>
          <Row label={t('info.indexed')}>
            {((m.search?.sifts as { count?: number } | undefined)?.count ?? 0).toLocaleString()}
          </Row>
        </dl>
      </SettingsBlock>

      <SettingsBlock title={t('info.server')}>
        <dl className="divide-y divide-border/60">
          {features.map(([k, v]) => (
            <Row key={k} label={t(`info.features.${k}`)}>
              <YesNo value={v} />
            </Row>
          ))}
        </dl>
      </SettingsBlock>
      <ResearcherBlock readOnly />
    </div>
  )
}
