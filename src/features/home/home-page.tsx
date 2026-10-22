import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CalendarHeart, FileUp, Network, Pencil, UserPlus, UserRound, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Portrait, refThumbUrl } from '@/components/portrait'
import { ObjectThumb } from '@/components/object-thumb'
import { ObjectPicker } from '@/components/object-picker'
import { EmptyState } from '@/components/states'
import { NoteHtml } from '@/components/note-html'
import { FaceStack, Panel } from '@/components/detail/panel'
import { useCurrentUser } from '@/components/user-menu'
import { mediaThumbUrl } from '@/lib/api'
import { useSearchQuery } from '@/api/enhanced/objects'
import { useAccessToken, useAuth } from '@/lib/auth'
import { TREE_CONFIG, configString, useTreeConfig } from '@/lib/tree-config'
import { apiLocale } from '@/i18n'
import { useMetadata, useObjectByHandle, useObjectById, useObjectList } from '@/lib/queries'
import { useHomePerson } from '@/lib/prefs'
import { describeObject, kindIcon, objectPath } from '@/lib/objects'
import { initials, isEmpty, profileName, timeAgo, yearOf } from '@/lib/format'
import type { EventProfile, FamilyProfile, GEvent, MediaRef, ObjectKind, PersonProfile, Source } from '@/lib/types'
import { usePortraits } from '@/hooks/use-portraits'
import { useTitle } from '@/hooks/use-title'
import { useSchemaOutdated } from '@/features/settings/admin-extra'
import { cn } from '@/lib/utils'

/** Hero buttons: 44px touch targets on phones, pill shaped like the person page actions. */
const heroButton = 'h-11 rounded-full px-5 text-sm sm:h-10'

export function HomePage() {
  const { t, i18n } = useTranslation('home')
  const { data: meta } = useMetadata()
  const { data: me } = useCurrentUser()
  useTitle(t('common:nav.home'))
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 11 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const first = (me?.full_name || me?.name || '').split(' ')[0]
  // an empty tree hides the panels that would only show blanks
  const treeEmpty = !!meta && Object.values(meta.object_counts).every((n) => !n)
  const today = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(now)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14">
      <MaintenanceNotice />

      <header className="mb-8 sm:mb-10">
        <p className="text-sm font-semibold text-brass">{today}</p>
        <h1 className="mt-2 font-serif text-[2.6rem] font-medium leading-[1] tracking-[-0.02em] text-balance sm:text-6xl lg:text-7xl">
          {t(`greeting.${greeting}`)}
          {first ? `, ${first}` : ''}
        </h1>
        {meta && (
          <p className="mt-3 text-lg text-muted-foreground">
            {t('intro', {
              people: meta.object_counts.people.toLocaleString(i18n.language),
              families: meta.object_counts.families.toLocaleString(i18n.language),
            })}
          </p>
        )}
      </header>

      {(!meta || meta.object_counts.people > 0) && <HomeHero />}
      {!treeEmpty && <ArchiveCounts />}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[28rem_minmax(0,1fr)]">
        {/* wide column first in the DOM so phones read the story before the side panels */}
        <div className="grid min-w-0 gap-6 lg:col-start-2 lg:row-start-1 [&>*]:min-w-0">
          <GetStarted />
          <TreeHomeNote />
          {(!meta || meta.object_counts.events > 0) && <OnThisDay />}
        </div>
        <div className="grid min-w-0 gap-6 lg:col-start-1 lg:row-start-1 [&>*]:min-w-0">
          {!treeEmpty && <LatestPost />}
          {!treeEmpty && <RecentlyChanged />}
        </div>
      </div>
    </div>
  )
}

