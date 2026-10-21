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
import { cn } from '@/lib/utils'
import { GlobalTimeline } from './global-timeline'
import { PersonTimeline } from './person-timeline'

export function TimelinePage() {
  const { t } = useTranslation(['timeline', 'common'])
  const [params, setParams] = useSearchParams()
  const [home] = useHomePerson()
  const personId = params.get('person') ?? (params.get('view') === 'all' || params.has('event') || params.has('ofk') ? null : home)

  const q = useObjectById<Person>('person', personId ?? undefined, {
    keys: 'handle,gramps_id,profile,media_list',
    profile: 'self',
  })
  const person = q.data
  const name = person?.profile ? profileName(person.profile) : ''
  useTitle(name ? `${t('common:nav.timeline')} · ${name}` : t('common:nav.timeline'))

  const showAll = () => setParams({ view: 'all' }, { replace: true })
  const showPerson = (id: string) => setParams({ person: id }, { replace: true })

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium tracking-tight">{t('common:nav.timeline')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{personId ? t('personIntro') : t('globalIntro')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <div className="inline-flex rounded-lg border bg-card p-0.5 max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:[&_button]:h-10" role="group">
            <Button
              size="sm"
              variant={!personId ? 'secondary' : 'ghost'}
              aria-pressed={!personId}
              onClick={showAll}
            >
              <UsersRound />
              {t('everyone')}
            </Button>
            <ObjectPicker
              kinds={['person']}
              value={person ? { handle: person.handle, title: name } : null}
              placeholder={t('pickPerson')}
              onChange={(o) => showPerson(o.gramps_id)}
              trigger={
                <Button size="sm" variant={personId ? 'secondary' : 'ghost'} aria-pressed={!!personId} className="max-w-56 max-sm:max-w-none">
                  <UserRound />
                  <span className="truncate">{personId ? name || personId : t('onePerson')}</span>
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {personId ? (
        q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !person ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-72" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-4 rounded-xl border bg-card p-4">
              <Portrait mediaRef={person.media_list?.[0]} name={name} sex={person.profile?.sex} size={56} />
              <div className="min-w-0 flex-1">
                <Link to={`/person/${person.gramps_id}`} className="font-serif text-2xl leading-tight hover:underline">
                  {name}
                </Link>
                <div className="text-sm tabular-nums text-muted-foreground">
                  {lifespan(person.profile?.birth as { date?: string }, person.profile?.death as { date?: string })}
                  {home === person.gramps_id && <span className="ml-2 text-brass">{t('common:homePerson')}</span>}
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className={cn('shrink-0')}>
                <Link to={`/map?person=${person.gramps_id}`}>
                  <MapIcon />
                  <span className="hidden sm:inline">{t('onMap')}</span>
                </Link>
              </Button>
            </div>
            <PersonTimeline person={person} />
          </>
        )
      ) : (
        <GlobalTimeline />
      )}
    </div>
  )
}
