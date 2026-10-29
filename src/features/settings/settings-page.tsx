import { Link, Navigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Info, Server, ShieldCheck, SlidersHorizontal, UserRound, UsersRound } from 'lucide-react'
import { AlbumPage } from '@/components/album-page'
import { useAuth } from '@/lib/auth'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import { ProfileSection } from './profile-section'
import { PreferencesSection } from './preferences-section'
import { UsersSection } from './users-section'
import { AdministrationSection } from './administration-section'
import { InfoSection } from './info-section'
import { ServerSection } from './server-section'

type SectionKey = 'user' | 'preferences' | 'users' | 'administration' | 'server' | 'info'

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
  server: 'server',
  info: 'info',
  system: 'info',
}

const sections: Array<{ key: SectionKey; icon: typeof UserRound; permission?: (can: (p: string) => boolean) => boolean }> = [
  { key: 'user', icon: UserRound },
  { key: 'preferences', icon: SlidersHorizontal },
  { key: 'users', icon: UsersRound, permission: (can) => can('EditOtherUser') },
  { key: 'administration', icon: ShieldCheck, permission: (can) => can('EditOtherUser') || can('EditTree') },
  { key: 'server', icon: Server, permission: (can) => can('EditSettings') },
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
    <AlbumPage title={t('title')} description={t('description')}>
      <div className="grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-10">
        {/* phones and tablets: sideways-scrolling tabs under the header */}
        <nav
          aria-label={t('title')}
          className="sticky top-[var(--header-h)] z-20 -mx-4 -mt-2 overflow-x-auto bg-background/90 px-4 py-2 backdrop-blur [scrollbar-width:none] xl:hidden [&::-webkit-scrollbar]:hidden"
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
                      'flex h-11 items-center gap-2 rounded-full px-4 text-[15px] transition-colors active:scale-[0.97] motion-reduce:active:scale-100',
                      active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground',
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
        <nav aria-label={t('title')} className="hidden xl:block">
          <ul className="sticky top-20 space-y-1 rounded-3xl bg-card p-2">
            {visible.map((s) => {
              const active = s.key === current.key
              return (
                <li key={s.key}>
                  <Link
                    to={`/settings/${s.key}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] transition-colors duration-150',
                      active ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-xl',
                        active ? 'bg-brass text-brass-foreground' : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      <s.icon className="size-4" />
                    </span>
                    {t(`nav.${s.key}`)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          <h2 className="mb-6 font-serif text-4xl font-medium tracking-[-0.01em] sm:text-5xl">{t(`nav.${current.key}`)}</h2>
          {current.key === 'user' && <ProfileSection />}
          {current.key === 'preferences' && <PreferencesSection />}
          {current.key === 'users' && <UsersSection />}
          {current.key === 'administration' && <AdministrationSection />}
          {current.key === 'server' && <ServerSection />}
          {current.key === 'info' && <InfoSection />}
        </div>
      </div>
    </AlbumPage>
  )
}
