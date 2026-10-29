import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Check, Languages, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { logout } from '@/lib/api'
import { useGetUserQuery } from '@/api/enhanced/users-slice-enhanced'
import type { MediaRef, UserInfo } from '@/lib/types'
import { useAccessToken } from '@/lib/auth'
import { useObjectById } from '@/lib/queries'
import { useHomePerson } from '@/lib/prefs'
import { refThumbUrl } from './portrait'
import { initials } from '@/lib/format'
import { languages } from '@/i18n'
import { useTheme, type Theme } from './theme'
import { ActionSheet } from './action-sheet'
import { useIsMobile } from '@/hooks/use-mobile'

export function useCurrentUser() {
  // tagged `Users`: profile/user writes invalidate it
  const r = useGetUserQuery({ userName: '-' })
  return { ...r, data: r.data as UserInfo | undefined }
}

/** The user's avatar: the home person's first photo when there is one, otherwise initials. */
function UserAvatar({ name, size, className }: { name: string; size: number; className?: string }) {
  useAccessToken()
  const [homeId] = useHomePerson()
  const { data: home } = useObjectById<{ media_list: MediaRef[] }>('person', homeId ?? undefined, { keys: ['media_list'] })
  const photo = home?.media_list?.[0]
  const px = Math.min(1000, Math.ceil((size * (window.devicePixelRatio || 1)) / 50) * 50)
  return (
    <Avatar style={{ width: size, height: size }}>
      {photo && <AvatarImage src={refThumbUrl(photo, px)} alt="" draggable={false} />}
      <AvatarFallback delayMs={photo ? 300 : 0} className={className}>
        {initials(name || '?')}
      </AvatarFallback>
    </Avatar>
  )
}

export function UserMenu() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { data: me } = useCurrentUser()
  const name = me?.full_name || me?.name || ''
  const isMobile = useIsMobile()
  const [sheet, setSheet] = useState(false)
  const themes: Array<{ v: Theme; icon: typeof Sun }> = [
    { v: 'light', icon: Sun },
    { v: 'dark', icon: Moon },
    { v: 'system', icon: Monitor },
  ]
  const avatar = <UserAvatar name={name} size={32} className="bg-secondary text-xs font-medium text-secondary-foreground" />
  const signOut = () => {
    logout()
    navigate('/login')
  }

  if (isMobile)
    return (
      <>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={name || 'Account'} onClick={() => setSheet(true)}>
          {avatar}
        </Button>
        <ActionSheet
          open={sheet}
          onOpenChange={setSheet}
          title={name}
          header={
            <div className="flex items-center gap-3">
              <UserAvatar name={name} size={44} className="bg-secondary font-serif text-secondary-foreground" />
              <div className="min-w-0">
                <div className="truncate font-serif text-xl">{name}</div>
                {me && <div className="text-sm text-muted-foreground">{t(`role.${me.role}`)}</div>}
              </div>
            </div>
          }
          groups={[
            themes.map(({ v, icon: Icon }) => ({
              key: v,
              icon: <Icon />,
              label: t(`theme.${v}`),
              active: theme === v,
              hint: theme === v ? <Check className="size-4" /> : undefined,
              onSelect: () => setTheme(v),
            })),
            languages.map((l) => ({
              key: l.code,
              icon: <Languages />,
              label: l.label,
              active: i18n.resolvedLanguage === l.code,
              hint: i18n.resolvedLanguage === l.code ? <Check className="size-4" /> : undefined,
              onSelect: () => void i18n.changeLanguage(l.code),
            })),
            [
              { key: 'settings', icon: <Settings />, label: t('nav.settings'), onSelect: () => navigate('/settings') },
              { key: 'out', icon: <LogOut />, label: t('actions.signOut'), destructive: true, onSelect: signOut },
            ],
          ]}
        />
      </>
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={name || 'Account'}>
          {avatar}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{name}</div>
          {me && <div className="truncate text-xs text-muted-foreground">{t(`role.${me.role}`)}</div>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun />
            {t('theme.label')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {themes.map(({ v, icon: Icon }) => (
              <DropdownMenuItem key={v} onSelect={() => setTheme(v)}>
                <Icon />
                {t(`theme.${v}`)}
                {theme === v && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages />
            {t('language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {languages.map((l) => (
              <DropdownMenuItem key={l.code} onSelect={() => void i18n.changeLanguage(l.code)}>
                {l.label}
                {i18n.resolvedLanguage === l.code && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings />
          {t('nav.settings')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut />
          {t('actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
