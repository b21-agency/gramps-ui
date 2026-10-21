import { Suspense, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth'
import { CommandSearch } from './command-search'
import { UserMenu } from './user-menu'
import { AddMenu } from './add-menu'
import { Logo } from './logo'
import { TreeBranding, useAppTitle } from '@/lib/tree-config'
import { KeyboardShortcuts } from './keyboard-shortcuts'
import { navGroups, isNavActive, type NavItem } from './nav-items'
import { MobileTabBar } from './mobile-nav'

function NavMenuItem({ item }: { item: NavItem }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { setOpenMobile, isMobile } = useSidebar()
  const Icon = item.icon
  const active = isNavActive(pathname, item.to, item.match)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={t(`nav.${item.key}`)}>
        <NavLink to={item.to} onClick={() => isMobile && setOpenMobile(false)}>
          <Icon />
          <span>{t(`nav.${item.key}`)}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function AppSidebar() {
  const { t } = useTranslation()
  const appTitle = useAppTitle()
  const { can } = useAuth()
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo className="size-7 shrink-0" />
          <span className="truncate font-serif text-[1.05rem] font-medium group-data-[collapsible=icon]:hidden">
            {appTitle}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((g) => (
          <SidebarGroup key={g.key}>
            <SidebarGroupLabel>{t(`nav.groups.${g.key}`)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items
                  .filter((i) => !i.permission || can(i.permission))
                  .map((i) => (
                    <NavMenuItem key={i.to} item={i} />
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden" />
      <SidebarRail />
    </Sidebar>
  )
}

export function AppShell() {
  const appTitle = useAppTitle()
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-safe shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Separator orientation="vertical" className="mr-1 hidden data-[orientation=vertical]:h-5 md:block" />
          <Link to="/" className="flex items-center gap-2 md:hidden">
            <Logo className="size-7" />
            <span className="font-serif text-lg">{appTitle}</span>
          </Link>
          <CommandSearch />
          <div className="ml-auto flex items-center gap-1">
            <AddMenu />
            <UserMenu />
          </div>
        </header>
        <main className="min-w-0 flex-1 pb-[var(--tabbar-h)]">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
        <MobileTabBar />
        <TreeBranding />
        <KeyboardShortcuts />
      </SidebarInset>
    </SidebarProvider>
  )
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

/** Standard page frame: title row + content, consistent gutters. */
export function Page({
  title,
  description,
  actions,
  children,
  wide,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'px-4 py-6 sm:px-6' : 'mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8'}>
      {(title || actions) && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h1 className="text-3xl font-medium tracking-tight">{title}</h1>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
