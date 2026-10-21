import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Landmark } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states'
import { ObjectTitle, ObjectToolbar } from '@/components/detail/object-header'
import { ObjectHistory } from '@/components/detail/object-history'
import { DetailSection, FactsTable, Gallery, NotesList, SectionNav } from '@/components/detail/sections'
import { api } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { typeStr } from '@/lib/format'
import { kindIcon, objectPath } from '@/lib/objects'
import type { Source } from '@/lib/types'
import {
  Columns,
  ConfidenceMeter,
  countRefs,
  MetaList,
  navItems,
  ObjectSkeleton,
  PageFrame,
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

  const nav = navItems([
    citations.length > 0 && { id: 'citations', label: t('detail:sections.citations'), count: citations.length },
    source.reporef_list.length > 0 && { id: 'repositories', label: t('detail:sections.repositories'), count: source.reporef_list.length },
    notes.length > 0 && { id: 'notes', label: t('detail:sections.notes'), count: notes.length },
    media.length > 0 && { id: 'gallery', label: t('detail:sections.gallery'), count: media.length },
    source.attribute_list.length > 0 && { id: 'facts', label: t('detail:sections.facts') },
    refs.length > 0 && { id: 'references', label: t('detail:sections.references'), count: countRefs(refs) },
  ])

  return (
    <PageFrame>
      <ObjectToolbar kind="source" object={source} title={title} onSaved={() => q.refetch()} />

      <ObjectTitle
        title={<span className="font-serif">{title}</span>}
        tags={ext.tags}
        subtitle={
          <div className="space-y-3">
            {source.author && <p className="text-lg text-foreground">{t('byAuthor', { author: source.author })}</p>}
            <MetaList
              rows={[
                [t('pubinfo'), source.pubinfo],
                [t('abbrev'), source.abbrev],
              ]}
            />
          </div>
        }
      />

      <SectionNav items={nav} />

      <Columns
        main={
          <>
            {citations.length > 0 && (
              <DetailSection id="citations" title={t('detail:sections.citations')} count={citations.length}>
                <SourceCitations citations={citations} dates={citationDates} />
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
            {source.reporef_list.length > 0 && (
              <DetailSection id="repositories" title={t('detail:sections.repositories')} count={source.reporef_list.length}>
                <ul className="space-y-3">
                  {source.reporef_list.map((r, i) => {
                    const repo = repos.get(r.ref)
                    return (
                      <li key={`${r.ref}-${i}`}>
                        <Link
                          to={repo ? `/repository/${repo.gramps_id}` : '#'}
                          className="-mx-2 flex gap-3 rounded-lg px-2 py-1.5 hover:bg-accent"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                            <Landmark className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium leading-tight">{repo?.name ?? r.ref}</span>
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
              </DetailSection>
            )}
            {media.length > 0 && (
              <DetailSection id="gallery" title={t('detail:sections.gallery')} count={media.length}>
                <Gallery refs={media} media={ext.media} />
              </DetailSection>
            )}
            {source.attribute_list.length > 0 && (
              <DetailSection id="facts" title={t('detail:sections.facts')}>
                <FactsTable attributes={source.attribute_list} />
              </DetailSection>
            )}
            {refs.length > 0 && (
              <DetailSection id="references" title={t('detail:sections.references')} count={countRefs(refs)}>
                <RichReferences groups={refs} />
              </DetailSection>
            )}
            <ObjectHistory objClass="Source" handle={source.handle} lastChange={source.change} />
          </>
        }
      />
    </PageFrame>
  )
}

const PAGE = 20

/** Citations of this source, each with the objects that cite it (loaded for the visible rows only). */
function SourceCitations({ citations, dates }: { citations: AnyObj[]; dates: Map<string, string> }) {
  const { shown, hidden, all, setAll } = useLimited(citations, PAGE)
  const handles = shown.map((c) => c.handle)
  const { data, isLoading } = useQuery({
    queryKey: ['citations', 'cited-by', handles, apiLocale()],
    enabled: handles.length > 0,
    staleTime: 60_000,
    queryFn: () =>
      api<Array<{ handle: string; profile?: AnyObj; extended?: { backlinks?: Record<string, AnyObj[]> } }>>('/citations/', {
        query: {
          handles: handles.join(','),
          profile: 'references',
          backlinks: true,
          extend: 'backlinks',
          keys: 'handle,profile,extended',
          locale: apiLocale(),
        },
      }),
  })
  const citedBy = new Map((data ?? []).map((c) => [c.handle, referenceItems(c.extended?.backlinks, c.profile?.references)]))
  return (
    <>
      <ol className="divide-y">
        {shown.map((c) => (
          <li key={c.handle} className="py-2.5">
            <div className="flex items-baseline gap-3">
              <Link to={`/citation/${c.gramps_id}`} className="min-w-0 flex-1 font-medium hover:underline">
                {c.page || c.gramps_id}
              </Link>
              {dates.get(c.handle) && <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{dates.get(c.handle)}</span>}
              <ConfidenceMeter value={c.confidence} compact className="hidden shrink-0 sm:inline-flex" />
            </div>
            <CitedBy groups={citedBy.get(c.handle)} loading={isLoading} />
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

