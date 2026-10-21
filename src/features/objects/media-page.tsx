import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Download, ExternalLink, FileText, FileVideo, FileAudio, File as FileIcon, ScanText, SquareDashedMousePointer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/states'
import { ObjectTitle, ObjectToolbar } from '@/components/detail/object-header'
import { ObjectHistory } from '@/components/detail/object-history'
import { CitationsList, DetailSection, FactsTable, NotesList, SectionNav } from '@/components/detail/sections'
import { mediaFileUrl, mediaThumbUrl } from '@/lib/api'
import { useAccessToken, useAuth } from '@/lib/auth'
import { objectPath } from '@/lib/objects'
import type { Media, MediaRef } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  Columns,
  MetaList,
  navItems,
  ObjectSkeleton,
  PageFrame,
  referenceItems,
  RefRow,
  refsTo,
  refTitle,
  validRect,
  useObjectPage,
  type AnyObj,
  type RefItem,
} from './shared'
import { RegionEditor, type LinkedRegion, type Rect } from './media-regions'
import { OcrPanel, useOcrAvailable } from './media-ocr'
import { OverlayMap, parseBounds } from './media-overlay'

interface Region {
  key: string
  item: RefItem
  ref?: MediaRef
  rect?: [number, number, number, number]
}

export function MediaPage() {
  const { id } = useParams()
  const { t } = useTranslation(['objects', 'detail', 'common'])
  useAccessToken()
  const { q, title } = useObjectPage<Media>('media', id, (m) => m.desc || m.path?.split('/').pop() || m.gramps_id)
  const media = q.data
  const [active, setActive] = useState<string | null>(null)
  const [editRegions, setEditRegions] = useState(false)
  const [ocr, setOcr] = useState(false)
  const { can } = useAuth()
  const ocrAvailable = useOcrAvailable(media?.mime)

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!media) return <ObjectSkeleton media />

  const ext = media.extended ?? {}
  const profile = (media.profile ?? {}) as AnyObj
  const groups = referenceItems(ext.backlinks as never, profile.references)
  // one entry per reference; an object can point at the same image more than once
  const regions: Region[] = groups.flatMap(([, items]) =>
    items.flatMap((item) => {
      const rs = refsTo(item.raw, media.handle)
      if (!rs.length) return [{ key: item.raw.handle, item }]
      return rs.map((r, i) => ({
        key: `${item.raw.handle}-${i}`,
        item,
        ref: r,
        rect: validRect(r.rect) ? (r.rect.map(Math.round) as [number, number, number, number]) : undefined,
      }))
    }),
  )
  const withRect = regions.filter((r) => r.rect)
  const isImage = media.mime?.startsWith('image/')
  const notes = media.note_list ?? []
  const overlay = isImage ? parseBounds(media.attribute_list) : null
  const cites = media.citation_list ?? []

  const nav = navItems([
    regions.length > 0 && { id: 'references', label: t('detail:sections.references'), count: regions.length },
    notes.length > 0 && { id: 'notes', label: t('detail:sections.notes'), count: notes.length },
    cites.length > 0 && { id: 'sources', label: t('detail:sections.sources'), count: cites.length },
    media.attribute_list.length > 0 && { id: 'facts', label: t('detail:sections.facts') },
  ])

  return (
    <PageFrame>
      <ObjectToolbar kind="media" object={media} title={title} onSaved={() => q.refetch()} />

      {isImage && editRegions ? (
        <RegionEditor
          media={media}
          regions={withRect.map<LinkedRegion>((r) => ({ key: r.key, item: r.item, rect: r.rect!, stored: (r.ref?.rect ?? r.rect) as Rect }))}
          onChanged={() => q.refetch()}
          onClose={() => setEditRegions(false)}
        />
      ) : isImage ? (
        <ImageViewer media={media} title={title} regions={withRect} active={active} setActive={setActive} />
      ) : (
        <FileCard media={media} title={title} />
      )}

      <ObjectTitle
        className="mt-6"
        title={title}
        tags={ext.tags}
        subtitle={
          <MetaList
            className="mt-3"
            rows={[
              [t('date'), profile.date ? <span className="tabular-nums text-foreground">{profile.date}</span> : ''],
              [t('file'), media.path ? <span className="break-all text-foreground">{media.path}</span> : ''],
              [t('fileType'), media.mime],
            ]}
          />
        }
        aside={
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {isImage && can('EditObject') && !editRegions && (
              <Button size="sm" variant="outline" onClick={() => setEditRegions(true)}>
                <SquareDashedMousePointer />
                {t('regions.edit')}
              </Button>
            )}
            {ocrAvailable && (
              <Button size="sm" variant="outline" aria-pressed={ocr} onClick={() => setOcr(!ocr)}>
                <ScanText />
                {t('ocr.title')}
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <a href={mediaFileUrl(media.handle)} target="_blank" rel="noreferrer">
                <ExternalLink />
                {t('openOriginal')}
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={mediaFileUrl(media.handle, true)} download>
                <Download />
                {t('common:actions.download')}
              </a>
            </Button>
          </div>
        }
      />

      <SectionNav items={nav} />

      <Columns
        main={
          <>
            {ocr && ocrAvailable && <OcrPanel handle={media.handle} onClose={() => setOcr(false)} onSaved={() => q.refetch()} />}
            {regions.length > 0 && (
              <DetailSection id="references" title={t('detail:sections.references')} count={regions.length}>
                {withRect.length > 0 && isImage && <p className="mb-2 text-sm text-muted-foreground">{t('regionsHint')}</p>}
                <ul className="grid gap-x-4 sm:grid-cols-2">
                  {regions.map((r) => (
                    <li key={r.key}>
                      <RefRow
                        item={r.item}
                        thumb={r.rect && r.ref ? { ref: media.handle, rect: r.rect } : undefined}
                        note={r.rect ? undefined : isImage ? t('wholeImage') : undefined}
                        active={active === r.key}
                        onHover={r.rect ? (on) => setActive(on ? r.key : null) : undefined}
                      />
                    </li>
                  ))}
                </ul>
              </DetailSection>
            )}
            {notes.length > 0 && (
              <DetailSection id="notes" title={t('detail:sections.notes')} count={notes.length}>
                <NotesList handles={notes} />
              </DetailSection>
            )}
          </>
        }
        aside={
          <>
            {overlay && (
              <DetailSection id="map" title={t('overlay.title')}>
                <OverlayMap handle={media.handle} bounds={overlay} />
              </DetailSection>
            )}
            {cites.length > 0 && (
              <DetailSection id="sources" title={t('detail:sections.sources')} count={cites.length}>
                <CitationsList handles={cites} />
              </DetailSection>
            )}
            {media.attribute_list.length > 0 && (
              <DetailSection id="facts" title={t('detail:sections.facts')}>
                <FactsTable attributes={media.attribute_list} />
              </DetailSection>
            )}
            <ObjectHistory objClass="Media" handle={media.handle} lastChange={media.change} />
          </>
        }
      />
    </PageFrame>
  )
}

function ImageViewer({
  media,
  title,
  regions,
  active,
  setActive,
}: {
  media: Media
  title: string
  regions: Region[]
  active: string | null
  setActive: (k: string | null) => void
}) {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState(false)
  return (
    <figure className="flex justify-center rounded-xl border bg-muted/60 p-2 sm:p-4">
      <div className="group/viewer relative inline-block max-w-full overflow-hidden rounded-md">
        <a href={mediaFileUrl(media.handle)} target="_blank" rel="noreferrer" tabIndex={-1}>
          <img
            src={mediaThumbUrl(media.handle, 1600)}
            alt={title}
            onLoad={() => setLoaded(true)}
            className={cn('block max-h-[72vh] w-auto max-w-full bg-muted', !loaded && 'min-h-64 min-w-64')}
          />
        </a>
        {loaded &&
          regions.map((r) => {
            const [x1, y1, x2, y2] = r.rect!
            const on = active === r.key
            const label = refTitle(r.item, t).title
            return (
              <Link
                key={r.key}
                to={objectPath(r.item.kind, r.item.raw.gramps_id)}
                aria-label={label}
                onFocus={() => setActive(r.key)}
                onBlur={() => setActive(null)}
                onMouseEnter={() => setActive(r.key)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  'absolute rounded-sm border-2 motion-safe:transition-[opacity,box-shadow,border-color] motion-safe:duration-200',
                  on
                    ? 'z-10 border-brass opacity-100 shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]'
                    : 'border-white/70 opacity-0 group-hover/viewer:opacity-100',
                  active && !on && 'opacity-0 group-hover/viewer:opacity-0',
                )}
                style={{ left: `${x1}%`, top: `${y1}%`, width: `${x2 - x1}%`, height: `${y2 - y1}%` }}
              >
                <span
                  className={cn(
                    'pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-background/95 px-1.5 py-0.5 text-xs text-foreground shadow',
                    on ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {label}
                </span>
              </Link>
            )
          })}
      </div>
    </figure>
  )
}

function FileCard({ media, title }: { media: Media; title: string }) {
  const { t } = useTranslation('objects')
  const [thumbOk, setThumbOk] = useState(true)
  const mime = media.mime ?? ''
  const Icon = mime === 'application/pdf' || mime.startsWith('text/') ? FileText : mime.startsWith('video/') ? FileVideo : mime.startsWith('audio/') ? FileAudio : FileIcon
  return (
    <div className="flex flex-col items-center gap-5 rounded-xl border bg-card p-6 sm:flex-row sm:items-center">
      <div className="flex h-56 w-44 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {thumbOk ? (
          <img
            src={mediaThumbUrl(media.handle, 400)}
            alt=""
            onError={() => setThumbOk(false)}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Icon className="size-14 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="font-serif text-xl">{title}</p>
        <p className="mt-1 break-all text-sm text-muted-foreground">{media.path}</p>
        <p className="mt-1 text-sm text-muted-foreground">{mime || t('unknownType')}</p>
        {mime.startsWith('video/') && (
          <video controls preload="metadata" src={mediaFileUrl(media.handle)} className="mt-4 max-h-80 w-full rounded-md" />
        )}
        {mime.startsWith('audio/') && <audio controls preload="metadata" src={mediaFileUrl(media.handle)} className="mt-4 w-full" />}
      </div>
    </div>
  )
}