/** Welcome note and picture an owner can set for everyone (Settings → Administration). */
function TreeHomeNote() {
  const { data: config } = useTreeConfig()
  useAccessToken() // re-render when the token in the image URL rotates
  const noteHandle = configString(config, TREE_CONFIG.homePageNote)
  const imageHandle = configString(config, TREE_CONFIG.homePageImage)
  const { data: note } = useObjectByHandle<{ formatted?: { html?: string }; text: { string: string } }>('note', noteHandle || null, {
    formats: 'html',
    format_options: JSON.stringify({ link_format: '/{obj_class}/{gramps_id}' }),
  })
  if (!imageHandle && !note) return null
  return (
    <section className="overflow-hidden rounded-3xl bg-card">
      {imageHandle && (
        <img
          src={mediaThumbUrl(imageHandle, 1200)}
          alt=""
          className={cn('w-full object-cover [filter:sepia(0.12)_contrast(1.03)]', note ? 'aspect-[16/7] max-h-80' : 'max-h-[28rem]')}
        />
      )}
      {note && (
        <div className="p-6 font-serif text-lg leading-relaxed sm:p-8 sm:text-xl">
          <NoteHtml html={note.formatted?.html} text={note.text.string} />
        </div>
      )}
    </section>
  )
}

/** Guidance for a new, (almost) empty tree: add the first person, then a family. */
function GetStarted() {
  const { t } = useTranslation('home')
  const { can } = useAuth()
  const { data: meta } = useMetadata()
  if (!meta || !can('AddObject')) return null
  const c = meta.object_counts
  if (c.people > 0 && c.families > 0) return null
  return (
    <Panel title={t('getStarted.title')}>
      <p className="mb-5 text-muted-foreground">{c.people === 0 ? t('getStarted.noPeople') : t('getStarted.noFamilies')}</p>
      <div className="flex flex-wrap gap-2">
        {c.people === 0 ? (
          <>
            <Button asChild className={heroButton}>
              <Link to="/new_person">
                <UserPlus />
                {t('getStarted.newPerson')}
              </Link>
            </Button>
            {can('ImportFile') && (
              <Button asChild variant="secondary" className={heroButton}>
                <Link to="/import">
                  <FileUp />
                  {t('getStarted.import')}
                </Link>
              </Button>
            )}
          </>
        ) : (
          can('EditObject') && (
            <Button asChild className={heroButton}>
              <Link to="/new_family">
                <UsersRound />
                {t('getStarted.newFamily')}
              </Link>
            </Button>
          )
        )}
      </div>
    </Panel>
  )
}

type HomePerson = { handle: string; gramps_id: string; media_list: MediaRef[]; profile: PersonProfile }

