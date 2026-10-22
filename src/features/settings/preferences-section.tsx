import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Monitor, Moon, Sun, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Portrait } from '@/components/portrait'
import { ObjectPicker } from '@/components/object-picker'
import { ACCENTS, useTheme, type Theme } from '@/components/theme'
import { languages } from '@/i18n'
import { useHomePerson } from '@/lib/prefs'
import { useObjectById } from '@/lib/queries'
import { lifespan, profileName } from '@/lib/format'
import type { MediaRef, PersonProfile } from '@/lib/types'
import { SettingsBlock } from './parts'

export function PreferencesSection() {
  const { t, i18n } = useTranslation('settings')
  const { theme, setTheme, accent, setAccent } = useTheme()
  const themes: Array<{ v: Theme; icon: typeof Sun }> = [
    { v: 'light', icon: Sun },
    { v: 'dark', icon: Moon },
    { v: 'system', icon: Monitor },
  ]
  const lang = i18n.resolvedLanguage ?? 'en'

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SettingsBlock title={t('prefs.appearance')} description={t('prefs.appearanceDescription')}>
        <div className="grid max-w-md gap-6">
          <div className="grid gap-2">
            <span className="text-sm font-medium" id="pref-lang-label">
              {t('common:language')}
            </span>
            <Select value={lang} onValueChange={(v) => void i18n.changeLanguage(v)}>
              <SelectTrigger className="w-full sm:w-64" aria-labelledby="pref-lang-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium" id="pref-theme-label">
              {t('common:theme.label')}
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              value={theme}
              onValueChange={(v) => v && setTheme(v as Theme)}
              aria-labelledby="pref-theme-label"
              className="w-full sm:w-auto"
            >
              {themes.map(({ v, icon: Icon }) => (
                <ToggleGroupItem key={v} value={v} className="flex-1 gap-1.5 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground sm:flex-none">
                  <Icon />
                  {t(`common:theme.${v}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium" id="pref-accent-label">
              {t('accent.label')}
            </span>
            <div role="radiogroup" aria-labelledby="pref-accent-label" className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={accent === a.id}
                  onClick={() => setAccent(a.id)}
                  className={cn(
                    'flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] max-md:h-11',
                    accent === a.id ? 'border-primary bg-accent font-medium' : 'hover:bg-accent',
                  )}
                >
                  <span className="size-4 rounded-full ring-1 ring-foreground/15" style={{ background: a.swatch }} />
                  {t(`accent.${a.id}`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('accent.hint')}</p>
          </div>
        </div>
      </SettingsBlock>

      <HomePersonBlock />
    </div>
  )
}

function HomePersonBlock() {
  const { t } = useTranslation('settings')
  const [homeId, setHomeId] = useHomePerson()
  const { data: person, isLoading } = useObjectById<{
    handle: string
    gramps_id: string
    media_list: MediaRef[]
    profile: PersonProfile
  }>('person', homeId ?? undefined, { profile: 'self', keys: 'handle,gramps_id,profile,media_list' })

  const picker = (label: string, variant: 'default' | 'outline') => (
    <ObjectPicker
      kinds={['person']}
      placeholder={t('prefs.homePersonSearch')}
      onChange={(o) => {
        setHomeId(o.gramps_id)
        toast.success(t('prefs.homePersonSet', { name: o.title }))
      }}
      trigger={
        <Button variant={variant}>
          <UserRound />
          {label}
        </Button>
      }
    />
  )

  return (
    <SettingsBlock title={t('common:homePerson')} description={t('prefs.homePersonDescription')}>
      {!homeId ? (
        picker(t('prefs.homePersonChoose'), 'default')
      ) : isLoading ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-5 w-48" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {person ? (
              <>
                <Portrait
                  mediaRef={person.media_list?.[0]}
                  name={profileName(person.profile)}
                  sex={person.profile.sex}
                  size={48}
                />
                <div className="min-w-0">
                  <Link to={`/person/${person.gramps_id}`} className="block truncate font-serif text-lg hover:underline">
                    {profileName(person.profile)}
                  </Link>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {[lifespan(person.profile.birth, person.profile.death), person.gramps_id].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('prefs.homePersonMissing', { id: homeId })}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {picker(t('prefs.homePersonChange'), 'outline')}
            <Button variant="ghost" onClick={() => setHomeId(null)}>
              <X />
              {t('prefs.homePersonClear')}
            </Button>
          </div>
        </div>
      )}
    </SettingsBlock>
  )
}
