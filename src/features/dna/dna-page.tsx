import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, ChevronRight, Dna, Network, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/features/editor/lib'
import { useUndoTransactionMutation } from '@/api/enhanced/objects'
import type { TxEntry } from '@/api/enhanced/tags'
import { toApiError } from '@/api/enhanced/editor'
import { MatchDialog } from './match-dialog'
import { DnaTabs, useDefaultPerson } from './dna-tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Portrait } from '@/components/portrait'
import { PersonChip } from '@/components/person-chip'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { lifespan, profileName } from '@/lib/format'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import { ChromosomeBrowser, type Lane } from './chromosome-browser'
import {
  deleteDnaMatch,
  matchStats,
  normChromosome,
  sideColor,
  useDnaMatches,
  useDnaPeople,
  usePeopleByHandle,
  type DnaMatch,
  type DnaPerson,
} from './data'

const LANE_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

function fmtCm(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

export function DnaPage() {
  const { t } = useTranslation(['dna', 'common'])
  useTitle(t('title'))
  const { id, match } = useParams()
  const { can } = useAuth()
  const people = useDnaPeople()
  const selected = people.data?.find((p) => p.gramps_id === id)
  const [adding, setAdding] = useState(false)
  useDefaultPerson('/dna-matches', id, people.data)

  if (people.isError) return <ErrorState error={people.error} onRetry={() => people.refetch()} />

  const addButton = can('EditObject') && (
    <Button onClick={() => setAdding(true)}>
      <Plus />
      {t('edit.addTitle')}
    </Button>
  )
  const addDialog = (
    <MatchDialog
      open={adding}
      onOpenChange={setAdding}
      source={selected ? { handle: selected.handle, title: profileName(selected.profile) || selected.gramps_id } : undefined}
    />
  )

  if (people.data && people.data.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-medium tracking-tight">{t('title')}</h1>
          {addButton}
        </div>
        <div className="mt-6">
          <DnaTabs />
        </div>
        <Explainer />
        {addDialog}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('intro')}</p>
        </div>
        {addButton}
      </div>
      <DnaTabs id={id} />
      {addDialog}
      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className={cn('min-w-0', id && 'hidden lg:block')}>
          <div className="mb-2 flex items-baseline gap-2 border-b pb-2">
            <h2 className="text-lg font-medium">{t('testedPeople')}</h2>
            {people.data && <span className="text-sm tabular-nums text-muted-foreground">{people.data.length}</span>}
          </div>
          {people.isLoading ? <RowsSkeleton rows={5} /> : <PeopleList people={people.data ?? []} current={id} />}
        </aside>
        <section className={cn('min-w-0', !id && 'hidden lg:block')}>
          {selected ? (
            <MatchesView person={selected} matchId={match} />
          ) : id && people.data ? (
            <EmptyState title={t('notTested')}>{t('notTestedHint')}</EmptyState>
          ) : id ? (
            <RowsSkeleton rows={4} />
          ) : (
            <EmptyState icon={Dna} title={t('pickPerson')} className="rounded-xl border border-dashed">
              {t('pickPersonHint')}
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  )
}

function PeopleList({ people, current }: { people: DnaPerson[]; current?: string }) {
  const { t } = useTranslation('dna')
  return (
    <ul className="space-y-0.5">
      {people.map((p) => {
        const n = p.person_ref_list?.filter((r) => r.rel === 'DNA').length ?? 0
        const name = profileName(p.profile) || p.gramps_id
        const active = p.gramps_id === current
        return (
          <li key={p.handle}>
            <Link
              to={`/dna-matches/${p.gramps_id}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-accent focus-visible:bg-accent',
                active && 'bg-accent',
              )}
            >
              <Portrait mediaRef={p.media_list?.[0]} name={name} sex={p.profile?.sex} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium leading-tight">{name}</span>
                <span className="block text-xs text-muted-foreground">{t('matchCount', { count: n })}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground lg:hidden" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function MatchesView({ person, matchId }: { person: DnaPerson; matchId?: string }) {
  const { t } = useTranslation(['dna', 'common'])
  const navigate = useNavigate()
  const q = useDnaMatches(person.handle)
  const handles = useMemo(
    () => (q.data ?? []).flatMap((m) => [m.handle, ...(m.ancestor_handles ?? [])]),
    [q.data],
  )
  const profiles = usePeopleByHandle(handles)
  const name = profileName(person.profile) || person.gramps_id

  const rows = useMemo(
    () =>
      (q.data ?? [])
        .map((m) => ({ m, s: matchStats(m), p: profiles.data?.get(m.handle) }))
        .sort((a, b) => b.s.total - a.s.total),
    [q.data, profiles.data],
  )
  const current = matchId ? rows.find((r) => r.p?.gramps_id === matchId) : undefined
  const { can } = useAuth()
  const [undo] = useUndoTransactionMutation()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // legend click shows one match alone (without leaving the overview)
  const [isolated, setIsolated] = useState<string | null>(null)
  const { pathname } = useLocation()
  const browserRef = useRef<HTMLDivElement>(null)
  const chromosomeRoute = pathname.startsWith('/dna-chromosome')
  useEffect(() => {
    if (chromosomeRoute && rows.length) browserRef.current?.scrollIntoView({ block: 'start' })
  }, [chromosomeRoute, rows.length])

  const removeMatch = async () => {
    if (!current) return
    setDeleting(false)
    const mName = profileName(current.p?.profile) || current.p?.gramps_id || ''
    try {
      // matches and people refresh through the transaction's cache tags
      const tx = await deleteDnaMatch(person.handle, current.m)
      navigate(`/dna-matches/${person.gramps_id}`, { replace: true })
      toast.success(t('edit.deleted', { name: mName }), {
        duration: 10_000,
        action: {
          label: t('edit.undo'),
          onClick: async () => {
            try {
              await undo(tx as unknown as TxEntry[]).unwrap()
            } catch (e) {
              toast.error(t('edit.failed'), { description: errorMessage(toApiError(e)) })
            }
          },
        },
      })
    } catch (e) {
      toast.error(t('edit.failed'), { description: errorMessage(e) })
    }
  }

  const allLanes: Lane[] = rows
    .filter((r) => r.s.count > 0)
    .map((r, i) => ({
      key: r.m.handle,
      label: profileName(r.p?.profile) || '…',
      color: LANE_COLORS[i % LANE_COLORS.length],
      segments: r.m.segments,
    }))
  const lanes: Lane[] = current
    ? [{ key: current.m.handle, label: profileName(current.p?.profile), segments: current.m.segments }]
    : isolated && allLanes.some((l) => l.key === isolated)
      ? allLanes.filter((l) => l.key === isolated)
      : allLanes

  return (
    <div className="min-w-0">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" asChild aria-label={t('common:actions.back')}>
          <Link to="/dna-matches">
            <ArrowLeft />
          </Link>
        </Button>
        <PersonChip person={person.profile} mediaRef={person.media_list?.[0]} size={48} className="-ml-2 min-w-0" />
      </div>

      <div className="mb-3 flex items-baseline gap-2 border-b pb-2">
        <h2 className="text-xl font-medium">{t('matches')}</h2>
        {q.data && <span className="text-sm tabular-nums text-muted-foreground">{q.data.length}</span>}
      </div>

      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading && <RowsSkeleton rows={3} />}
      {q.data && q.data.length === 0 && <EmptyState icon={Dna} title={t('noMatches', { name })}>{t('noMatchesHint')}</EmptyState>}

      {rows.length > 0 && (
        <ol className="divide-y rounded-xl border bg-card">
          {rows.map(({ m, s, p }) => {
            const active = current?.m.handle === m.handle
            const mName = profileName(p?.profile)
            return (
              <li key={`${m.handle}-${m.person_ref_idx}`}>
                <button
                  type="button"
                  onClick={() =>
                    p && navigate(active ? `/dna-matches/${person.gramps_id}` : `/dna-matches/${person.gramps_id}/${p.gramps_id}`, { replace: true })
                  }
                  className={cn(
                    'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-3 py-3 text-left outline-none transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent/60 focus-visible:bg-accent sm:grid-cols-[minmax(0,1fr)_6rem_5rem_5rem]',
                    active && 'bg-accent',
                  )}
                  aria-pressed={active}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {p ? (
                      <Portrait mediaRef={p.media_list?.[0]} name={mName} sex={p.profile?.sex} size={40} />
                    ) : (
                      <Skeleton className="size-10 rounded-full" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{mName || '…'}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {m.relation || t('relationUnknown')}
                        {p && <span className="tabular-nums"> · {lifespan(p.profile?.birth as { date?: string }, p.profile?.death as { date?: string })}</span>}
                      </span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="font-serif text-2xl tabular-nums leading-none">{fmtCm(s.total)}</span>
                    <span className="ml-1 text-xs text-muted-foreground">cM</span>
                  </span>
                  <span className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
                    {t('segmentCount', { count: s.count })}
                  </span>
                  <span className="hidden text-right text-sm sm:block">
                    <SideBadge side={s.side} />
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {rows.length > 0 && (
        <div className="mt-8 scroll-mt-20" ref={browserRef}>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2">
            <h2 className="text-xl font-medium">{t('browser')}</h2>
            <span className="text-sm text-muted-foreground">
              {current ? t('browserOne', { name: profileName(current.p?.profile) }) : t('browserAll', { count: allLanes.length })}
            </span>
          </div>
          {lanes.every((l) => l.segments.length === 0) ? (
            <EmptyState icon={Dna} title={t('noSegments')}>{t('noSegmentsHint')}</EmptyState>
          ) : (
            <>
              <Legend
                lanes={current ? lanes : allLanes}
                perSide={!!current}
                isolated={isolated}
                onToggle={(k) => setIsolated((v) => (v === k ? null : k))}
              />
              <ChromosomeBrowser lanes={lanes} />
            </>
          )}
          {current && (
            <>
              {can('EditObject') && (
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil />
                    {t('edit.editData')}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(true)}>
                    <Trash2 />
                    {t('edit.delete')}
                  </Button>
                </div>
              )}
              <MatchDetails match={current.m} stats={current.s} ancestors={profiles.data} person={person} matchPerson={current.p} />
              <MatchDialog
                open={editing}
                onOpenChange={setEditing}
                source={{ handle: person.handle, title: name }}
                match={current.m}
                matchName={profileName(current.p?.profile)}
              />
              <AlertDialog open={deleting} onOpenChange={setDeleting}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('edit.deleteTitle', { name: profileName(current.p?.profile) })}</AlertDialogTitle>
                    <AlertDialogDescription>{t('edit.deleteBody', { name })}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => void removeMatch()}>
                      {t('edit.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SideBadge({ side }: { side: string }) {
  const { t } = useTranslation('dna')
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={cn('size-2 rounded-full', sideColor[side] ?? sideColor.U)} />
      {t(`side.${side}`, { defaultValue: t('side.U') })}
    </span>
  )
}

function Legend({
  lanes,
  perSide,
  isolated,
  onToggle,
}: {
  lanes: Lane[]
  perSide: boolean
  isolated?: string | null
  onToggle?: (key: string) => void
}) {
  if (perSide) {
    const sides = [...new Set(lanes.flatMap((l) => l.segments.map((s) => s.side)))]
    return (
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {sides.map((s) => (
          <SideBadge key={s} side={s} />
        ))}
      </div>
    )
  }
  return (
    <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {lanes.map((l) => (
        <button
          key={l.key}
          type="button"
          onClick={() => onToggle?.(l.key)}
          aria-pressed={isolated === l.key}
          className={cn(
            'inline-flex items-center gap-1.5 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
            isolated && isolated !== l.key && 'opacity-50',
            isolated === l.key && 'text-foreground',
          )}
        >
          <span className={cn('size-2 rounded-full', l.color)} />
          {l.label}
        </button>
      ))}
    </div>
  )
}

function MatchDetails({
  match,
  stats,
  ancestors,
  person,
  matchPerson,
}: {
  match: DnaMatch
  stats: ReturnType<typeof matchStats>
  ancestors?: Map<string, DnaPerson>
  person: DnaPerson
  matchPerson?: DnaPerson
}) {
  const { t } = useTranslation('dna')
  const [open, setOpen] = useState(false)
  const segs = [...match.segments].sort((a, b) => {
    const ca = normChromosome(a.chromosome)
    const cb = normChromosome(b.chromosome)
    const na = ca === 'X' ? 23 : Number(ca)
    const nb = cb === 'X' ? 23 : Number(cb)
    return na - nb || a.start - b.start
  })
  return (
    <div className="mt-8 grid gap-8 md:grid-cols-2">
      <div>
        <dl className="grid grid-cols-3 gap-3">
          <Stat label={t('sharedCm')} value={fmtCm(stats.total)} />
          <Stat label={t('segments')} value={String(stats.count)} />
          <Stat label={t('largest')} value={fmtCm(stats.largest)} />
        </dl>
        {matchPerson && (
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to={`/tree/relationship/${person.gramps_id}?with=${matchPerson.gramps_id}`}>
              <Network />
              {t('showConnection')}
            </Link>
          </Button>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-base font-medium">{t('commonAncestors')}</h3>
        {match.ancestor_handles?.length ? (
          <div className="space-y-1">
            {match.ancestor_handles.map((h, i) => {
              const a = ancestors?.get(h)
              return (
                <PersonChip
                  key={h}
                  person={a?.profile ?? match.ancestor_profiles?.[i]}
                  mediaRef={a?.media_list?.[0]}
                  size={32}
                  className="-ml-2"
                />
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noCommonAncestors')}</p>
        )}
      </div>
      {segs.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen} className="md:col-span-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2">
              <ChevronRight className={cn('transition-transform', open && 'rotate-90')} />
              {t('segmentTable')}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 overflow-x-auto rounded-xl border">
              <table className="w-full text-sm tabular-nums">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('chromosome')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('start')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('stop')}</th>
                    <th className="px-3 py-2 text-right font-medium">cM</th>
                    <th className="px-3 py-2 text-right font-medium">SNPs</th>
                    <th className="px-3 py-2 font-medium">{t('sideLabel')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {segs.map((s, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{normChromosome(s.chromosome)}</td>
                      <td className="px-3 py-1.5 text-right">{s.start.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right">{s.stop.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right">{fmtCm(Number(s.cM))}</td>
                      <td className="px-3 py-1.5 text-right">{s.SNPs ? s.SNPs.toLocaleString() : '—'}</td>
                      <td className="px-3 py-1.5">
                        <SideBadge side={s.side} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-serif text-2xl tabular-nums leading-none">{value}</dd>
    </div>
  )
}

function Explainer({ className }: { className?: string }) {
  const { t } = useTranslation('dna')
  return (
    <div className={cn('rounded-xl border bg-card p-6 sm:p-8', className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Dna className="size-5" />
        </span>
        <h2 className="text-2xl font-medium">{t('emptyTitle')}</h2>
      </div>
      <p className="mt-4 max-w-prose text-muted-foreground">{t('emptyBody')}</p>
      <h3 className="mt-6 text-lg font-medium">{t('howTitle')}</h3>
      <ol className="mt-2 max-w-prose list-decimal space-y-2 pl-5 text-sm">
        <li>{t('how1')}</li>
        <li>{t('how2')}</li>
        <li>{t('how3')}</li>
        <li>{t('how4')}</li>
      </ol>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
        {'Chromosome,Start Location,End Location,Centimorgans,Matching SNPs\n1,72017318,98757599,26.4,5120\n7,5103231,13845900,12.1,2410'}
      </pre>
    </div>
  )
}
