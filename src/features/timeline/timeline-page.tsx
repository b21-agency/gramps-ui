import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Map as MapIcon, UserRound, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ObjectPicker } from '@/components/object-picker'
import { Portrait } from '@/components/portrait'
import { ErrorState } from '@/components/states'
import { useObjectById } from '@/lib/queries'
import { useHomePerson } from '@/lib/prefs'
import { lifespan, profileName } from '@/lib/format'
import type { Person } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import { GlobalTimeline } from './global-timeline'
import { PersonTimeline } from './person-timeline'

export function TimelinePage() {
  const { t } = useTranslation(['timeline', 'common'])
  const [params, setParams] = useSearchParams()
  const [home] = useHomePerson()
  const personId = params.get('person') ?? (params.get('view') === 'all' || params.has('event') || params.has('ofk') ? null : home)

  const q = useObjectById<Person>('person', personId ?? undefined, {
    keys: ['handle', 'gramps_id', 'profile', 'media_list'],
    profile: ['self'],
  })
  const person = q.data
  const name = person?.profile ? profileName(person.profile) : ''
  useTitle(name ? `${t('common:nav.timeline')} · ${name}` : t('common:nav.timeline'))

  const showAll = () => setParams({ view: 'all' }, { replace: true })
  const showPerson = (id: string) => setParams({ person: id }, { replace: true })

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[2.6rem] leading-[1] font-medium tracking-[-0.02em] sm:text-6xl">{t('common:nav.timeline')}</h1>
          <p className="mt-3 max-w-xl font-serif text-lg italic text-muted-foreground">{personId ? t('personIntro') : t('globalIntro')}</p>
        </div>
        <div
          className="inline-flex rounded-full bg-card p-1 max-sm:grid max-sm:w-full max-sm:grid-cols-2 [&_button]:h-11 [&_button]:rounded-full [&_button]:px-4"
          role="group"
        >
          <Button variant={!personId ? 'default' : 'ghost'} aria-pressed={!personId} onClick={showAll}>
            <UsersRound />
            {t('everyone')}
          </Button>
          <ObjectPicker
            kinds={['person']}
            value={person ? { handle: person.handle, title: name } : null}
            placeholder={t('pickPerson')}
            onChange={(o) => showPerson(o.gramps_id)}
            trigger={
              <Button variant={personId ? 'default' : 'ghost'} aria-pressed={!!personId} className="max-w-64 max-sm:max-w-none">
                <UserRound />
                <span className="truncate">{personId ? name || personId : t('onePerson')}</span>
              </Button>
            }
          />
        </div>
      </div>

      {personId ? (
        q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !person ? (
          <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <Skeleton className="h-72 rounded-3xl" />
            <Skeleton className="h-[32rem] rounded-3xl" />
          </div>
        ) : (
          <PersonTimeline
            person={person}
            hero={
              <section className="rounded-3xl bg-card p-5 sm:p-6">
                <div className="flex items-center gap-5 xl:flex-col xl:items-start">
                  <Portrait
                    mediaRef={person.media_list?.[0]}
                    name={name}
                    sex={person.profile?.sex}
                    size={112}
                    className="ring-brass/70 max-sm:size-20!"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/person/${person.gramps_id}`}
                      className="block font-serif text-3xl leading-[1.05] font-medium tracking-[-0.01em] text-balance hover:underline sm:text-4xl"
                    >
                      {name}
                    </Link>
                    <div className="mt-2 font-serif text-xl tabular-nums text-brass">
                      {lifespan(person.profile?.birth as { date?: string }, person.profile?.death as { date?: string })}
                    </div>
                    {home === person.gramps_id && <div className="mt-1 text-sm text-muted-foreground">{t('common:homePerson')}</div>}
                  </div>
                </div>
                <Button asChild variant="secondary" className="mt-5 h-11 rounded-full px-5 max-sm:w-full">
                  <Link to={`/map?person=${person.gramps_id}`}>
                    <MapIcon />
                    {t('onMap')}
                  </Link>
                </Button>
              </section>
            }
          />
        )
      ) : (
        <GlobalTimeline />
      )}
    </div>
  )
}
