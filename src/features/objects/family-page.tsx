import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Portrait } from '@/components/portrait'
import { PersonChip } from '@/components/person-chip'
import { TagList } from '@/components/tag-list'
import { ErrorState } from '@/components/states'
import { ObjectHistory } from '@/components/detail/object-history'
import { ObjectToolbar } from '@/components/detail/object-header'
import {
  CitationsList,
  DetailSection,
  EventsTable,
  FactsTable,
  Gallery,
  NotesList,
  SectionNav,
  type EventRow,
} from '@/components/detail/sections'
import { isEmpty, profileName, typeStr } from '@/lib/format'
import type { EventProfile, Family, MediaRef, PersonProfile } from '@/lib/types'
import { usePortraits } from '@/hooks/use-portraits'
import { cn } from '@/lib/utils'
import {
  Columns,
  countRefs,
  familyTitle,
  navItems,
  ObjectSkeleton,
  PageFrame,
  referenceItems,
  RichReferences,
  useObjectPage,
} from './shared'

export function FamilyPage() {
  const { id } = useParams()
  const { t } = useTranslation(['objects', 'detail', 'common'])
  const { q, title } = useObjectPage<Family>('family', id, (f) => familyTitle(f.profile, t('common:unknown')) || f.gramps_id)
  const family = q.data
  const profile = family?.profile

  const father = profile?.father as PersonProfile | undefined
  const mother = profile?.mother as PersonProfile | undefined
  const children = profile?.children ?? []
  const portraits = usePortraits([father?.handle ?? '', mother?.handle ?? '', ...children.map((c) => c.handle)])

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!family || !profile) return <ObjectSkeleton />

  const ext = family.extended ?? {}
  const eventsByHandle = new Map((ext.events ?? []).map((e) => [e.handle, e]))
  const eventRows: EventRow[] = family.event_ref_list.map((ref, i) => ({
    event: eventsByHandle.get(ref.ref),
    profile: profile.events?.[i] ?? ({ type: '', date: '', place: '', place_name: '', summary: '' } as EventProfile),
  }))
  const media = family.media_list ?? []
  const notes = family.note_list ?? []
  const cites = family.citation_list ?? []
  const childRefs = new Map(family.child_ref_list.map((c) => [c.ref, c]))
  // members point back to the family; they are already on the page
  const refs = referenceItems(ext.backlinks as never, (profile as { references?: never }).references, ['person'])

  const nav = navItems([
    { id: 'children', label: t('detail:sections.children'), count: children.length },
    eventRows.length > 0 && { id: 'events', label: t('detail:sections.events'), count: eventRows.length },
    media.length > 0 && { id: 'gallery', label: t('detail:sections.gallery'), count: media.length },
    notes.length > 0 && { id: 'notes', label: t('detail:sections.notes'), count: notes.length },
    cites.length > 0 && { id: 'sources', label: t('detail:sections.sources'), count: cites.length },
    family.attribute_list.length > 0 && { id: 'facts', label: t('detail:sections.facts') },
    refs.length > 0 && { id: 'references', label: t('detail:sections.references'), count: countRefs(refs) },
  ])

  const childNote = (h: string) => {
    const r = childRefs.get(h)
    if (!r) return undefined
    const f = typeStr(r.frel)
    const m = typeStr(r.mrel)
    if (f === 'Birth' && m === 'Birth') return undefined
    if (f === m) return t(`childRel.${f}`, { defaultValue: f })
    return [f !== 'Birth' && `${t('father')}: ${t(`childRel.${f}`, { defaultValue: f })}`, m !== 'Birth' && `${t('mother')}: ${t(`childRel.${m}`, { defaultValue: m })}`]
      .filter(Boolean)
      .join(', ')
  }

  return (
    <PageFrame>
      <ObjectToolbar kind="family" object={family} title={title} onSaved={() => q.refetch()} />

      <FamilyHero family={family} father={father} mother={mother} portraits={portraits} />

      <SectionNav items={nav} />

      <Columns
        main={
          <>
            <DetailSection id="children" title={t('detail:sections.children')} count={children.length}>
              {children.length ? (
                <ol className="grid gap-1 sm:grid-cols-2">
                  {children.map((c, i) => (
                    <li key={c.handle} className="flex min-w-0 items-center gap-1">
                      <span className="w-5 shrink-0 text-right font-serif text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                      <PersonChip person={c} mediaRef={portraits.get(c.handle)} note={childNote(c.handle)} size={44} className="flex-1" />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">{t('noChildren')}</p>
              )}
            </DetailSection>

            {eventRows.length > 0 && (
              <DetailSection id="events" title={t('detail:sections.events')} count={eventRows.length}>
                <EventsTable rows={eventRows} />
              </DetailSection>
            )}

            {notes.length > 0 && (
              <DetailSection id="notes" title={t('detail:sections.notes')} count={notes.length}>
                <NotesList handles={notes} />
              </DetailSection>
            )}

            {cites.length > 0 && (
              <DetailSection id="sources" title={t('detail:sections.sources')} count={cites.length}>
                <CitationsList handles={cites} />
              </DetailSection>
            )}
          </>
        }
        aside={
          <>
            {media.length > 0 && (
              <DetailSection id="gallery" title={t('detail:sections.gallery')} count={media.length}>
                <Gallery refs={media} media={ext.media} />
              </DetailSection>
            )}
            {family.attribute_list.length > 0 && (
              <DetailSection id="facts" title={t('detail:sections.facts')}>
                <FactsTable attributes={family.attribute_list} />
              </DetailSection>
            )}
            {refs.length > 0 && (
              <DetailSection id="references" title={t('detail:sections.references')} count={countRefs(refs)}>
                <RichReferences groups={refs} />
              </DetailSection>
            )}
            <ObjectHistory objClass="Family" handle={family.handle} lastChange={family.change} />
          </>
        }
      />
    </PageFrame>
  )
}

function FamilyHero({
  family,
  father,
  mother,
  portraits,
}: {
  family: Family
  father?: PersonProfile
  mother?: PersonProfile
  portraits: Map<string, MediaRef | undefined>
}) {
  const { t } = useTranslation(['objects', 'common'])
  const profile = family.profile!
  const marriage = profile.marriage as EventProfile | undefined
  const divorce = profile.divorce as EventProfile | undefined
  const surname = profile.family_surname
  const anchor = father && !isEmpty(father) ? father : mother && !isEmpty(mother) ? mother : undefined

  return (
    <header className="mb-8">
      <h1 className="mb-5 text-2xl font-medium tracking-tight sm:text-3xl">
        {surname ? t('familyOf', { name: surname }) : t('common:object.family')}
        <span className="sr-only">: {familyTitle(profile, t('common:unknown'))}</span>
      </h1>
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-6">
        <PartnerCard person={father} portrait={father?.handle ? portraits.get(father.handle) : undefined} role={t('partner')} />
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <span aria-hidden className="font-serif text-3xl leading-none text-brass">⚭</span>
          {profile.relationship && <span className="text-sm font-medium">{profile.relationship}</span>}
          {marriage && !isEmpty(marriage) && (marriage.date || marriage.place_name) && (
            <span className="max-w-[14rem] text-xs text-muted-foreground">
              <span className="tabular-nums">{marriage.date}</span>
              {marriage.place_name && (
                <>
                  {marriage.date && <br />}
                  {marriage.place_name}
                </>
              )}
            </span>
          )}
          {divorce && !isEmpty(divorce) && (
            <span className="text-xs text-muted-foreground">
              {divorce.type} <span className="tabular-nums">{divorce.date}</span>
            </span>
          )}
        </div>
        <PartnerCard person={mother} portrait={mother?.handle ? portraits.get(mother.handle) : undefined} role={t('partner')} align="end" />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {anchor?.gramps_id && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/tree/descendant/${anchor.gramps_id}`}>
              <Network />
              {t('showDescendants')}
            </Link>
          </Button>
        )}
        <TagList tags={family.extended?.tags} />
      </div>
    </header>
  )
}

function PartnerCard({
  person,
  portrait,
  role,
  align = 'start',
}: {
  person?: PersonProfile
  portrait?: MediaRef
  role: string
  align?: 'start' | 'end'
}) {
  const { t } = useTranslation(['objects', 'common'])
  const end = align === 'end'
  if (!person || isEmpty(person)) {
    return (
      <div
        className={cn(
          'flex items-center gap-4 rounded-xl border border-dashed p-4 text-muted-foreground',
          end && 'sm:flex-row-reverse sm:text-right',
        )}
      >
        <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-secondary font-serif text-2xl">?</span>
        <span>{t('unknownPartner')}</span>
      </div>
    )
  }
  const name = profileName(person)
  const birth = person.birth as EventProfile
  const death = person.death as EventProfile
  const line = (sym: string, e: EventProfile) =>
    !isEmpty(e) && (e.date || e.place_name) ? (
      <span className="block truncate">
        <span className="mr-1 text-muted-foreground">{sym}</span>
        <span className="tabular-nums">{e.date || '?'}</span>
        {e.place_name && <span className="text-muted-foreground"> · {e.place_name}</span>}
      </span>
    ) : null
  return (
    <Link
      to={`/person/${person.gramps_id}`}
      aria-label={`${role}: ${name}`}
      className={cn(
        'group flex min-w-0 items-center gap-4 rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring',
        end && 'sm:flex-row-reverse sm:text-right',
      )}
    >
      <Portrait mediaRef={portrait} name={name} sex={person.sex} size={88} className="ring-4" />
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-2xl leading-tight text-balance group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
          {name || t('common:unknown')}
        </span>
        <span className="mt-1.5 block text-sm">
          {line('*', birth)}
          {line('†', death)}
        </span>
      </span>
    </Link>
  )
}
