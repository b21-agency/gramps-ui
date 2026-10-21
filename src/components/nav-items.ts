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

export interface NavItem {
  to: string
  key: string
  icon: typeof House
  match?: string[]
  permission?: string
}

export const navGroups: Array<{ key: string; items: NavItem[] }> = [
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
      { to: '/revisions', key: 'revisions', icon: GitCommitHorizontal, permission: 'ViewPrivate' },
      { to: '/settings', key: 'settings', icon: Settings },
    ],
  },
]


export function isNavActive(pathname: string, to: string, match?: string[]) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(to + '/') || !!match?.some((m) => pathname.startsWith(m))
}
