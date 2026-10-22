import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, ChevronRight, Dna, ExternalLink, Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Portrait } from '@/components/portrait'
import { ObjectPicker } from '@/components/object-picker'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { useAuth } from '@/lib/auth'
import { lifespan, profileName, yearOf } from '@/lib/format'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import { AlbumHeader, albumFrame, pill } from '@/components/album-page'
import { Panel } from '@/components/detail/panel'
import { errorMessage, txGrampsId } from '@/features/editor/lib'
import { saveYDna, useYDna, useYDnaPeople, type Clade, type DnaPerson } from './data'
import { DnaTabs, useDefaultPerson } from './dna-tabs'
import { RawDataField, type PersonValue } from './match-dialog'

export function YDnaPage() {
  const { t } = useTranslation(['dna', 'common'])
  useTitle(t('ydna.title'))
  const { id } = useParams()
  const { can } = useAuth()
  const people = useYDnaPeople()
  const selected = people.data?.find((p) => p.gramps_id === id)
  const [adding, setAdding] = useState(false)
  useDefaultPerson('/ydna', id, people.data)

  if (people.isError) return <ErrorState error={people.error} onRetry={() => people.refetch()} />

  return (
    <div className={albumFrame}>
      <AlbumHeader
        title={t('ydna.title')}
        description={t('ydna.intro')}
        actions={
          can('EditObject') && (
            <Button className={pill} onClick={() => setAdding(true)}>
              <Plus />
              {t('ydna.add')}
            </Button>
          )
        }
      />
      <DnaTabs id={id} />
      <YDnaDialog open={adding} onOpenChange={setAdding} />
      {people.data && people.data.length === 0 ? (
        <EmptyState icon={Dna} title={t('ydna.empty')} className="rounded-3xl bg-card">
          {t('ydna.emptyHint')}
        </EmptyState>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] 2xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className={cn('min-w-0 lg:sticky lg:top-20', id && 'hidden lg:block')}>
            <Panel title={t('testedPeople')} count={people.data?.length} className="p-4 sm:p-5">
            {people.isLoading ? (
              <RowsSkeleton rows={4} />
            ) : (
              <ul className="space-y-0.5">
                {(people.data ?? []).map((p) => {
                  const name = profileName(p.profile) || p.gramps_id
                  const active = p.gramps_id === id
                  return (
                    <li key={p.handle}>
                      <Link
                        to={`/ydna/${p.gramps_id}`}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          '-mx-1 flex items-center gap-3 rounded-2xl px-2 py-1.5 outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent',
                          active && 'bg-accent',
                        )}
                      >
                        <Portrait mediaRef={p.media_list?.[0]} name={name} sex={p.profile?.sex} size={44} className={cn(active && 'ring-2 ring-brass')} />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{name}</span>
                        <ChevronRight className="size-4 text-muted-foreground lg:hidden" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            </Panel>
          </aside>
          <section className={cn('min-w-0', !id && 'hidden lg:block')}>
            {selected ? (
              <YDnaView person={selected} />
            ) : id && people.data ? (
              <EmptyState title={t('ydna.noData')} className="rounded-3xl bg-card" />
            ) : id ? (
              <RowsSkeleton rows={4} />
            ) : (
              <EmptyState icon={Dna} title={t('pickPerson')} className="rounded-3xl bg-card" />
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function YDnaView({ person }: { person: DnaPerson }) {
  const { t } = useTranslation(['dna', 'common'])
  const { can } = useAuth()
  const q = useYDna(person.handle)
  const [editing, setEditing] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const lineage = q.data?.clade_lineage ?? []
  const leaf = lineage.at(-1)?.name

  return (
    <div className="min-w-0">
      <Button variant="ghost" className="-ml-3 mb-3 h-11 rounded-full px-3 text-muted-foreground lg:hidden" asChild>
        <Link to="/ydna">
          <ArrowLeft />
          {t('testedPeople')}
        </Link>
      </Button>
      <header className="mb-8 flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <Link to={`/person/${person.gramps_id}`} className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Portrait mediaRef={person.media_list?.[0]} name={profileName(person.profile)} sex={person.profile?.sex} size={112} className="ring-4 ring-card" />
        </Link>
        <div className="min-w-0">
          <h2 className="font-serif text-[2.4rem] font-medium leading-[1.02] tracking-[-0.02em] text-balance sm:text-5xl lg:text-6xl">
            <Link to={`/person/${person.gramps_id}`} className="outline-none hover:text-brass focus-visible:text-brass">
              {profileName(person.profile) || person.gramps_id}
            </Link>
          </h2>
          <p className="mt-2 text-muted-foreground tabular-nums">
            {lifespan(person.profile?.birth as { date?: string }, person.profile?.death as { date?: string })}
          </p>
        </div>
      </header>
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading && <RowsSkeleton rows={4} />}
      {q.data && (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          {leaf ? (
            <section className="min-w-0 rounded-3xl bg-card p-5 sm:p-6">
              <h2 className="mb-2 font-serif text-2xl font-medium">{t('ydna.haplogroup')}</h2>
              <p className="text-sm text-muted-foreground">{t('ydna.haplogroupHint')}</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <a
                  href={`https://yfull.com/tree/${encodeURIComponent(leaf)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 font-serif text-5xl text-brass hover:underline"
                >
                  {leaf}
                  <ExternalLink className="size-4 text-muted-foreground" />
                </a>
                <span className="text-sm text-muted-foreground">
                  <a href="https://yfull.com/" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                    YFull
                  </a>
                  {q.data.tree_version ? ` v${q.data.tree_version}` : ''}
                </span>
              </p>
            </section>
          ) : (
            <EmptyState icon={Dna} title={t('ydna.noHaplogroup')} className="rounded-3xl bg-card">
              {t('ydna.noHaplogroupHint')}
            </EmptyState>
          )}
          {lineage.length > 0 && (
            <section className="min-w-0 rounded-3xl bg-card p-5 sm:p-6 xl:row-span-2">
              <h2 className="mb-4 font-serif text-2xl font-medium">{t('ydna.lineage')}</h2>
              <Lineage clades={lineage} person={person} />
            </section>
          )}
          <section className="min-w-0 rounded-3xl bg-card p-5 sm:p-6">
            <h2 className="mb-4 font-serif text-2xl font-medium">{t('ydna.raw')}</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className={pill} onClick={() => setShowRaw((v) => !v)} aria-expanded={showRaw}>
                <ChevronRight className={cn('transition-transform', showRaw && 'rotate-90')} />
                {showRaw ? t('ydna.hideRaw') : t('ydna.showRaw')}
              </Button>
              {can('EditObject') && (
                <Button variant="secondary" className={pill} onClick={() => setEditing(true)}>
                  <Pencil />
                  {t('ydna.edit')}
                </Button>
              )}
            </div>
            {showRaw && (
              <pre className="mt-4 max-h-72 overflow-auto rounded-2xl bg-secondary p-4 text-xs whitespace-pre-wrap break-words">
                {q.data.raw_data || '—'}
              </pre>
            )}
          </section>
        </div>
      )}
      <YDnaDialog
        open={editing}
        onOpenChange={setEditing}
        person={{ handle: person.handle, title: profileName(person.profile) || person.gramps_id }}
        initial={q.data?.raw_data ?? ''}
      />
    </div>
  )
}

/** Year (CE/BCE) from "years before 2000" as used by YFull. */
function formatBp(bp: number | undefined, lang: string) {
  if (bp == null || Number.isNaN(Number(bp))) return ''
  let year = Math.round(2000 - Number(bp))
  if (year < 0) year += 1
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', timeZone: 'UTC', ...(year <= 0 ? { era: 'short' } : {}) }
  const d = new Date(Date.UTC(2000, 0, 1))
  d.setUTCFullYear(year)
  try {
    return new Intl.DateTimeFormat(lang, opts).format(d)
  } catch {
    return String(year)
  }
}

interface Box {
  name: string
  year: string
  gap?: number
  person?: boolean
}

/** Clades from the root to the person, with the time between them. Collapsed: the last two clades. */
function Lineage({ clades, person }: { clades: Clade[]; person: DnaPerson }) {
  const { t, i18n } = useTranslation(['dna', 'common'])
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? clades : clades.slice(-2)
  const gens = (a?: number, b?: number) =>
    a && b && a > 0 && b > 0 ? Math.round(Math.abs(Number(a) - Number(b)) / 20) : undefined

  const boxes: Box[] = shown.map((c, i) => ({
    name: c.name,
    year: `≈ ${formatBp(c.age_info?.formed, i18n.language)}`,
    gap: i < shown.length - 1 ? gens(c.age_info?.formed, shown[i + 1].age_info?.formed) : undefined,
  }))
  const last = clades.at(-1)
  const formed = last?.age_info?.formed
  const mrca = last?.age_info?.most_recent_common_ancestor
  const hasMrca = !!formed && !!mrca && formed > 0 && mrca > 0 && formed !== mrca
  if (hasMrca && last) {
    boxes[boxes.length - 1].gap = gens(formed, mrca)
    boxes.push({ name: `${last.name} MRCA`, year: `≈ ${formatBp(mrca, i18n.language)}` })
  }
  const birth = yearOf((person.profile?.birth as { date?: string } | undefined)?.date)
  const lastBp = hasMrca ? mrca : formed
  if (boxes.length && lastBp && birth) boxes[boxes.length - 1].gap = Math.round(Math.abs(2000 - Number(lastBp) - birth) / 20)
  boxes.push({ name: profileName(person.profile) || person.gramps_id, year: birth ? String(birth) : '', person: true })

  const gapText = (n?: number) => (n === undefined ? '' : n === 0 ? t('ydna.fewGenerations') : t('ydna.generations', { count: n }))

  return (
    <div>
      {clades.length > 3 && (
        <Button variant="ghost" className="-ml-2 mb-2 h-11 rounded-full sm:h-9" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t('common:actions.showLess') : t('ydna.showAllClades', { count: clades.length })}
        </Button>
      )}
      <ol className="relative ml-1 border-l-2 border-lineage pl-6">
        {boxes.map((b, i) => (
          <li key={`${b.name}-${i}`} className="relative pb-1">
            <span
              className={cn(
                'absolute top-2 -left-[2.05rem] size-3.5 rounded-full ring-4 ring-card',
                b.person ? 'bg-brass' : 'bg-primary',
              )}
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline gap-x-3">
              {b.person ? (
                <Link to={`/person/${person.gramps_id}`} className="font-serif text-lg hover:underline">
                  {b.name}
                </Link>
              ) : (
                <a
                  href={`https://yfull.com/tree/${encodeURIComponent(b.name.replace(/ MRCA$/, ''))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-serif text-lg hover:underline"
                >
                  {b.name}
                </a>
              )}
              <span className="font-serif text-base tabular-nums text-brass">{b.year}</span>
            </div>
            {b.gap !== undefined && <p className="py-2 text-xs text-muted-foreground">{gapText(b.gap)}</p>}
            {b.gap === undefined && i < boxes.length - 1 && <div className="h-3" />}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Add Y-DNA data for a person (choose person) or edit it (fixed person). */
function YDnaDialog({
  open,
  onOpenChange,
  person,
  initial = '',
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  person?: PersonValue
  initial?: string
}) {
  const { t } = useTranslation(['dna', 'common'])
  const navigate = useNavigate()
  const { id } = useParams()
  const [who, setWho] = useState<PersonValue | null>(person ?? null)
  const [raw, setRaw] = useState(initial)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) return
    setWho(person ?? null)
    setRaw(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const valid = !!who && raw.trim() !== ''

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || !who || saving) return
    setSaving(true)
    try {
      const tx = await saveYDna(who.handle, raw.trim())
      toast.success(t('ydna.saved'))
      onOpenChange(false)
      const gid = txGrampsId(tx, who.handle)
      if (gid && gid !== id) navigate(`/ydna/${gid}`)
    } catch (err) {
      toast.error(t('edit.failed'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{person ? t('ydna.editTitle') : t('ydna.add')}</DialogTitle>
            <DialogDescription>{t('ydna.formDescription')}</DialogDescription>
          </DialogHeader>
          {!person && (
            <div className="grid gap-1.5">
              <Label>{t('ydna.person')}</Label>
              <ObjectPicker
                kinds={['person']}
                value={who}
                onChange={(o) => setWho({ handle: o.handle, title: o.title })}
                placeholder={t('edit.choosePerson')}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="ydna-raw">{t('ydna.raw')}</Label>
            <RawDataField id="ydna-raw" value={raw} onChange={setRaw} rows={8} placeholder={t('ydna.placeholder')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving && <Loader2 className="animate-spin" />}
              {t('common:actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
