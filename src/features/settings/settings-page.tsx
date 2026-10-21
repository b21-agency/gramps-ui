import { Link, Navigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Info, ShieldCheck, SlidersHorizontal, UserRound, UsersRound } from 'lucide-react'
import { Page } from '@/components/app-shell'
import { useAuth } from '@/lib/auth'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import { ProfileSection } from './profile-section'
import { PreferencesSection } from './preferences-section'
import { UsersSection } from './users-section'
import { AdministrationSection } from './administration-section'
import { InfoSection } from './info-section'

type SectionKey = 'user' | 'preferences' | 'users' | 'administration' | 'info'

/** URL segment aliases; the classic Gramps Web paths are /settings/user, /administration, /users, /info. */
const aliases: Record<string, SectionKey> = {
  user: 'user',
  profile: 'user',
  account: 'user',
  preferences: 'preferences',
  prefs: 'preferences',
  users: 'users',
  administration: 'administration',
  admin: 'administration',
  info: 'info',
  system: 'info',
}

const sections: Array<{ key: SectionKey; icon: typeof UserRound; permission?: (can: (p: string) => boolean) => boolean }> = [
  { key: 'user', icon: UserRound },
  { key: 'preferences', icon: SlidersHorizontal },
  { key: 'users', icon: UsersRound, permission: (can) => can('EditOtherUser') },
  { key: 'administration', icon: ShieldCheck, permission: (can) => can('EditOtherUser') || can('EditTree') },
  { key: 'info', icon: Info },
]

/** Brings the active tab into view in the sideways-scrolling phone tab row. */
const scrollIntoTabs = (el: HTMLAnchorElement | null) => {
  const row = el?.closest('nav')
  if (!el || !row) return
  const l = el.offsetLeft - 16
  const r = el.offsetLeft + el.offsetWidth + 16
  if (l < row.scrollLeft || r > row.scrollLeft + row.clientWidth) row.scrollLeft = Math.max(0, l - (row.clientWidth - el.offsetWidth) / 2)
}

export function SettingsPage() {
  const { section } = useParams()
  const { t } = useTranslation('settings')
  const { can } = useAuth()
  const visible = sections.filter((s) => !s.permission || s.permission(can))
  const requested = section ? aliases[section.toLowerCase()] : 'user'
  const current = visible.find((s) => s.key === requested)
  useTitle(current ? `${t(`nav.${current.key}`)} · ${t('title')}` : t('title'))

  // unknown section or one the user may not see → profile
  if (!current) return <Navigate to="/settings/user" replace />

  return (
    <Page title={t('title')} description={t('description')}>
      <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8 lg:gap-12">
        {/* mobile: sideways-scrolling tabs under the header */}
        <nav
          aria-label={t('title')}
          className="sticky top-[var(--header-h)] z-20 -mx-4 -mt-2 overflow-x-auto border-b bg-background/90 px-4 py-2 backdrop-blur [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex gap-1.5">
            {visible.map((s) => {
              const active = s.key === current.key
              return (
                <li key={s.key} className="shrink-0">
                  <Link
                    ref={active ? scrollIntoTabs : undefined}
                    to={`/settings/${s.key}`}
                    replace
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-10 items-center gap-2 rounded-full border px-3.5 text-[15px] transition-colors active:scale-[0.97] motion-reduce:active:scale-100',
                      active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground',
                    )}
                  >
                    <s.icon className="size-4" />
                    {t(`nav.${s.key}`)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* desktop: side nav */}
        <nav aria-label={t('title')} className="hidden md:block">
          <ul className="sticky top-20 space-y-0.5">
            {visible.map((s) => {
              const active = s.key === current.key
              return (
                <li key={s.key}>
                  <Link
                    to={`/settings/${s.key}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <s.icon className="size-4" />
                    {t(`nav.${s.key}`)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {current.key === 'user' && <ProfileSection />}
          {current.key === 'preferences' && <PreferencesSection />}
          {current.key === 'users' && <UsersSection />}
          {current.key === 'administration' && <AdministrationSection />}
          {current.key === 'info' && <InfoSection />}
        </div>
      </div>
    </Page>
  )
}
