import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CalendarHeart, FileUp, Network, Pencil, UserPlus, UserRound, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Page } from '@/components/app-shell'
import { Portrait } from '@/components/portrait'
import { ObjectPicker } from '@/components/object-picker'
import { EmptyState } from '@/components/states'
import { NoteHtml } from '@/components/note-html'
import { useCurrentUser } from '@/components/user-menu'
import { api, mediaThumbUrl } from '@/lib/api'
import { useAccessToken, useAuth } from '@/lib/auth'
import { TREE_CONFIG, configString, useTreeConfig } from '@/lib/tree-config'
import { apiLocale } from '@/i18n'
import { useMetadata, useObjectById } from '@/lib/queries'
import { useHomePerson } from '@/lib/prefs'
import { describeObject, kindIcon, objectPath } from '@/lib/objects'
import { profileName, timeAgo, yearOf } from '@/lib/format'
import type { EventProfile, GEvent, MediaRef, ObjectKind, PersonProfile, SearchHit, Source } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'

export function HomePage() {
  const { t } = useTranslation('home')
  const { data: meta } = useMetadata()
  const { data: me } = useCurrentUser()
  useTitle(t('common:nav.home'))
  const hour = new Date().getHours()
  const greeting = hour < 11 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const first = (me?.full_name || me?.name || '').split(' ')[0]
  // an empty tree hides the panels that would only show blanks
  const treeEmpty = !!meta && Object.values(meta.object_counts).every((n) => !n)

  return (
    <Page>
      <header className="mb-8">
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
          {t(`greeting.${greeting}`)}
          {first ? `, ${first}` : ''}
        </h1>
        {meta && (
          <p className="mt-2 text-lg text-muted-foreground">
            {t('intro', {
              people: meta.object_counts.people.toLocaleString(),
              families: meta.object_counts.families.toLocaleString(),
            })}
          </p>
        )}
      </header>

      <TreeHomeNote />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <GetStarted />
          {(!meta || meta.object_counts.people > 0) && <HomePersonCard />}
          {!treeEmpty && <RecentlyChanged />}
        </div>
        <div className="min-w-0 space-y-6">
          {(!meta || meta.object_counts.events > 0) && <OnThisDay />}
          {!treeEmpty && <LatestPost />}
          {!treeEmpty && <ArchiveCounts />}
        </div>
      </div>
    </Page>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xl font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Welcome note and picture an owner can set for everyone (Settings → Administration). */
function TreeHomeNote() {
  const { data: config } = useTreeConfig()
  useAccessToken() // re-render when the token in the image URL rotates
  const noteHandle = configString(config, TREE_CONFIG.homePageNote)
  const imageHandle = configString(config, TREE_CONFIG.homePageImage)
  const { data: note } = useQuery({
    queryKey: ['notes', 'handle', noteHandle, 'html'],
    enabled: !!noteHandle,
    queryFn: () =>
      api<{ formatted?: { html?: string }; text: { string: string } }>(`/notes/${noteHandle}`, {
        query: { formats: 'html', format_options: JSON.stringify({ link_format: '/{obj_class}/{gramps_id}' }) },
      }),
  })
  if (!imageHandle && !note) return null
  const image = imageHandle ? (
    <img
      src={mediaThumbUrl(imageHandle, 800)}
      alt=""
      className={noteHandle ? 'max-h-56 w-full rounded-lg object-cover sm:w-64' : 'max-h-72 w-full rounded-xl object-cover'}
    />
  ) : null
  if (!note) return <div className="mb-6">{image}</div>
  return (
    <div className="mb-6 flex flex-col gap-5 rounded-xl border bg-card p-5 sm:flex-row sm:items-start">
      {image && <div className="shrink-0">{image}</div>}
      <div className="min-w-0 flex-1 font-serif text-[1.05rem] leading-relaxed">
        <NoteHtml html={note.formatted?.html} text={note.text.string} />
      </div>
    </div>
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
    <Section title={t('getStarted.title')}>
      <p className="mb-4 text-muted-foreground">{c.people === 0 ? t('getStarted.noPeople') : t('getStarted.noFamilies')}</p>
      <div className="flex flex-wrap gap-2">
        {c.people === 0 ? (
          <>
            <Button asChild>
              <Link to="/new_person">
                <UserPlus />
                {t('getStarted.newPerson')}
              </Link>
            </Button>
            {can('ImportFile') && (
              <Button asChild variant="outline">
                <Link to="/import">
                  <FileUp />
                  {t('getStarted.import')}
                </Link>
              </Button>
            )}
          </>
        ) : (
          can('EditObject') && (
            <Button asChild>
              <Link to="/new_family">
                <UsersRound />
                {t('getStarted.newFamily')}
              </Link>
            </Button>
          )
        )}
      </div>
    </Section>
  )
}

function HomePersonCard() {
  const { t } = useTranslation('home')
  const [homeId, setHomeId] = useHomePerson()
  const { data: person, isLoading, isError } = useObjectById<{
    handle: string
    gramps_id: string
    media_list: MediaRef[]
    profile: PersonProfile
  }>('person', homeId ?? undefined, { profile: 'self', keys: 'handle,gramps_id,profile,media_list' })

  const picker = (label: string, variant: 'default' | 'ghost' = 'default') => (
    <ObjectPicker
      kinds={['person']}
      onChange={(o) => setHomeId(o.gramps_id)}
      placeholder={t('homePerson.choose')}
      trigger={
        <Button variant={variant} size={variant === 'ghost' ? 'sm' : 'default'}>
          {variant === 'ghost' && <Pencil />}
          {label}
        </Button>
      }
    />
  )

  if (!homeId)
    return (
      <Section title={t('homePerson.title')}>
        <p className="mb-4 text-muted-foreground">{t('homePerson.empty')}</p>
        {picker(t('homePerson.choose'))}
      </Section>
    )

  if (isError && !person)
    return (
      <Section title={t('homePerson.title')}>
        <p className="mb-4 text-muted-foreground">{t('homePerson.missing', { id: homeId })}</p>
        {picker(t('homePerson.choose'))}
      </Section>
    )

  if (isLoading || !person)
    return (
      <Section title={t('homePerson.title')}>
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </Section>
    )

  const p = person.profile
  const name = profileName(p)
  const birth = p.birth as EventProfile
  const death = p.death as EventProfile
  return (
    <Section title={t('homePerson.title')} action={picker(t('homePerson.change'), 'ghost')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Portrait mediaRef={person.media_list?.[0]} name={name} sex={p.sex} size={88} />
        <div className="min-w-0 flex-1">
          <Link to={`/person/${person.gramps_id}`} className="font-serif text-2xl font-medium hover:underline">
            {name}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {[birth?.date && `* ${birth.date}${birth.place_name ? `, ${birth.place_name}` : ''}`, death?.date && `† ${death.date}${death.place_name ? `, ${death.place_name}` : ''}`]
              .filter(Boolean)
              .join('   ')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to={`/tree/ancestor/${person.gramps_id}`}>
                <Network />
                {t('homePerson.openTree')}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to={`/person/${person.gramps_id}`}>
                <UserRound />
                {t('homePerson.openPerson')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  )
}

function OnThisDay() {
  const { t } = useTranslation('home')
  const now = new Date()
  const { data, isLoading } = useQuery({
    queryKey: ['events', 'anniversaries', now.getMonth() + 1, now.getDate(), apiLocale()],
    queryFn: () =>
      api<Array<GEvent & { profile: EventProfile & { participants?: { people?: Array<{ person: PersonProfile }> } } }>>(
        '/events/',
        {
          query: {
            dates: `*/${now.getMonth() + 1}/${now.getDate()}`,
            profile: 'all',
            sort: '-date',
            locale: apiLocale(),
            pagesize: 8,
            page: 1,
          },
        },
      ),
  })
  return (
    <Section title={t('onThisDay')}>
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState icon={CalendarHeart} title={t('onThisDayEmpty')} className="py-6 [&_p]:text-base" />
      ) : (
        <ul className="-mx-2">
          {data.map((e) => {
            const person = e.profile.participants?.people?.[0]?.person
            const y = yearOf(e.profile.date)
            return (
              <li key={e.handle}>
                <Link to={`/event/${e.gramps_id}`} className="flex items-baseline gap-3 rounded-lg px-2 py-2 hover:bg-accent">
                  <span className="w-12 shrink-0 font-serif text-lg tabular-nums text-brass">{y}</span>
                  <span className="min-w-0">
                    <span className="block truncate">
                      {e.profile.type}
                      {person ? ` · ${profileName(person)}` : ''}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[y && t('yearsAgo', { count: now.getFullYear() - y }), e.profile.place_name].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function RecentlyChanged() {
  const { t, i18n } = useTranslation('home')
  const { data, isLoading } = useQuery({
    queryKey: ['search', 'recent-changes', apiLocale()],
    queryFn: () =>
      api<SearchHit[]>('/search/', {
        query: { query: '*', sort: '-change', locale: apiLocale(), profile: 'self', page: 1, pagesize: 8 },
      }),
  })
  return (
    <Section title={t('recentlyChanged')}>
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">{t('recentlyChangedEmpty')}</p>
      ) : (
        <ul className="-mx-2">
          {data.filter((hit) => hit.object_type in kindIcon).map((hit) => {
            const kind = hit.object_type as ObjectKind
            const Icon = kindIcon[kind]
            const d = describeObject(kind, hit.object)
            return (
              <li key={hit.handle}>
                <Link
                  to={objectPath(kind, hit.object.gramps_id)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{d.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[t(`common:object.${kind}`), d.subtitle].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(hit.object.change, i18n.language)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function LatestPost() {
  const { t } = useTranslation('home')
  const { data } = useQuery({
    queryKey: ['sources', 'blog', 'latest', apiLocale()],
    queryFn: () =>
      api<Source[]>('/sources/', {
        query: {
          rules: JSON.stringify({ rules: [{ name: 'HasTag', values: ['Blog'] }] }),
          sort: '-change',
          page: 1,
          pagesize: 1,
          locale: apiLocale(),
        },
      }),
  })
  const post = data?.[0]
  if (!post) return null
  return (
    <Section title={t('latestPost')}>
      <Link to={`/blog/${post.gramps_id}`} className="group block">
        <p className="font-serif text-xl leading-snug group-hover:underline">{post.title}</p>
        {post.author && <p className="mt-1 text-sm text-muted-foreground">{post.author}</p>}
      </Link>
    </Section>
  )
}

function ArchiveCounts() {
  const { t } = useTranslation('home')
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
    <Section title={t('inArchive')}>
      <dl className="-mx-2 grid grid-cols-2 gap-x-2">
        {rows.map(([k, to, n]) => {
          const Icon = kindIcon[k]
          return (
            <Link key={k} to={to} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent">
              <Icon className="size-4 text-muted-foreground" />
              <dt className="flex-1 truncate text-sm">{t(`common:objects.${k}`)}</dt>
              <dd className="font-serif tabular-nums">{n.toLocaleString()}</dd>
            </Link>
          )
        })}
      </dl>
    </Section>
  )
}

