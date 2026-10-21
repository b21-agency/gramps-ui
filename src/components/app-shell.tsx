import { Suspense, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  ChartGantt,
  Dna,
  FileDown,
  FileText,
  FileUp,
  History,
  House,
  Image,
  Landmark,
  ListChecks,
  Map as MapIcon,
  MapPin,
  Network,
  Newspaper,
  NotebookPen,
  Quote,
  Settings,
  UsersRound,
  UserRound,
  GitCommitHorizontal,
} from 'lucide-react'
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

interface NavItem {
  to: string
  key: string
  icon: typeof House
  match?: string[]
  permission?: string
}

const groups: Array<{ key: string; items: NavItem[] }> = [
  {
    key: 'browse',
    items: [
      { to: '/', key: 'home', icon: House },
      { to: '/tree', key: 'tree', icon: Network },
      { to: '/people', key: 'people', icon: UserRound, match: ['/person/'] },
      { to: '/families', key: 'families', icon: UsersRound, match: ['/family/'] },
      { to: '/events', key: 'events', icon: CalendarDays, match: ['/event/'] },
      { to: '/places', key: 'places', icon: MapPin, match: ['/place/'] },
      { to: '/map', key: 'map', icon: MapIcon },
      { to: '/timeline', key: 'timeline', icon: ChartGantt },
      { to: '/medialist', key: 'media', icon: Image, match: ['/media/'] },
    ],
  },
  {
    key: 'research',
    items: [
      { to: '/sources', key: 'sources', icon: BookOpen, match: ['/source/'] },
      { to: '/citations', key: 'citations', icon: Quote, match: ['/citation/'] },
      { to: '/repositories', key: 'repositories', icon: Landmark, match: ['/repository/'] },
      { to: '/notes', key: 'notes', icon: NotebookPen, match: ['/note/'] },
      { to: '/dna-matches', key: 'dna', icon: Dna },
    ],
  },
  {
    key: 'yours',
    items: [
      { to: '/blog', key: 'blog', icon: Newspaper },
      { to: '/bookmarks', key: 'bookmarks', icon: BookMarked },
      { to: '/recent', key: 'history', icon: History },
      { to: '/tasks', key: 'tasks', icon: ListChecks },
    ],
  },
  {
    key: 'tools',
    items: [
      { to: '/reports', key: 'reports', icon: FileText },
      { to: '/export', key: 'export', icon: FileDown },
      { to: '/import', key: 'import', icon: FileUp, permission: 'ImportFile' },
      { to: '/revisions', key: 'revisions', icon: GitCommitHorizontal },
      { to: '/settings', key: 'settings', icon: Settings },
    ],
  },
]

function NavMenuItem({ item }: { item: NavItem }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { setOpenMobile, isMobile } = useSidebar()
  const Icon = item.icon
  const active =
    item.to === '/'
      ? pathname === '/'
      : pathname === item.to || pathname.startsWith(item.to + '/') || !!item.match?.some((m) => pathname.startsWith(m))
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
  const { can } = useAuth()
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo className="size-7 shrink-0" />
          <span className="truncate font-serif text-[1.05rem] font-medium group-data-[collapsible=icon]:hidden">
            {t('appName')}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
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
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
          <CommandSearch />
          <div className="ml-auto flex items-center gap-1">
            <AddMenu />
            <UserMenu />
          </div>
        </header>
        <main className="min-w-0 flex-1">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
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
