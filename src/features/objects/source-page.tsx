import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BookOpen, Landmark } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states'
import { ObjectToolbar } from '@/components/detail/object-header'
import { Panel } from '@/components/detail/panel'
import { ObjectHistory } from '@/components/detail/object-history'
import { FactsTable, Gallery, NotesList } from '@/components/detail/sections'
import { useObjectsByHandlesQuery } from '@/api/enhanced/objects'
import { apiLocale } from '@/i18n'
import { typeStr } from '@/lib/format'
import { kindIcon, objectPath } from '@/lib/objects'
import type { Source } from '@/lib/types'
import { AlbumFrame, AlbumGrid, CoverVisual, glyphOf, ObjectHero, PhotoVisual } from './album'
import {
  ConfidenceMeter,
  countRefs,
  MetaList,
  ObjectSkeleton,
  referenceItems,
  refTitle,
  RichReferences,
  ShowMore,
  useLimited,
  useObjectPage,
  type AnyObj,
} from './shared'

export function SourcePage() {
  const { id } = useParams()
  const { t } = useTranslation(['objects', 'detail', 'common'])
  const { q, title } = useObjectPage<Source>('source', id, (s) => s.title || s.gramps_id)
  const source = q.data

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!source) return <ObjectSkeleton />

  const ext = source.extended ?? {}
  const backlinks = (ext.backlinks ?? {}) as Record<string, AnyObj[]>
  const references = ((source as AnyObj).profile?.references ?? {}) as Record<string, AnyObj[]>
  const citations = [...(backlinks.citation ?? [])].sort((a, b) =>
    String(a.page ?? '').localeCompare(String(b.page ?? ''), undefined, { numeric: true }),
  )
  const citationDates = new Map<string, string>()
  const cp = references.citation ?? []
  if (cp.length === (backlinks.citation ?? []).length) backlinks.citation?.forEach((c, i) => citationDates.set(c.handle, cp[i]?.date ?? ''))

  const repos = new Map((ext.repositories ?? []).map((r) => [r.handle, r]))
  const refs = referenceItems(backlinks, references, ['citation'])
  const media = source.media_list ?? []
  const notes = source.note_list ?? []

  const visual = media.length ? (
    <PhotoVisual refs={media} media={ext.media} label={t('album.openPhotos')} />
  ) : (
    <CoverVisual icon={BookOpen} glyph={glyphOf(source.abbrev || title)} label={t('common:object.source')} sub={source.gramps_id} />
  )

  return (
    <AlbumFrame>
      <ObjectToolbar kind="source" object={source} title={title} onSaved={() => q.refetch()} />

      <ObjectHero
        size={media.length ? 'portrait' : 'cover'}
        visual={visual}
        eyebrow={
          citations.length > 0 && <p className="text-sm font-semibold text-brass">{t('album.citations', { count: citations.length })}</p>
        }
        title={title}
        subtitle={source.author ? t('byAuthor', { author: source.author }) : undefined}
        tags={ext.tags}
      >
        <MetaList
          className="mt-6 max-w-2xl"
          rows={[
            [t('pubinfo'), source.pubinfo],
            [t('abbrev'), source.abbrev],
          ]}
        />
      </ObjectHero>

      <AlbumGrid
        aside={
          <>
            {source.reporef_list.length > 0 && (
              <Panel id="repositories" title={t('detail:sections.repositories')} count={source.reporef_list.length}>
                <ul className="grid gap-0.5">
                  {source.reporef_list.map((r, i) => {
                    const repo = repos.get(r.ref)
                    return (
                      <li key={`${r.ref}-${i}`} className="min-w-0">
                        <Link
                          to={repo ? `/repository/${repo.gramps_id}` : '#'}
                          className="-mx-2 flex gap-3 rounded-2xl px-2 py-1.5 transition-colors duration-150 hover:bg-accent"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-brass">
                            <Landmark className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[15px] font-semibold leading-tight">{repo?.name ?? r.ref}</span>
                            <span className="block text-xs text-muted-foreground">
                              {[repo && typeStr(repo.type), typeStr(r.media_type)].filter(Boolean).join(' · ')}
                            </span>
                            {r.call_number && (
                              <span className="mt-0.5 block text-xs">
                                <span className="text-muted-foreground">{t('detail:callNumber')}: </span>
                                <span className="font-mono">{r.call_number}</span>
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            )}
            {media.length > 0 && (
              <Panel id="gallery" title={t('album.photosAndDocs')} count={media.length}>
                <Gallery refs={media} media={ext.media} />
              </Panel>
            )}
            {source.attribute_list.length > 0 && (
              <Panel id="facts" title={t('detail:sections.facts')}>
                <FactsTable attributes={source.attribute_list} />
              </Panel>
            )}
            {refs.length > 0 && (
              <Panel id="references" title={t('detail:sections.references')} count={countRefs(refs)}>
                <RichReferences groups={refs} />
              </Panel>
            )}
          </>
        }
        main={
          <>
            {citations.length > 0 && (
              <Panel id="citations" title={t('detail:sections.citations')} count={citations.length}>
                <SourceCitations citations={citations} dates={citationDates} />
              </Panel>
            )}
            {notes.length > 0 && (
              <Panel id="notes" title={t('album.stories')} count={notes.length}>
                <NotesList handles={notes} />
              </Panel>
            )}
            <ObjectHistory objClass="Source" handle={source.handle} lastChange={source.change} />
          </>
        }
      />
    </AlbumFrame>
  )
}

const PAGE = 20

/** Citations of this source, each with the objects that cite it (loaded for the visible rows only). */
function SourceCitations({ citations, dates }: { citations: AnyObj[]; dates: Map<string, string> }) {
  const { shown, hidden, all, setAll } = useLimited(citations, PAGE)
  const handles = shown.map((c) => c.handle)
  const r = useObjectsByHandlesQuery<{ handle: string; profile?: AnyObj; extended?: { backlinks?: Record<string, AnyObj[]> } }>(
    'citation',
    handles,
    { profile: ['references'], backlinks: true, extend: ['backlinks'], keys: ['handle', 'profile', 'extended'], locale: apiLocale() },
  )
  const data = r.data
  const citedBy = new Map((data ?? []).map((c) => [c.handle, referenceItems(c.extended?.backlinks, c.profile?.references)]))
  // rows revealed by "show all" are loading until their answer arrives (data keeps the previous rows meanwhile)
  const isLoading = (h: string) => r.isLoading || (r.isFetching && !citedBy.has(h))
  return (
    <>
      <ol className="divide-y divide-border/60">
        {shown.map((c) => (
          <li key={c.handle} className="py-3">
            <div className="flex items-baseline gap-3">
              <Link to={`/citation/${c.gramps_id}`} className="min-w-0 flex-1 text-[15px] font-semibold [overflow-wrap:anywhere] hover:underline">
                {c.page || c.gramps_id}
              </Link>
              {dates.get(c.handle) && <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{dates.get(c.handle)}</span>}
              <ConfidenceMeter value={c.confidence} compact className="hidden shrink-0 sm:inline-flex" />
            </div>
            <CitedBy groups={citedBy.get(c.handle)} loading={isLoading(c.handle)} />
          </li>
        ))}
      </ol>
      <ShowMore hidden={hidden} all={all} onToggle={() => setAll(!all)} />
    </>
  )
}

function CitedBy({ groups, loading }: { groups?: ReturnType<typeof referenceItems>; loading: boolean }) {
  const { t } = useTranslation(['objects', 'common'])
  if (loading) return <Skeleton className="mt-1.5 h-4 w-48" />
  if (!groups?.length) return null
  const items = groups.flatMap(([, list]) => list)
  const visible = items.slice(0, 6)
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <li className="sr-only">{t('citedBy')}</li>
      {visible.map((it) => {
        const Icon = kindIcon[it.kind]
        return (
          <li key={it.raw.handle} className="min-w-0">
            <Link to={objectPath(it.kind, it.raw.gramps_id)} className="inline-flex max-w-[18rem] items-center gap-1 hover:text-foreground">
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{refTitle(it, t).title}</span>
            </Link>
          </li>
        )
      })}
      {items.length > visible.length && <li>{t('andMore', { count: items.length - visible.length })}</li>}
    </ul>
  )
}

