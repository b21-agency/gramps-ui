# UI conventions (read before building a feature)

The app replaces the Gramps Web UI. Treat the classic UI as a **feature checklist only**:
never copy its layout or flows. The goal is the best possible UX for non-technical family
members: fast, calm, obvious, works on a phone.

API reference: `docs/gramps-web-reference.md` (endpoints, params, payloads). Read the
sections relevant to your feature.

## Stack

- Vite + React 19 + TypeScript, Tailwind v4, shadcn/ui (radix, "nova" preset) in
  `src/components/ui/*`. Add more shadcn components with
  `pnpm dlx shadcn@latest add <name> -y` (don't hand-edit generated ui files except to fix bugs).
- Data: TanStack Query. Routing: react-router v7 (`src/routes.tsx`, already lists every route).
- i18n: i18next, German + English. **Every user-visible string goes through `t()`**.
  Each feature owns `src/locales/<ns>.en.ts` + `src/locales/<ns>.de.ts` (default export
  object; namespace = file prefix). Use `useTranslation('<ns>')`; shared strings live in
  `common` (`t('common:actions.save')`). Write natural German (du-form, sentence case).
- Icons: lucide-react.

## Design language

- Palette tokens (see `src/index.css`): stone background, ink text, **moss** `primary`
  (lineage, main actions), **brass** (`text-brass`, `bg-brass`) for highlights such as home
  person, bookmarks, years. `--lineage` for tree connector lines. Dark mode via `.dark`.
  Use tokens only (`bg-card`, `text-muted-foreground`, `border`), never raw hex.
- Type: `font-serif` (Newsreader) for names, headings, big numbers; sans (Instrument Sans)
  for UI. `h1/h2/h3` are serif automatically. Use `tabular-nums` for dates/IDs.
- No ALL-CAPS labels, no eyebrow labels, no decorative gradients, no "→" in buttons, no
  identical card grids for everything. Sections are separated by a heading + hairline
  (`DetailSection`), cards (`rounded-xl border bg-card`) only where grouping helps.
- Motion: only in response to user action (open, expand, recentre). Respect reduced motion.
- Mobile: everything must work at 375px wide. Tables collapse to stacked rows; toolbars wrap.
- Empty and error states give direction (`EmptyState`, `ErrorState` in `components/states.tsx`).
- Copy: plain verbs, sentence case, buttons say what happens ("Save changes", "Add parent").

## Shared building blocks (reuse, don't duplicate)

| Need | Use |
|---|---|
| API calls | `api`, `apiRaw` (gives `total` from X-Total-Count), `qs` from `@/lib/api`; image URLs `mediaThumbUrl`, `mediaCroppedUrl`, `mediaFileUrl` |
| Locale for API | `apiLocale()` from `@/i18n` — pass as `locale` param |
| Object by Gramps ID | `useObjectById(kind, id, query)` (`@/lib/queries`) |
| Object by handle | `useObjectByHandle(kind, handle, query)` |
| Paged list | `useObjectList(kind, query)` → `{items,total}` |
| Metadata / tags | `useMetadata()`, `useTags()` |
| Permissions | `useAuth().can('AddObject' \| 'EditObject' \| 'DeleteObject' \| 'ViewPrivate' \| 'EditOtherUser' ...)` |
| Current user | `useCurrentUser()` from `@/components/user-menu` |
| Home person, bookmarks, recent, per-tree prefs | `@/lib/prefs` (`useHomePerson`, `useBookmarks`, `useRecent`, `usePref`, `useRecordVisit`) |
| Formatting | `@/lib/format` (`profileName`, `displayName`, `lifespan`, `yearOf`, `typeStr`, `timeAgo`, `isEmpty`) |
| Object titles/icons/links | `@/lib/objects` (`describeObject`, `kindIcon`, `objectPath`, `normalizeKind`) |
| Page frame | `Page` from `@/components/app-shell` (title, description, actions) |
| Tab title | `useTitle(title)` |
| Person avatar | `Portrait` (`@/components/portrait`), `refThumbUrl(mediaRef,size)` |
| Person row link | `PersonChip` (`@/components/person-chip`) |
| Batch portraits | `usePortraits(handles)` (`@/hooks/use-portraits`) |
| Object page header | `ObjectToolbar` + `ObjectTitle` (`@/components/detail/object-header`) |
| Object page sections | `DetailSection`, `SectionNav`, `EventsTable`, `Gallery`, `NotesList`, `CitationsList`, `FactsTable`, `ReferencesList` (`@/components/detail/sections`) |
| Note HTML | `NoteHtml` |
| Tags | `TagList`, `tagColor` |
| Search / pick an object | `ObjectPicker`, `ObjectSearchList` (`@/components/object-picker`), `searchQuery`, `useDebounced` |
| Loading | `Skeleton`, `RowsSkeleton` |
| Toasts | `toast` from `sonner` |

Reference implementations: `src/features/people/person-page.tsx`,
`src/features/home/home-page.tsx`.

## Rules for parallel work

- Only create/edit files inside your feature folder(s) and your own locale files, unless
  your brief says otherwise. If a shared file needs a change, keep it additive and
  minimal (new export, never change existing signatures) and mention it in your report.
- Keep the exported component names that `src/routes.tsx` expects.
- `npx tsc -b` must pass for your files. Run `pnpm build` at the end if possible.
- Don't commit, don't touch git, don't start/stop dev servers or docker.
- Local backend for testing: `http://localhost:5055` (Gramps Web API with the Gramps example
  tree, users `owner/owner` (role 4), `editor/editor` (3), `guest/guest` (0)).
  Use curl against it to inspect real JSON shapes. Token: `POST /api/token/`.
  A Vite dev server runs at http://127.0.0.1:5173 (proxying /api), HMR picks up your files.

## Data layer: RTK Query

All server data goes through RTK Query. **No TanStack Query, no hand-rolled fetch-in-effect
for reads.** Layout:

| Path | What |
|---|---|
| `src/api/index.ts` | `createApi` with the auth base query (JWT, refresh on 401) and `tagTypes` |
| `src/api/config/openapi.json` + `openapi-config.cjs` | Gramps Web OpenAPI spec + codegen config (one slice per resource) |
| `src/api/*-api-slice.gen.ts` | **Generated**, never edit. `pnpm api:fetch-spec && pnpm api:generate` |
| `src/api/enhanced/objects.ts` | Typed object endpoints with per-object tags: `useGetObjectsQuery` (paged, `{items,total}`), `useGetObjectByIdQuery`, `useGetObjectQuery`, `useGetObjectsByHandlesQuery`, `useCreate/Update/DeleteObjectMutation`, `usePostObjectsMutation`, `useDeleteObjectsByHandleMutation`, `useMergeObjectsMutation`, `useUndoTransactionMutation`, `useSearchQuery`, `useMetadataQuery`, `useAllTagsQuery` |
| `src/api/enhanced/tags.ts` | Tag model: `tagOf`, `tagsForTransaction`, `tagsForKind`, `DERIVED` |
| `src/api/enhanced/writes.ts` | Listener: after ANY mutation that returns a Gramps transaction, invalidate exactly the touched objects + lists + derived views |
| `src/api/enhanced/<area>.ts` | Your additions: `api.injectEndpoints` / `enhanceEndpoints` for endpoints that need better types, `X-Total-Count`, custom tags, or that the spec describes wrongly |
| `src/store/index.ts` | `configureStore`, `useAppDispatch`, `useAppSelector`; API state reset on sign-in/out |
| `src/lib/queries.ts` | Thin wrappers: `useObjectById`, `useObjectByHandle`, `useObjectList`, `useMetadata`, `useTags` |

Rules:
- **Reads**: use the generated hook (`useGetPeopleQuery`, `useGetTreeConfigQuery`, …; args are camelCase, e.g. `grampsId`) or an enhanced one. Disable with `skipToken`. `data` keeps the previous result while new args load (no `keepPreviousData` needed); use `currentData` when you must not show stale results. Polling: `pollingInterval`. On-demand: `useLazy…Query`.
- **Tags**: every query provides tags, every mutation invalidates tags. Object kinds use `People | Families | Events | Places | Sources | Citations | Repositories | Notes | Media | Tags` with `id: handle` and `id: 'LIST'`; derived views `Search | Metadata | Timeline | Relations | Transactions`; others `Users | Trees | Tasks | Bookmarks`. Writes returning a transaction are invalidated automatically by the listener; for other writes set `invalidatesTags` in an enhanced endpoint (e.g. tree config → `Trees`, users → `Users`).
- **Writes**: use mutations (`const [save, { isLoading }] = useUpdateObjectMutation()`; `await save(arg).unwrap()`). Never clear caches by hand; if you must, `dispatch(api.util.invalidateTags([...]))`.
- Raw `fetch`/`apiRaw` is only allowed for binary streams (file upload body, downloads) and task polling helpers; after such a write dispatch `api.util.invalidateTags(...)`.
- Errors: RTK errors are `{ status, data }`; `ErrorState` handles them.

## Visual direction (decided 2026-10-22)

Chosen: **B "Family first"** screen designs, plus C's year timeline; shell unchanged.

- Light theme: white ground `#FFFFFF`, soft section ground `#F3F5F4`, ink `#14201B`,
  moss primary `#2F6B4A` (tint `#EAF2ED`, deep `#1F4D34`), brass `#A9833A` (text `#8A6A28`),
  muted text `#5B6B64`, hairlines `#E6EBE8`, lineage `#B7C9BE`, story tint `#F8F4EA`.
- Dark theme (from A): ground `#0E1A16`, surface `#15241F`, raised `#1F322B`, text `#E8EDE9`,
  muted `#9AAAA2`, moss `#8CBF9B`, brass `#D2AD62`, hairlines `#1F322B`/`#2B4038`.
- **App shell stays as is** (sidebar, header with search, phone tab bar + "Mehr" sheet). The redesign
  is per screen only: modernise each page's content area.
- Person page: family constellation header (parents → person card with brass ring → partner,
  siblings stack, children row), then three columns: life timeline (years in serif brass), stories,
  photos. Phone: centred card version (board B phone).
- Radii: cards 18–24px, chips/buttons 12px, pills 999px. Soft shadow only on the focal card.
- Names and years in Newsreader; everything else Instrument Sans.
