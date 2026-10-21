import { lazy, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, Outlet, useLocation, useRouteError } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { ErrorState } from '@/components/states'
import { useAuth } from '@/lib/auth'
import { LoginPage } from '@/features/auth/login-page'

// lazy-load a named export
function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
  const C = lazy(async () => ({ default: (await load())[name] as ComponentType }))
  return <C />
}

function RequireAuth() {
  const { authenticated } = useAuth()
  const location = useLocation()
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

function RouteError() {
  const error = useRouteError()
  return <ErrorState error={error} onRetry={() => window.location.reload()} />
}

const L = {
  home: () => import('@/features/home/home-page'),
  person: () => import('@/features/people/person-page'),
  lists: {
    people: () => import('@/features/lists/people-list'),
    families: () => import('@/features/lists/families-list'),
    events: () => import('@/features/lists/events-list'),
    places: () => import('@/features/lists/places-list'),
    sources: () => import('@/features/lists/sources-list'),
    citations: () => import('@/features/lists/citations-list'),
    repositories: () => import('@/features/lists/repositories-list'),
    notes: () => import('@/features/lists/notes-list'),
    media: () => import('@/features/lists/media-list'),
  },
  obj: {
    family: () => import('@/features/objects/family-page'),
    event: () => import('@/features/objects/event-page'),
    place: () => import('@/features/objects/place-page'),
    source: () => import('@/features/objects/source-page'),
    citation: () => import('@/features/objects/citation-page'),
    repository: () => import('@/features/objects/repository-page'),
    note: () => import('@/features/objects/note-page'),
    media: () => import('@/features/objects/media-page'),
  },
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: page(L.home, 'HomePage') },
          { path: 'person/:id', element: page(L.person, 'PersonPage') },
          { path: 'people', element: page(L.lists.people, 'PeopleListPage') },
          { path: 'families', element: page(L.lists.families, 'FamiliesListPage') },
          { path: 'events', element: page(L.lists.events, 'EventsListPage') },
          { path: 'places', element: page(L.lists.places, 'PlacesListPage') },
          { path: 'sources', element: page(L.lists.sources, 'SourcesListPage') },
          { path: 'citations', element: page(L.lists.citations, 'CitationsListPage') },
          { path: 'repositories', element: page(L.lists.repositories, 'RepositoriesListPage') },
          { path: 'notes', element: page(L.lists.notes, 'NotesListPage') },
          { path: 'medialist', element: page(L.lists.media, 'MediaListPage') },
          { path: 'family/:id', element: page(L.obj.family, 'FamilyPage') },
          { path: 'event/:id', element: page(L.obj.event, 'EventPage') },
          { path: 'place/:id', element: page(L.obj.place, 'PlacePage') },
          { path: 'source/:id', element: page(L.obj.source, 'SourcePage') },
          { path: 'citation/:id', element: page(L.obj.citation, 'CitationPage') },
          { path: 'repository/:id', element: page(L.obj.repository, 'RepositoryPage') },
          { path: 'note/:id', element: page(L.obj.note, 'NotePage') },
          { path: 'media/:id', element: page(L.obj.media, 'MediaPage') },
          { path: 'search', element: page(() => import('@/features/search/search-page'), 'SearchPage') },
          { path: 'tree/:chart?/:id?', element: page(() => import('@/features/charts/tree-page'), 'TreePage') },
          { path: 'map', element: page(() => import('@/features/map/map-page'), 'MapPage') },
          { path: 'timeline', element: page(() => import('@/features/timeline/timeline-page'), 'TimelinePage') },
          { path: 'blog', element: page(() => import('@/features/blog/blog-page'), 'BlogPage') },
          { path: 'blog/:id', element: page(() => import('@/features/blog/blog-post-page'), 'BlogPostPage') },
          { path: 'tasks', element: page(() => import('@/features/tasks/tasks-page'), 'TasksPage') },
          { path: 'task/:id', element: page(() => import('@/features/tasks/task-page'), 'TaskPage') },
          { path: 'bookmarks', element: page(() => import('@/features/personal/bookmarks-page'), 'BookmarksPage') },
          { path: 'recent', element: page(() => import('@/features/personal/recent-page'), 'RecentPage') },
          { path: 'revisions', element: page(() => import('@/features/revisions/revisions-page'), 'RevisionsPage') },
          { path: 'revision/:id', element: page(() => import('@/features/revisions/revision-page'), 'RevisionPage') },
          { path: 'reports', element: page(() => import('@/features/tools/reports-page'), 'ReportsPage') },
          { path: 'export', element: page(() => import('@/features/tools/export-page'), 'ExportPage') },
          { path: 'import', element: page(() => import('@/features/tools/import-page'), 'ImportPage') },
          { path: 'dna-matches/:id?/:match?', element: page(() => import('@/features/dna/dna-page'), 'DnaPage') },
          { path: 'dna-chromosome/:id?/:match?', element: page(() => import('@/features/dna/dna-page'), 'DnaPage') },
          { path: 'ydna/:id?', element: page(() => import('@/features/dna/ydna-page'), 'YDnaPage') },
          { path: 'notifications', element: page(() => import('@/features/help/notifications-page'), 'NotificationsPage') },
          { path: 'help', element: page(() => import('@/features/help/help-page'), 'HelpPage') },
          { path: 'settings/:section?', element: page(() => import('@/features/settings/settings-page'), 'SettingsPage') },
          { path: ':newKind', element: page(() => import('@/features/editor/new-object-page'), 'NewObjectPage') },
        ],
      },
    ],
  },
])
