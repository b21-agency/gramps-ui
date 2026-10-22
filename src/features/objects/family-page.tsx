import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { refThumbUrl } from '@/components/portrait'
import { ErrorState } from '@/components/states'
import { ObjectHistory } from '@/components/detail/object-history'
import { ObjectToolbar } from '@/components/detail/object-header'
import { FaceRow, Panel } from '@/components/detail/panel'
import { CitationsList, FactsTable, Gallery, NotesList } from '@/components/detail/sections'
import { useAccessToken } from '@/lib/auth'
import { initials, isEmpty, lifespan, profileName, typeStr, yearOf } from '@/lib/format'
import type { EventProfile, Family, MediaRef, PersonProfile } from '@/lib/types'
import { usePortraits } from '@/hooks/use-portraits'
import { cn } from '@/lib/utils'
import { AlbumFrame, AlbumGrid, HeroActions, HeroFacts, ObjectHero, YearTimeline, type TimelineEntry } from './album'
import { countRefs, familyTitle, ObjectSkeleton, referenceItems, RichReferences, useObjectPage } from './shared'

export function FamilyPage() {
  const { id } = useParams()
  const { t } = useTranslation(['objects', 'detail', 'common'])
  const { q, title } = useObjectPage<Family>('family', id, (f) => familyTitle(f.profile, t('common:unknown')) || f.gramps_id)
  const family = q.data
  const profile = family?.profile

  const father = profile?.father as PersonProfile | undefined
  const mother = profile?.mother as PersonProfile | undefined
  const childrenRaw = profile?.children ?? []
  const portraits = usePortraits([father?.handle ?? '', mother?.handle ?? '', ...childrenRaw.map((c) => c.handle)])

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!family || !profile) return <ObjectSkeleton />

  const ext = family.extended ?? {}
  const eventsByHandle = new Map((ext.events ?? []).map((e) => [e.handle, e]))
  const media = family.media_list ?? []
  const notes = family.note_list ?? []
  const cites = family.citation_list ?? []
  const childRefs = new Map(family.child_ref_list.map((c) => [c.ref, c]))
  // members point back to the family; they are already on the page
  const refs = referenceItems(ext.backlinks as never, (profile as { references?: never }).references, ['person'])

  // children by birth order (undated ones keep their place at the end)
  const children = childrenRaw
    .map((c, i) => ({ c, i, y: yearOf((c.birth as EventProfile | undefined)?.date) }))
    .sort((a, b) => (a.y ?? 99999) - (b.y ?? 99999) || a.i - b.i)
    .map((x) => x.c)

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

  /* family life: the family's own events, children born, partners dying */
  const entries: TimelineEntry[] = family.event_ref_list.map((ref, i) => {
    const ev = eventsByHandle.get(ref.ref)
    const p = profile.events?.[i] ?? ({ type: '', date: '', place: '', place_name: '', summary: '' } as EventProfile)
    return {
      key: ev?.handle ?? `ev-${i}`,
      year: yearOf(p.date),
      date: p.date,
      title: p.type || typeStr(ev?.type),
      detail: [p.place || p.place_name, ev?.description && !/^\S+ (of|von) /.test(ev.description) ? ev.description : ''].filter(Boolean).join(' · '),
      to: ev ? `/event/${ev.gramps_id}` : undefined,
      own: true,
    }
  })
  for (const c of children) {
    const b = c.birth as EventProfile | undefined
    if (b && !isEmpty(b) && b.date)
      entries.push({
        key: `c-${c.handle}`,
        year: yearOf(b.date),
        date: b.date,
        title: t('album.childBorn', { name: profileName(c) }),
        detail: b.place_name,
        to: `/person/${c.gramps_id}`,
        own: false,
        who: c,
      })
  }
  for (const p of [father, mother]) {
    const d = p && !isEmpty(p) ? (p.death as EventProfile | undefined) : undefined
    if (p && d && !isEmpty(d) && d.date)
      entries.push({
        key: `d-${p.handle}`,
        year: yearOf(d.date),
        date: d.date,
        title: t('album.died', { name: profileName(p) }),
        detail: d.place_name,
        to: `/person/${p.gramps_id}`,
        own: false,
        who: p,
      })
  }
  entries.sort((a, b) => (a.year ?? 99999) - (b.year ?? 99999))

  return (
    <AlbumFrame>
      <ObjectToolbar kind="family" object={family} title={title} onSaved={() => q.refetch()} />

      <FamilyHero family={family} father={father} mother={mother} portraits={portraits} childCount={children.length} childYears={children} />

      <AlbumGrid
        aside={
          <>
            <Panel id="children" title={t('detail:sections.children')} count={children.length}>
              {children.length ? (
                <ol className="grid gap-0.5">
                  {children.map((c, i) => (
                    <li key={c.handle} className="min-w-0">
                      <FaceRow person={c} portrait={portraits.get(c.handle)} note={childNote(c.handle)} lead={i + 1} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">{t('noChildren')}</p>
              )}
            </Panel>

            {media.length > 0 && (
              <Panel id="gallery" title={t('album.photosAndDocs')} count={media.length}>
                <Gallery refs={media} media={ext.media} />
              </Panel>
            )}

            {family.attribute_list.length > 0 && (
              <Panel id="facts" title={t('detail:sections.facts')}>
                <FactsTable attributes={family.attribute_list} />
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
            <Panel id="events" title={t('album.familyLife')}>
              <YearTimeline entries={entries} portraits={portraits} empty={t('album.noFamilyEvents')} />
            </Panel>

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

            <ObjectHistory objClass="Family" handle={family.handle} lastChange={family.change} />
          </>
        }
      />
    </AlbumFrame>
  )
}

function FamilyHero({
  family,
  father,
  mother,
  portraits,
  childCount,
  childYears,
}: {
  family: Family
  father?: PersonProfile
  mother?: PersonProfile
  portraits: Map<string, MediaRef | undefined>
  childCount: number
  childYears: PersonProfile[]
}) {
  const { t } = useTranslation(['objects', 'common'])
  const profile = family.profile!
  const marriage = profile.marriage as EventProfile | undefined
  const divorce = profile.divorce as EventProfile | undefined
  const surname = profile.family_surname
  const anchor = father && !isEmpty(father) ? father : mother && !isEmpty(mother) ? mother : undefined
  const years = childYears.map((c) => yearOf((c.birth as EventProfile | undefined)?.date)).filter((y): y is number => y != null)
  const span = years.length ? (years[0] === years[years.length - 1] ? `${years[0]}` : `${years[0]}–${years[years.length - 1]}`) : undefined
  const names = [father, mother].filter((p) => p && !isEmpty(p)).map((p) => profileName(p))

  return (
    <ObjectHero
      size="wide"
      visualClassName="bg-background sm:max-w-xl lg:w-[32rem] lg:h-[26rem] lg:max-w-none"
      visual={
        <div className="relative grid size-full grid-cols-2 gap-1.5">
          <PartnerPortrait person={father} portrait={father?.handle ? portraits.get(father.handle) : undefined} side="left" />
          <PartnerPortrait person={mother} portrait={mother?.handle ? portraits.get(mother.handle) : undefined} side="right" />
          <span
            aria-hidden
            className="absolute left-1/2 top-5 flex size-11 -translate-x-1/2 items-center justify-center rounded-full bg-background font-serif text-2xl leading-none text-brass shadow-sm"
          >
            ⚭
          </span>
        </div>
      }
      eyebrow={profile.relationship ? <p className="text-sm font-semibold text-brass">{profile.relationship}</p> : undefined}
      title={
        <>
          {surname ? t('familyOf', { name: surname }) : t('common:object.family')}
          <span className="sr-only">: {familyTitle(profile, t('common:unknown'))}</span>
        </>
      }
      subtitle={names.length ? names.join(' & ') : undefined}
      tags={family.extended?.tags}
      actions={
        anchor?.gramps_id ? (
          <HeroActions>
            <Button asChild size="sm">
              <Link to={`/tree/descendant/${anchor.gramps_id}`}>
                <Network />
                {t('showDescendants')}
              </Link>
            </Button>
          </HeroActions>
        ) : undefined
      }
    >
      <HeroFacts
        className="max-lg:justify-items-center max-lg:text-center sm:max-lg:justify-center"
        items={[
          marriage &&
            !isEmpty(marriage) &&
            (marriage.date || marriage.place_name) && {
              label: marriage.type || t('album.married'),
              value: marriage.date || '?',
              detail: marriage.place_name,
            },
          divorce &&
            !isEmpty(divorce) && {
              label: divorce.type || t('album.divorced'),
              value: divorce.date || '?',
              detail: divorce.place_name,
            },
          {
            label: t('detail:sections.children'),
            value: t('album.children', { count: childCount }),
            detail: span,
          },
        ]}
      />
    </ObjectHero>
  )
}

function PartnerPortrait({ person, portrait, side }: { person?: PersonProfile; portrait?: MediaRef; side: 'left' | 'right' }) {
  const { t } = useTranslation(['objects', 'common'])
  useAccessToken()
  const round = side === 'left' ? 'rounded-l-3xl rounded-r-lg' : 'rounded-r-3xl rounded-l-lg'
  if (!person || isEmpty(person))
    return (
      <div className={cn('flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-secondary to-card p-4 text-center', round)}>
        <span className="font-serif text-6xl text-muted-foreground/60">?</span>
        <span className="text-sm text-muted-foreground">{t('unknownPartner')}</span>
      </div>
    )
  const name = profileName(person) || t('common:unknown')
  return (
    <Link
      to={`/person/${person.gramps_id}`}
      className={cn('group relative block size-full overflow-hidden bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring', round)}
    >
      {portrait ? (
        <img
          src={refThumbUrl(portrait, 700, false)}
          alt=""
          className="size-full object-cover [filter:sepia(0.18)_contrast(1.04)] transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <span className="flex size-full items-center justify-center bg-gradient-to-b from-secondary to-card font-serif text-6xl text-muted-foreground/70">
          {initials(name)}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-3 pt-10 text-white sm:px-4">
        <span className="block font-serif text-lg leading-tight text-balance sm:text-xl">{name}</span>
        <span className="block text-xs tabular-nums text-white/75">{lifespan(person.birth as EventProfile, person.death as EventProfile)}</span>
      </span>
    </Link>
  )
}