/** The home person as the album's opening page, or an invitation to choose one. */
function HomeHero() {
  const { t } = useTranslation(['home', 'person'])
  useAccessToken()
  const [homeId, setHomeId] = useHomePerson()
  const { data: person, isLoading, isError } = useObjectById<HomePerson>('person', homeId ?? undefined, {
    profile: 'all',
    keys: 'handle,gramps_id,profile,media_list',
  })

  const picker = (label: string, variant: 'default' | 'ghost' = 'default') => (
    <ObjectPicker
      kinds={['person']}
      onChange={(o) => setHomeId(o.gramps_id)}
      placeholder={t('homePerson.choose')}
      trigger={
        variant === 'ghost' ? (
          <Button variant="ghost" size="sm" className="-mr-2 h-9 rounded-full px-3 text-muted-foreground">
            <Pencil />
            {label}
          </Button>
        ) : (
          <Button className={heroButton}>
            <UserRound />
            {label}
          </Button>
        )
      }
    />
  )

  if (!homeId || (isError && !person))
    return (
      <section className="grid overflow-hidden rounded-3xl bg-card sm:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="flex h-44 items-center justify-center bg-gradient-to-b from-secondary to-card sm:h-auto sm:min-h-72">
          <span className="flex size-28 items-center justify-center rounded-full border-2 border-dashed border-brass/50 text-brass/80 sm:size-36">
            <UserRound className="size-12 sm:size-14" strokeWidth={1.25} aria-hidden />
          </span>
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
          <p className="text-sm font-semibold text-brass">{t('homePerson.title')}</p>
          <h2 className="mt-2 font-serif text-3xl font-medium leading-tight tracking-[-0.01em] text-balance sm:text-4xl">
            {t('homePerson.prompt')}
          </h2>
          <p className="mt-3 max-w-prose text-muted-foreground">
            {homeId ? t('homePerson.missing', { id: homeId }) : t('homePerson.empty')}
          </p>
          <div className="mt-6">{picker(t('homePerson.choose'))}</div>
        </div>
      </section>
    )

  if (isLoading || !person)
    return (
      <section className="grid overflow-hidden rounded-3xl bg-card sm:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[19rem_minmax(0,1fr)]">
        <Skeleton className="h-64 rounded-none sm:h-80" />
        <div className="space-y-4 p-6 sm:p-8 lg:p-10">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-10 w-48 rounded-full" />
        </div>
      </section>
    )

  const p = person.profile
  const name = profileName(p)
  const photo = person.media_list?.[0]
  return (
    <section className="grid overflow-hidden rounded-3xl bg-card sm:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[19rem_minmax(0,1fr)]">
      <Link
        to={`/person/${person.gramps_id}`}
        aria-label={name}
        className="group relative block h-[19rem] overflow-hidden bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:h-auto sm:min-h-80"
      >
        {photo ? (
          <img
            src={refThumbUrl(photo, 800, false)}
            alt=""
            className="absolute inset-0 size-full object-cover object-[center_25%] [filter:sepia(0.18)_contrast(1.04)] transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-secondary to-card font-serif text-7xl text-muted-foreground/70">
            {initials(name)}
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8 lg:p-10">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-brass">{t('homePerson.title')}</p>
          <div className="ml-auto">{picker(t('homePerson.change'), 'ghost')}</div>
        </div>
        <h2 className="mt-1 font-serif text-[2.4rem] font-medium leading-[1.02] tracking-[-0.02em] text-balance sm:text-5xl lg:text-6xl">
          <Link to={`/person/${person.gramps_id}`} className="outline-none hover:text-brass focus-visible:text-brass">
            {name}
          </Link>
        </h2>

        <dl className="mt-6 grid grid-cols-2 gap-6 sm:flex sm:gap-12">
          <Vital label={t('person:born')} event={p.birth as EventProfile} />
          <Vital label={t('person:died')} event={p.death as EventProfile} />
        </dl>

        <HomeFamily profile={p} />

        <div className="mt-7 flex flex-wrap gap-2">
          <Button asChild className={heroButton}>
            <Link to={`/tree/ancestor/${person.gramps_id}`}>
              <Network />
              {t('homePerson.openTree')}
            </Link>
          </Button>
          <Button asChild variant="secondary" className={heroButton}>
            <Link to={`/person/${person.gramps_id}`}>
              <UserRound />
              {t('homePerson.openPerson')}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function Vital({ label, event }: { label: string; event?: EventProfile }) {
  if (!event || isEmpty(event)) return null
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <span className="block font-serif text-2xl leading-tight tabular-nums">{event.date || '?'}</span>
        {event.place_name && <span className="block truncate text-sm text-muted-foreground">{event.place_name}</span>}
      </dd>
    </div>
  )
}

/** Parents, partners and children of the home person as one row of faces. */
function HomeFamily({ profile }: { profile: PersonProfile }) {
  const { t } = useTranslation('home')
  const self = profile.handle
  const people: PersonProfile[] = []
  const add = (x?: Partial<PersonProfile> | null) => {
    if (x && !isEmpty(x) && x.handle && x.handle !== self && !people.some((p) => p.handle === x.handle)) people.push(x as PersonProfile)
  }
  const ppf = profile.primary_parent_family as FamilyProfile | undefined
  if (ppf && !isEmpty(ppf)) {
    add(ppf.father as PersonProfile)
    add(ppf.mother as PersonProfile)
  }
  for (const f of profile.families ?? []) {
    add(f.father as PersonProfile)
    add(f.mother as PersonProfile)
    f.children?.forEach(add)
  }
  const portraits = usePortraits(people.map((p) => p.handle))
  if (!people.length) return null
  return (
    <div className="mt-6">
      <div className="mb-2 text-sm text-muted-foreground">{t('homePerson.family')}</div>
      <FaceStack people={people} portraits={portraits} max={6} moreHref={`/person/${profile.gramps_id}#family`} />
    </div>
  )
}

type DayEvent = GEvent & {
  profile: EventProfile & {
    participants?: { people?: Array<{ person: PersonProfile }>; families?: Array<{ family: FamilyProfile }> }
  }
}

function OnThisDay() {
  const { t, i18n } = useTranslation('home')
  const now = new Date()
  const { data: page, isLoading } = useObjectList<DayEvent>('event', {
    dates: `*/${now.getMonth() + 1}/${now.getDate()}`,
    profile: 'all',
    sort: '-date',
    pagesize: 8,
    page: 1,
  })
  const data = page?.items
  const facesOf = (e: DayEvent): PersonProfile[] => {
    const people = (e.profile.participants?.people ?? []).map((x) => x.person).filter((x) => x && !isEmpty(x))
    if (people.length) return people.slice(0, 2)
    const fam = e.profile.participants?.families?.[0]?.family
    return fam ? ([fam.father, fam.mother].filter((x) => x && !isEmpty(x)) as PersonProfile[]) : []
  }
  const portraits = usePortraits((data ?? []).flatMap((e) => facesOf(e).map((p) => p.handle)))
  const dayLabel = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(now)

  return (
    <Panel title={t('onThisDay')} action={<span className="text-sm text-muted-foreground">{dayLabel}</span>}>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState icon={CalendarHeart} title={t('onThisDayEmpty')} className="py-8 [&_p]:text-base" />
      ) : (
        <ol>
          {data.map((e) => {
            const faces = facesOf(e)
            const y = yearOf(e.profile.date)
            const who = faces.map((p) => profileName(p)).join(' & ')
            return (
              <li key={e.handle}>
                <Link
                  to={`/event/${e.gramps_id}`}
                  className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2.5 outline-none transition-colors duration-150 hover:bg-accent/70 focus-visible:bg-accent/70 sm:gap-5"
                >
                  <span className="w-[4.25rem] shrink-0 font-serif text-[2rem] leading-none tabular-nums text-brass sm:w-24 sm:text-[2.75rem]">
                    {y ?? '—'}
                  </span>
                  {faces.length ? (
                    <span className="flex shrink-0">
                      {faces.map((p, i) => (
                        <Portrait
                          key={p.handle}
                          mediaRef={portraits.get(p.handle)}
                          name={profileName(p)}
                          sex={p.sex}
                          size={44}
                          className={cn('ring-[3px] ring-card', i > 0 && '-ml-3')}
                        />
                      ))}
                    </span>
                  ) : (
                    <ObjectThumb kind="event" size={44} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{who || e.profile.type}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[who && e.profile.type, y && t('yearsAgo', { count: now.getFullYear() - y }), e.profile.place_name]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

function RecentlyChanged() {
  const { t, i18n } = useTranslation('home')
  const { data: page, isLoading } = useSearchQuery({ query: '*', sort: '-change', locale: apiLocale(), profile: 'self', page: 1, pagesize: 8 })
  const data = page?.items.filter((hit) => hit.object_type in kindIcon)
  return (
    <Panel title={t('recentlyChanged')}>
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 rounded-2xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">{t('recentlyChangedEmpty')}</p>
      ) : (
        <ul className="space-y-0.5">
          {data.map((hit) => {
            const kind = hit.object_type as ObjectKind
            const o = hit.object
            const d = describeObject(kind, o)
            return (
              <li key={hit.handle}>
                <Link
                  to={objectPath(kind, o.gramps_id)}
                  className="-mx-2 flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent"
                >
                  <ObjectThumb kind={kind} handle={o.handle} mediaRef={o.media_list?.[0]} name={d.title} sex={o.profile?.sex} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{d.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[t(`common:object.${kind}`), o.change ? timeAgo(o.change, i18n.language) : ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/** Latest blog post as a photo-led card. */
function LatestPost() {
  const { t } = useTranslation('home')
  useAccessToken()
  const { data } = useObjectList<Source>('source', {
    rules: JSON.stringify({ rules: [{ name: 'HasTag', values: ['Blog'] }] }),
    sort: '-change',
    page: 1,
    pagesize: 1,
  })
  const post = data?.items[0]
  if (!post) return null
  const cover = post.media_list?.[0]
  return (
    <section className="overflow-hidden rounded-3xl bg-card">
      <Link to={`/blog/${post.gramps_id}`} className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        {cover && (
          <div className="aspect-[4/3] overflow-hidden bg-secondary">
            <img
              src={refThumbUrl(cover, 800, false)}
              alt=""
              loading="lazy"
              className="size-full object-cover [filter:sepia(0.12)_contrast(1.03)] transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          </div>
        )}
        <div className="p-5 sm:p-6">
          <p className="text-sm font-semibold text-brass">{t('latestPost')}</p>
          <p className="mt-2 font-serif text-2xl font-medium leading-tight text-balance group-hover:text-brass">{post.title}</p>
          {post.author && <p className="mt-2 text-sm text-muted-foreground">{post.author}</p>}
        </div>
      </Link>
      <div className="px-5 pb-4 sm:px-6">
        <Link
          to="/blog"
          className="-mx-2 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('allPosts')}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  )
}

/** What the archive holds, as one quiet row of numbers. */
function ArchiveCounts() {
  const { t, i18n } = useTranslation('home')
  const { data: meta } = useMetadata()
  if (!meta) return null
  const rows: Array<[ObjectKind, string, number]> = [
    ['person', '/people', meta.object_counts.people],
    ['family', '/families', meta.object_counts.families],
    ['event', '/events', meta.object_counts.events],
    ['place', '/places', meta.object_counts.places],
    ['media', '/medialist', meta.object_counts.media],
    ['source', '/sources', meta.object_counts.sources],
    ['citation', '/citations', meta.object_counts.citations],
    ['note', '/notes', meta.object_counts.notes],
    ['repository', '/repositories', meta.object_counts.repositories],
  ]
  return (
    <section aria-label={t('inArchive')} className="mt-6 rounded-3xl bg-card px-3 py-3 sm:px-4">
      <dl className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9">
        {rows.map(([k, to, n]) => (
          <Link
            key={k}
            to={to}
            className="group flex flex-col-reverse items-start rounded-2xl px-3 py-2.5 outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent"
          >
            <dt className="mt-1 truncate text-xs text-muted-foreground group-hover:text-foreground">{t(`common:objects.${k}`)}</dt>
            <dd className="font-serif text-2xl leading-none tabular-nums sm:text-[1.7rem]">{n.toLocaleString(i18n.language)}</dd>
          </Link>
        ))}
      </dl>
    </section>
  )
}

/** Owners see when the search index is empty or the database needs an upgrade. */
function MaintenanceNotice() {
  const { t } = useTranslation('home')
  const { can } = useAuth()
  const { data: meta } = useMetadata()
  const outdated = useSchemaOutdated()
  if (!meta) return null
  const objects = Object.values(meta.object_counts).reduce((a, b) => a + (b ?? 0), 0)
  const reindex = can('TriggerReindex') && objects > 0 && (meta.search?.sifts?.count ?? 0) === 0
  const upgrade = can('UpgradeSchema') && outdated
  if (!reindex && !upgrade) return null
  return (
    <div role="status" className="mb-6 flex flex-col gap-3 rounded-3xl bg-brass/10 p-5 sm:flex-row sm:items-center">
      <p className="min-w-0 flex-1 text-sm">{upgrade ? t('maintenance.upgrade') : t('maintenance.reindex')}</p>
      <Button asChild variant="secondary" className={heroButton}>
        <Link to="/settings/administration">{t('maintenance.open')}</Link>
      </Button>
    </div>
  )
}
