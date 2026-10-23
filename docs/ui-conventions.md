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

## Data layer: RTK Query, generated from the OpenAPI spec

All server data goes through RTK Query. **No TanStack Query, no hand-rolled fetch-in-effect
for reads, and no hand-written endpoint that the spec already describes.** Every endpoint is
generated from the Gramps Web OpenAPI spec; what codegen cannot know (result types, cache
tags, totals) is added on top in one enhanced slice per generated slice.

| Path | What |
|---|---|
| `src/api/index.ts` | `createApi` with the auth base query (JWT, refresh on 401) and `tagTypes` |
| `src/api/config/openapi.json` | Spec snapshot. `pnpm api:fetch-spec` downloads it and runs `fix-spec.ts` |
| `src/api/config/fix-spec.ts` | Fills gaps in the upstream spec (request bodies it leaves out); each fix is a no-op once upstream describes it |
| `src/api/config/openapi-config.cjs` | Codegen config: one slice per resource (by OpenAPI tag), POST-reads as queries (`endpointOverrides`) |
| `src/api/*-api-slice.gen.ts` | **Generated**, never edit. `pnpm api:generate` |
| `src/api/enhanced/<slice>-slice-enhanced.ts` | One per generated slice: `enhanceEndpoints` with result types (`OverrideResultType`), `transformResponse` (`X-Total-Count` → `{ items, total }`), `providesTags` / `invalidatesTags`; re-exports the hooks and the types call sites need |
| `src/api/enhanced/index.ts` | Imports every enhanced slice once (from the store), so no generated endpoint ever runs without its cache rules |
| `src/api/enhanced/objects.ts` | Kind → generated endpoints registry for pages that work with any kind (`useObjectsQuery`, `useObjectQuery`, `useObjectsByHandlesQuery`, `createObject` / `updateObject` / `deleteObject` / `mergeObjects` / `fetchObject` thunks). Defines no endpoints |
| `src/api/enhanced/<area>.ts` | Only what codegen cannot produce: composites (several generated requests in one cache entry, built with `run()` from `compose.ts`) and infinite queries |
| `src/api/enhanced/tags.ts` | Tag model: `listTags`, `oneTags`, `writeTags`, `tagsForTransaction`, `DERIVED` |
| `src/store/index.ts` | `configureStore`, `useAppDispatch`, `useAppSelector`; API state reset on sign-in/out |
| `src/lib/queries.ts` | Thin wrappers for any-kind pages: `useObjectById`, `useObjectByHandle`, `useObjectList`, `useMetadata`, `useTags` |

Rules:
- **Call sites import from `src/api/enhanced/` only**, never from a `*.gen.ts` file (hooks and types alike).
- **Reads**: the generated hook (`useGetPeopleQuery`, `useGetTreeConfigQuery`, …) with its typed, camelCase args (`grampsId`, `keys: ['handle', 'profile']`, `profile: ['self']`). Disable with `skipToken`. `data` keeps the previous result while new args load; use `currentData` when you must not show stale results.
- **Tags**: every query provides tags, every mutation invalidates tags. Object kinds use `People | Families | Events | Places | Sources | Citations | Repositories | Notes | Media | Tags` with `id: handle` and `id: 'LIST'`; derived views `Search | Metadata | Timeline | Relations | Transactions`; others `Users | Trees | Tasks | Bookmarks`. Gramps answers every write with its transaction: `writeTags` invalidates exactly the objects it touched plus their lists and the derived views.
- **Deletes** invalidate nothing themselves: invalidate the returned transaction right away (`deleteObject` in `features/editor/lib.ts`) or, when deleting the record a page shows, after leaving it (`useInvalidateOnUnmount`).
- **Writes**: mutations (`const [save, { isLoading }] = usePutPersonMutation()`; `await save(arg).unwrap()`), or the registry thunks for any-kind code. Never clear caches by hand.
- **Spec gaps**: fix them in `fix-spec.ts`, regenerate, then enhance; don't hand-write the endpoint.
- Raw `fetch` only for: the auth layer (`lib/api.ts`: login, token refresh), binary uploads (file bodies, upload progress), file contents, external services. After a raw write dispatch `invalidateTransaction(tx)`.
- Errors: RTK errors are `{ status, data }`; `ErrorState` handles them.

## Visual direction (decided 2026-10-22): variant A "Album"

Reference implementation: `src/features/people/person-page.tsx` + `album-hero.tsx` + `life-story.tsx`.

- **App shell stays as is** (collapsible sidebar, header with search, phone tab bar + "Mehr" sheet).
  Only each screen's content area is redesigned.
- **Neutral palette** (user request 2026-10-23, replaces the green ink): dark is the default — graphite
  `#131416`, cards `#1B1C1F`, raised `#24262A`, text `#ECECEC`, muted `#A2A4AA`; light — `#F7F7F5`,
  white cards, ink `#1B1B1D`. Gold (`primary`/`brass`) is the single accent. Users can pick another
  accent in Settings → Preferences (`html[data-accent=neutral|gold|moss|blue|rose]`, see `index.css`);
  "Family tree colour" follows the tree's customization. Use tokens only.
- **Hero first**: every object screen opens with a large visual (portrait/photo/map/cover) next to the
  title in big Newsreader (`text-5xl`–`text-7xl`, tight leading), a quiet meta line, then primary
  action buttons (gold primary + secondary). Phones: visual on top (~19rem), centred title.
- **Panels instead of hairline sections**: content below the hero lives in `Panel`s
  (`rounded-3xl bg-card p-5 sm:p-6`, serif `text-2xl` title, optional action) arranged in a
  two-column grid (`lg:grid-cols-[22rem_minmax(0,1fr)]`, narrow column for people/photos/details,
  wide column for the main story/content). No borders around panels; separation by surface colour.
- **Faces as navigation**: people appear as portraits (44px rows, overlapping stacks with a gold "+N").
- **Years in gold serif**, dates/IDs `tabular-nums`, quotes/notes in serif italic.
- **Full width** (user request 2026-10-23): no `max-w-*` page caps; frame `px-4 sm:px-6 lg:px-10 2xl:px-14`.
  `AlbumGrid` adds a third column on `2xl` (aside | main | extra; extra auto-filled from the 2nd+ aside
  panels). Lists/grids add columns as space grows. Only reading text (~65ch) and single forms keep a
  max width. Layouts may be reinvented freely as long as every feature remains.
- Generous whitespace; motion only on interaction (press `scale(0.97)`,
  150ms ease-out hovers).

### Endpoint names must be unique

`injectEndpoints` silently keeps an existing endpoint of the same name, so a hand-written endpoint
named like a generated one (e.g. `postObjects`, `deleteUser`) is ignored and the generated version
runs instead. All enhanced slices therefore use `overrideExisting: 'throw'`. Before adding an
endpoint, check: `grep -rn "<name>: build\." src/api`.
