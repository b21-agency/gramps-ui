import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Download, ExternalLink, FileText, FileVideo, FileAudio, File as FileIcon, ScanText, SquareDashedMousePointer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/states'
import { ObjectToolbar } from '@/components/detail/object-header'
import { FaceStack, Panel } from '@/components/detail/panel'
import { Portrait } from '@/components/portrait'
import { TagList } from '@/components/tag-list'
import { ObjectHistory } from '@/components/detail/object-history'
import { CitationsList, FactsTable, NotesList } from '@/components/detail/sections'
import { mediaFileUrl, mediaThumbUrl } from '@/lib/api'
import { useAccessToken, useAuth } from '@/lib/auth'
import { objectPath } from '@/lib/objects'
import type { Media, MediaRef } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AlbumFrame, AlbumGrid, HeroActions } from './album'
import {
  MetaList,
  ObjectSkeleton,
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

  const people = regions.filter((r) => r.item.kind === 'person')
  const others = regions.filter((r) => r.item.kind !== 'person')
  const facePeople = people.map((r) => ({
    handle: r.key,
    gramps_id: r.item.raw.gramps_id,
    name_given: refTitle(r.item, t).title,
    sex: (r.item.profile?.sex as string) ?? '',
  }))
  const faceMap = new Map<string, MediaRef | undefined>(
    people.map((r) => [r.key, r.rect ? ({ ref: media.handle, rect: r.rect } as MediaRef) : r.item.raw.media_list?.[0]]),
  )
  const kindLabel = isImage ? undefined : media.mime?.split('/')[1]?.toUpperCase()

  const info = (
    <div className="flex min-w-0 flex-1 flex-col lg:pt-2">
      <p className="text-sm font-semibold text-brass max-lg:text-center">
        {[profile.date, kindLabel].filter(Boolean).join(' · ') || t('common:object.media')}
      </p>
      <h1 className="mt-3 font-serif text-[2.2rem] font-medium leading-[1.05] tracking-[-0.02em] text-balance [overflow-wrap:anywhere] max-lg:text-center sm:text-5xl lg:text-[2.75rem]">
        {title}
      </h1>
      <TagList tags={ext.tags} className="mt-3 max-lg:justify-center" />
      {people.length > 0 && (
        <div className="mt-6 flex items-center gap-3 max-lg:justify-center">
          <FaceStack people={facePeople} portraits={faceMap} ring="ring-background" moreHref="#people" />
          <a href="#people" className="text-sm text-muted-foreground hover:text-foreground">
            {t('album.peopleInPhoto')}
          </a>
        </div>
      )}
      {!isImage && media.mime?.startsWith('video/') && (
        <video controls preload="metadata" src={mediaFileUrl(media.handle)} className="mt-6 max-h-80 w-full rounded-2xl bg-card" />
      )}
      {!isImage && media.mime?.startsWith('audio/') && <audio controls preload="metadata" src={mediaFileUrl(media.handle)} className="mt-6 w-full" />}
      <div className="mt-7">
        <HeroActions>
          {isImage && can('EditObject') && !editRegions && (
            <Button size="sm" onClick={() => setEditRegions(true)}>
              <SquareDashedMousePointer />
              {t('regions.edit')}
            </Button>
          )}
          {ocrAvailable && (
            <Button size="sm" variant="secondary" aria-pressed={ocr} onClick={() => setOcr(!ocr)}>
              <ScanText />
              {t('ocr.title')}
            </Button>
          )}
          <Button asChild size="sm" variant="secondary">
            <a href={mediaFileUrl(media.handle)} target="_blank" rel="noreferrer">
              <ExternalLink />
              {t('openOriginal')}
            </a>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a href={mediaFileUrl(media.handle, true)} download>
              <Download />
              {t('common:actions.download')}
            </a>
          </Button>
        </HeroActions>
      </div>
    </div>
  )

  return (
    <AlbumFrame>
      <ObjectToolbar kind="media" object={media} title={title} onSaved={() => q.refetch()} />

      {isImage && editRegions ? (
        <>
          <RegionEditor
            media={media}
            regions={withRect.map<LinkedRegion>((r) => ({ key: r.key, item: r.item, rect: r.rect!, stored: (r.ref?.rect ?? r.rect) as Rect }))}
            onChanged={() => q.refetch()}
            onClose={() => setEditRegions(false)}
          />
          <div className="mt-8">{info}</div>
        </>
      ) : (
        <section className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
          {isImage ? (
            <ImageViewer media={media} title={title} regions={withRect} active={active} setActive={setActive} />
          ) : (
            <FileVisual media={media} />
          )}
          {info}
        </section>
      )}

      <AlbumGrid
        aside={
          <>
            {people.length > 0 && (
              <Panel id="people" title={t('album.peopleInPhoto')} count={people.length}>
                {withRect.length > 0 && isImage && <p className="mb-3 text-sm text-muted-foreground">{t('regionsHint')}</p>}
                <ul className="grid gap-0.5">
                  {people.map((r) => (
                    <li key={r.key} className="min-w-0">
                      <PersonRegionRow
                        region={r}
                        mediaHandle={media.handle}
                        note={r.rect ? undefined : isImage ? t('wholeImage') : undefined}
                        active={active === r.key}
                        onHover={r.rect ? (on) => setActive(on ? r.key : null) : undefined}
                      />
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            <Panel id="facts" title={t('detail:sections.facts')}>
              <MetaList
                rows={[
                  [t('date'), profile.date ? <span className="tabular-nums text-foreground">{profile.date}</span> : ''],
                  [t('album.file'), media.path ? <span className="break-all text-foreground">{media.path}</span> : ''],
                  [t('fileType'), media.mime],
                ]}
              />
              {media.attribute_list.length > 0 && (
                <div className="mt-5">
                  <FactsTable attributes={media.attribute_list} />
                </div>
              )}
            </Panel>
            {overlay && (
              <Panel id="map" title={t('overlay.title')}>
                <OverlayMap handle={media.handle} bounds={overlay} />
              </Panel>
            )}
          </>
        }
        main={
          <>
            {ocr && ocrAvailable && <OcrPanel handle={media.handle} onClose={() => setOcr(false)} onSaved={() => q.refetch()} />}
            {others.length > 0 && (
              <Panel id="references" title={people.length ? t('album.alsoLinked') : t('detail:sections.references')} count={others.length}>
                <ul className="grid gap-x-4 sm:grid-cols-2">
                  {others.map((r) => (
                    <li key={r.key} className="min-w-0">
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
              </Panel>
            )}
            {notes.length > 0 && (
              <Panel id="notes" title={t('album.stories')} count={notes.length}>
                <NotesList handles={notes} />
              </Panel>
            )}
            {cites.length > 0 && (
              <Panel id="sources" title={t('detail:sections.sources')} count={cites.length}>
                <CitationsList handles={cites} />
              </Panel>
            )}
            <ObjectHistory objClass="Media" handle={media.handle} lastChange={media.change} />
          </>
        }
      />
    </AlbumFrame>
  )
}

/** A person in the picture: their cropped face (or own portrait), name and life span. */
function PersonRegionRow({
  region,
  mediaHandle,
  note,
  active,
  onHover,
}: {
  region: Region
  mediaHandle: string
  note?: string
  active?: boolean
  onHover?: (on: boolean) => void
}) {
  const { t } = useTranslation()
  const { item, rect } = region
  const { title, subtitle } = refTitle(item, t)
  const hover = onHover
    ? { onMouseEnter: () => onHover(true), onMouseLeave: () => onHover(false), onFocus: () => onHover(true), onBlur: () => onHover(false) }
    : {}
  return (
    <Link
      to={objectPath(item.kind, item.raw.gramps_id)}
      {...hover}
      className={cn(
        '-mx-2 flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent',
        active && 'bg-accent',
      )}
    >
      <Portrait
        mediaRef={rect ? { ref: mediaHandle, rect } : item.raw.media_list?.[0]}
        name={title}
        sex={item.profile?.sex}
        size={44}
        className={cn(active && 'ring-brass')}
      />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">{title}</span>
        {(subtitle || note) && (
          <span className="block truncate text-xs tabular-nums text-muted-foreground">{[subtitle, note].filter(Boolean).join(' · ')}</span>
        )}
      </span>
    </Link>
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
    <figure className="flex min-w-0 shrink-0 justify-center lg:max-w-[min(62%,56rem)] lg:justify-start">
      <div className="group/viewer relative inline-block max-w-full overflow-hidden rounded-3xl bg-card">
        <a href={mediaFileUrl(media.handle)} target="_blank" rel="noreferrer" tabIndex={-1}>
          <img
            src={mediaThumbUrl(media.handle, 1600)}
            alt={title}
            onLoad={() => setLoaded(true)}
            className={cn('block max-h-[78vh] w-auto max-w-full bg-card object-cover max-lg:max-h-[70vh] lg:min-h-[26rem]', !loaded && 'min-h-64 min-w-64')}
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

function FileVisual({ media }: { media: Media }) {
  const { t } = useTranslation('objects')
  const [thumbOk, setThumbOk] = useState(true)
  const mime = media.mime ?? ''
  const Icon = mime === 'application/pdf' || mime.startsWith('text/') ? FileText : mime.startsWith('video/') ? FileVideo : mime.startsWith('audio/') ? FileAudio : FileIcon
  return (
    <a
      href={mediaFileUrl(media.handle)}
      target="_blank"
      rel="noreferrer"
      className="mx-auto flex h-[19rem] w-full shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-card p-4 sm:h-[26rem] sm:max-w-md lg:mx-0 lg:h-[30rem] lg:w-[24rem]"
      aria-label={t('openOriginal')}
    >
      {thumbOk ? (
        <img
          src={mediaThumbUrl(media.handle, 800)}
          alt=""
          onError={() => setThumbOk(false)}
          className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
        />
      ) : (
        <span className="flex flex-col items-center gap-3 text-muted-foreground">
          <Icon className="size-16" />
          <span className="text-sm">{mime || t('unknownType')}</span>
        </span>
      )}
    </a>
  )
}
