import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { api, logout } from '@/lib/api'
import type { UserInfo } from '@/lib/types'
import { initials } from '@/lib/format'
import { languages } from '@/i18n'
import { useTheme, type Theme } from './theme'

export function useCurrentUser() {
  return useQuery({ queryKey: ['user', 'me'], queryFn: () => api<UserInfo>('/users/-/'), staleTime: 10 * 60_000 })
}

export function UserMenu() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { data: me } = useCurrentUser()
  const name = me?.full_name || me?.name || ''
  const themes: Array<{ v: Theme; icon: typeof Sun }> = [
    { v: 'light', icon: Sun },
    { v: 'dark', icon: Moon },
    { v: 'system', icon: Monitor },
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={name || 'Account'}>
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-xs font-medium text-secondary-foreground">
              {initials(name || '?')}
            </AvatarFallback>
          </Avatar>
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
        <DropdownMenuItem
          onSelect={() => {
            logout()
            navigate('/login')
          }}
        >
          <LogOut />
          {t('actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
