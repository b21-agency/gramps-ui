import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { House, LayoutGrid, Network, Search, UserRound } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { navGroups, isNavActive } from './nav-items'
import { setSearchOpen, useSearchOpen } from './command-search'

/**
 * Phone navigation: a bottom tab bar for the four things people do most
 * (start, tree, search, people) and a "More" sheet with every other section.
 */
export function MobileTabBar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const searchOpen = useSearchOpen()
  const [moreOpen, setMoreOpen] = useState(false)
  const tabs = [
    { to: '/', name: 'home', icon: House },
    { to: '/tree', name: 'tree', icon: Network },
    { to: '/people', name: 'people', icon: UserRound, match: ['/person/'] },
  ]
  const primary = new Set(['/', '/tree', '/people'])
  const moreActive =
    !searchOpen &&
    !tabs.some((tab) => isNavActive(pathname, tab.to, tab.match)) &&
    navGroups.some((g) => g.items.some((i) => !primary.has(i.to) && isNavActive(pathname, i.to, i.match)))

  const tabCls = (active: boolean) =>
    cn(
      'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors active:scale-95',
      active ? 'text-primary' : 'text-muted-foreground',
    )
  const pill = (active: boolean) =>
    cn(
      'flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200',
      active && 'bg-primary/12',
    )

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 pb-safe backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 md:hidden"
      >
        <div className="mx-auto flex h-16 max-w-md items-stretch px-1">
          <TabLink {...tabs[0]} label={t('nav.home')} pathname={pathname} tabCls={tabCls} pill={pill} />
          <TabLink {...tabs[1]} label={t('nav.tree')} pathname={pathname} tabCls={tabCls} pill={pill} />
          <button type="button" className={tabCls(searchOpen)} onClick={() => setSearchOpen(true)}>
            <span className={pill(searchOpen)}>
              <Search className="size-5" />
            </span>
            {t('actions.search')}
          </button>
          <TabLink {...tabs[2]} label={t('nav.people')} pathname={pathname} tabCls={tabCls} pill={pill} />
          <button type="button" className={tabCls(moreActive || moreOpen)} onClick={() => setMoreOpen(true)}>
            <span className={pill(moreActive || moreOpen)}>
              <LayoutGrid className="size-5" />
            </span>
            {t('nav.more')}
          </button>
        </div>
      </nav>
      <MoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}

function TabLink({
  name: _name,
  to,
  match,
  icon: Icon,
  label,
  pathname,
  tabCls,
  pill,
}: {
  name?: string
  to: string
  match?: string[]
  icon: typeof House
  label: string
  pathname: string
  tabCls: (a: boolean) => string
  pill: (a: boolean) => string
}) {
  const active = isNavActive(pathname, to, match)
  return (
    <NavLink to={to} className={tabCls(active)} aria-current={active ? 'page' : undefined}>
      <span className={pill(active)}>
        <Icon className="size-5" />
      </span>
      {label}
    </NavLink>
  )
}

function MoreDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const { can } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh] pb-safe">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="font-serif text-2xl font-medium">{t('nav.more')}</DrawerTitle>
          <DrawerDescription className="sr-only">{t('appName')}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto overscroll-contain px-4 pb-6">
          {navGroups.map((g) => {
            const items = g.items.filter((i) => !i.permission || can(i.permission))
            return (
              <section key={g.key} className="mb-5">
                <h3 className="mb-2 text-sm text-muted-foreground">{t(`nav.groups.${g.key}`)}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {items.map((i) => {
                    const Icon = i.icon
                    const active = isNavActive(pathname, i.to, i.match)
                    return (
                      <button
                        key={i.to}
                        type="button"
                        onClick={() => {
                          onOpenChange(false)
                          navigate(i.to)
                        }}
                        className={cn(
                          'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card px-1 text-center text-[11px] leading-tight transition-transform active:scale-95',
                          active && 'border-primary/40 bg-primary/10 text-primary',
                        )}
                      >
                        <Icon className="size-6" />
                        <span className="line-clamp-2">{t(`nav.${i.key}`)}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
