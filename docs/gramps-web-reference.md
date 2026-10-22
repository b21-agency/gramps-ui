# Gramps Web frontend and API reference

Compact reference for re-implementing the Gramps Web UI in React against the unchanged
Gramps Web API.

Sources read (shallow clones, HEAD, 2026-10-21):
- Frontend `gramps-project/gramps-web` @ `81176f7` (package version 26.10.2, Lit, `src/`)
- Backend `gramps-project/gramps-web-api` @ `fbb47c1` (`_version.py` = 3.24.0)

Our production backend is 3.24. HEAD may be marginally ahead; anything marked
"(3.2x+)" is version-gated in the frontend via `dbInfo.gramps_webapi.version`.
The frontend refuses backends older than 3.17.0.

Conventions in this doc: `{h}` = object handle, `{id}` = Gramps ID (e.g. `I0001`),
`{lang}` = UI language code (`en`, `de`, ...). All paths are prefixed with `/api`.

---

## 1. Auth

### 1.1 Tokens

| Item | Value |
|---|---|
| Library | flask-jwt-extended |
| Token locations | `Authorization: Bearer <jwt>` header **or** `?jwt=<access_token>` query string |
| Access token lifetime | 15 min (`JWT_ACCESS_TOKEN_EXPIRES`) |
| Refresh token lifetime | never expires (`JWT_REFRESH_TOKEN_EXPIRES = False`) |
| JWT error body | `{"message": "..."}` (key `JWT_ERROR_MESSAGE_KEY = "message"`), 401 expired / 422 malformed |
| API error body | `{"error": {"code": 403, "message": "...", "type"?: "invalid_credentials"}}` |
| Rate limit | `POST /token/` and `POST /token/refresh/`: 1/second (429 on burst) |

Access token claims (decode client-side with `jwt-decode`):

```json
{
  "sub": "<user uuid>",
  "type": "access",
  "fresh": true,                     // true only for tokens from POST /token/
  "exp": 1760000000,
  "permissions": ["ViewPrivate", "AddObject", "EditObject", "DeleteObject", ...],
  "tree": "<tree uuid>",   // absent for tree-less admins
  "oidc_provider": "..."             // only for OIDC logins
}
```

The refresh token carries only the identity (`sub`). Every refresh re-reads the user's
tree, role and permissions from the DB, so role changes take effect at next refresh.

### 1.2 Login

```
POST /api/token/
Content-Type: application/json
Accept: application/json
{"username": "alice", "password": "secret"}

200 {"access_token": "<jwt>", "refresh_token": "<jwt>"}
403 {"error": {"code":403,"message":"Invalid username or password","type":"invalid_credentials"}}
403 type "account_unconfirmed" | "account_disabled"
403 "Local authentication is disabled..." (OIDC_DISABLE_LOCAL_AUTH)
503 "This tree is temporarily disabled"
```

Frontend treats 401/403 as "Wrong username or password". On success it stores in
`localStorage`: `access_token`, `access_token_expires` (= now + 15 min), `refresh_token`.

### 1.3 Refresh

```
POST /api/token/refresh/
Authorization: Bearer <refresh_token>        <-- refresh token in the header, no body
Accept: application/json
Content-Type: application/json

200 {"access_token": "<jwt>"}                 <-- no new refresh token; keep the old one
```

Frontend logic (`api.js` `Auth`):
- Before **every** API call: `getValidAccessToken()`. If the stored access token's
  `exp*1000 < now + 60s` (or no `exp`), refresh first. Concurrent callers share one
  in-flight refresh promise.
- Refresh response 403 or 422 -> `doLogout()` (clear tokens, fire `user:loggedout`).
- 429 -> retry up to 3 times after 1 s + random jitter.
- After refresh fires window event `token:refreshed`.
- Token storage is shared across tabs via localStorage; each tab pins the tree id it
  loaded and throws `TreeMismatchError` if the shared token now has another `tree`.

### 1.4 Other auth endpoints

| Method + path | Purpose |
|---|---|
| `POST /token/create_owner/` `{tree?}` | first-run only: limited-scope token to create the first owner/admin; 405 if users exist |
| `POST /users/{name}/create_owner/` | create first owner with that limited token (`{email, full_name, password, tree?}`) |
| `POST /token/sync/` `{token}` | exchange a persistent "sync" access token for a 15-min JWT (no refresh token) |
| `POST /users/{name}/register/` `{password,email,full_name,tree?}` | self-registration (can be disabled with `GRAMPSWEB_REGISTRATION_DISABLED`) |
| `POST /users/{name}/password/reset/trigger/` | e-mail reset link (201/202; 404 no user/no e-mail) |
| `POST /users/-/password/reset/` `{new_password}` | with limited-scope reset token |
| `GET /users/-/email/confirm/` | with limited-scope confirm token |
| `POST /users/{name}/password/change` `{old_password,new_password}` | change own password (`name` usually `-`) |
| `GET /oidc/config/` | `{enabled, providers:[{id,name}], disable_local_auth, ...}` |
| `GET /oidc/login/?provider=X` | browser redirect to IdP |
| `GET /oidc/callback/?code&state&provider` | returns `{access_token, refresh_token, id_token?, frontend_url?}` |
| `GET /oidc/logout/?provider&id_token&post_logout_redirect_uri` | returns `{logout_url}` |
| `GET/POST/DELETE /users/-/access-tokens/{scope}/...` | persistent tokens (scopes `anniversaries_ics`, `sync`) |

"Fresh" token (straight from login, not refreshed) is required for: backup restore,
import-restore, `POST /objects/delete/` (delete all), OIDC account link/unlink.

### 1.5 Logout

Pure client side: remove `access_token`, `access_token_expires`, `refresh_token`,
`id_token` from localStorage. No server revocation endpoint. (OIDC: also redirect to
the `logout_url` from `/oidc/logout/`.)

### 1.6 Request wrapper behaviour (replicate this)

```
GET: headers {Authorization: Bearer <access>}  (no Content-Type)
POST/PUT/DELETE: {Accept: application/json, Authorization, Content-Type: application/json}
                 body JSON.stringify(payload); for file uploads isJson=false -> raw File body,
                 no explicit Content-Type (browser sets file MIME type)
success codes: GET 200; writes 200/201/202/204
error text:   resJson.error.message || resJson.message || statusText
returned:     {data, total_count: headers['X-Total-Count'], etag: headers['ETag']}
202 + {"task": {"id","href"}} -> background task (see 11.1)
after any successful write: fire 'db:changed' -> app reloads /api/metadata/
```

---

## 2. Bootstrap / metadata / multi-tree

### 2.1 Startup sequence (`GrampsJs.js`)

1. If a refresh token exists -> optimistic "ready" state.
2. `GET /api/metadata/` (protected).
   - Network error -> "no connection" screen.
   - 5xx -> error toast.
   - 401/403 (not logged in) -> `POST /api/token/create_owner/` (no auth). If it returns a
     token -> first-run wizard; else -> login screen.
   - 403 and token has no `tree` claim -> "no tree" state (admins may create a tree).
3. Check `database.actual_schema < database.schema` -> "upgrade DB" screen (owner can
   `POST /trees/-/migrate`).
4. `GET /api/trees/-/config` -> per-tree UI config (colors, title, home page note/image).
5. `GET /api/tasks/?include_state=true` -> running background tasks.
6. Home person: `GET /api/people/?gramps_id={homePerson}&profile=self&extend=media_list`
   (`homePerson` is a per-tree localStorage setting, NOT `metadata.default_person`).
7. Translations: `POST /api/translations/{lang}?v={apiVersion}` body `{"strings": [...]}`
   -> `[{original, translation}]` (backend translates Gramps core strings; frontend also
   ships its own `lang/*.json`). `GET /api/translations/` lists languages.

### 2.2 `GET /api/metadata/` (excerpt)

```json
{
  "database": {"id": "...", "name": "Family tree name", "type": "sqlite|postgresql",
               "version": "...", "module": "...", "schema": "21.0.0", "actual_schema": 21},
  "default_person": "<handle>",
  "object_counts": {"people": 812, "families": 290, "events": 1700, "places": 300,
                    "sources": 40, "citations": 120, "repositories": 5, "media": 210,
                    "notes": 90, "tags": 4},
  "researcher": {"name": "...", "email": "...", "addr": "...", ...},
  "search": {"sifts": {"version": "3.24.0", "count": 3500}, "building": false},
  "gramps": {"version": "6.0.x"},
  "gramps_webapi": {"schema": "3.24.0", "version": "3.24.0"},
  "gramps_ql": {"version": "..."},
  "locale": {"lang": "de_DE", "language": "de", "description": "Deutsch",
             "incomplete_translation": false},
  "server": {"multi_tree": true, "task_queue": true, "ocr": false, "ocr_languages": [],
             "semantic_search": false, "chat": false, "face_detection": true,
             "thumbnails": {"pdf": true, "video": false}, "email": true,
             "max_thumbnail_file_bytes": 0, "backups": false,
             "max_media_archive_upload_bytes"?: 0, "rate_limit_media_archive"?: [...] }
}
```
- `?surnames=1` adds `surnames: [...]`.
- `GET /metadata/server/` = only the tree-independent `server/locale/version` parts
  (works without tree claim). `GET /metadata/researcher/` = researcher object.
- Frontend uses `locale.language` as `serverLang` (date parsing in filters),
  `object_counts` for dashboard statistics, `server.chat` + `UseChat` to show the
  assistant, `search.sifts.count == 0 && objects > 0` -> "reindex needed" banner.

### 2.3 Multi-tree

- The tree is **only** in the access-token claim `tree`. There is no tree id in URLs;
  every tree-scoped endpoint reads it from the JWT (`get_tree_from_jwt_or_fail`, 403
  "No tree ID in JWT" if missing).
- `-` means "my tree": `/trees/-`, `/trees/-/config`, `/users/-/`.
- Media paths are tree-prefixed server side (`MEDIA_PREFIX_TREE`), invisible to clients.
- Handles are only unique per tree -> frontend namespaces all localStorage by tree id:
  `grampsjs_settings_tree[tree]`, `bookmarks[tree]`, `recentObjects[tree]`,
  `grampsjs_tree_config[tree]`, `grampsjs_map_viewport[tree]`, `chatMessages[tree]`,
  `grampsjs_editor_drafts[tree]`, and clears thumbnail caches on tree change.
- Onboarding a tree-less admin: `POST /trees/ {name}` -> `PUT /users/-/ {tree: id}`
  -> force token refresh to get the new `tree` claim.

| Endpoint | Notes |
|---|---|
| `GET /trees/` | list; non-admins get only their own tree |
| `GET /trees/{id\|-}` | `{id, name, enabled, quota_media, quota_people, usage_media, usage_people, min_role_ai}` |
| `PUT /trees/{id\|-}` | `{name?, quota_media?, quota_people?, min_role_ai?}` (EditTree / EditTreeQuota / EditTreeMinRoleAI) |
| `POST /trees/` | `{name, quota_*?, min_role_ai?}` -> 201 tree (AddTree, admin) |
| `POST /trees/{id}/disable` / `enable` | admin |
| `POST /trees/{id\|-}/repair` | check & repair (RepairTree), may return task |
| `POST /trees/{id\|-}/migrate` | schema upgrade (UpgradeSchema) |
| `POST /trees/{id\|-}/verify?{params}` | "Verify the data" tool (oldage, hwdif, ...) |
| `GET /trees/{id\|-}/config` | free-form JSON blob, any member can read |
| `PUT /trees/{id\|-}/config` | replace blob (EditTree); size-limited |

Tree config keys used by the frontend: `frontend.appTitle`, `frontend.primaryColor`,
`frontend.secondaryColor`, `frontend.homePageNote` (note handle),
`frontend.homePageImage` (media handle). Unknown keys are preserved; frontend PUTs the
merged object.

### 2.4 `/api/config/` (server settings, NOT frontend config)

`GET /config/` (ViewSettings, admin) -> dict; `GET/PUT/DELETE /config/{KEY}/` `{value}`
(EditSettings). Allowed keys: `EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER,
EMAIL_HOST_PASSWORD, DEFAULT_FROM_EMAIL, BASE_URL, FRONTEND_URL`.
The Lit frontend's own build-time config is just `window.grampsjsConfig = {}`
(`loginRedirect`, `hideRegisterLink`, `mapWikidata`, map style overrides).

---

## 3. Roles and permissions

| Role | Int | Adds permissions |
|---|---|---|
| unconfirmed | -2 | none (cannot log in) |
| disabled | -1 | none (cannot log in) |
| guest | 0 | `EditOwnUser` |
| member | 1 | + `ViewPrivate` |
| contributor | 2 | + `AddObject` |
| editor | 3 | + `EditObject`, `DeleteObject`, `EditNameGroup`, `EditCustomFilter` |
| owner | 4 | + `AddUser`, `DeleteUser`, `EditOtherUser`, `EditUserRole`, `ViewOtherUser`, `ImportFile`, `ManageBackups`, `TriggerReindex`, `EditTree`, `RepairTree`, `UpgradeSchema`, `EditTreeMinRoleAI`, `BatchDeleteObjects` |
| admin | 5 | + `AddOtherTreeUser`, `ViewOtherTreeUser`, `EditOtherTreeUser`, `EditOtherTreeUserRole`, `EditUserTree`, `MakeAdmin`, `DeleteOtherTreeUser`, `ViewSettings`, `EditSettings`, `ViewOtherTree`, `EditOtherTree`, `EditTreeQuota`, `AddTree`, `DisableTree` |

`UseChat` is added dynamically if the tree's `min_role_ai` is set and `role >= min_role_ai`.

Semantics:
- **Without `ViewPrivate` (guest)** the backend serves a private-proxy DB: objects marked
  `private: true` (and private sub-records, refs to private objects) are invisible
  (single GET -> 404). Search also excludes private records. Writes are impossible.
  Note: there is no living-people proxy for normal reads; "living" filtering is only in
  reports/exports options.
- Creating a Family (POST /families/ or a Family inside POST /objects/) requires
  `AddObject` **and** `EditObject` (it edits the members' `family_list`).
- `DELETE /{type}/{h}` needs `DeleteObject`; `POST /objects/delete/` (delete all) needs
  `BatchDeleteObjects` + fresh token.

Frontend derives from `claims.permissions`:

| Flag | Permission | UI effect |
|---|---|---|
| `canAdd` | AddObject | "+" FAB on lists, "Add" menu in app bar, new_* pages, add-person in tree chart edit mode |
| `canEdit` | EditObject | edit FAB / edit mode on object pages, delete/merge in list multi-select |
| `canViewPrivate` | ViewPrivate | "Revisions" menu + `/revisions` page; "Revisions" tab on objects (API >= 3.22) |
| `canManageUsers` | EditOtherUser | settings tabs "Administration" and "Users" |
| `canUseChat` | UseChat | "Assistant" menu + `/chat` (also requires `metadata.server.chat`) |
| `canEditTree` | EditTree | tree settings (name, colors, home page) |
| `canManageBackups` | ManageBackups | backups section |
| `canUpgradeTree` | UpgradeSchema | DB upgrade button |
| `canViewOtherTree` | ViewOtherTree | admin: create tree when token has no tree |

---

## 4. Routes / views

URL scheme: `/{page}/{pageId}/{pageId2}` (no `#`). Detail pages use the **Gramps ID**, not
the handle; they fetch via `?gramps_id=`.

| Route | View | What it does / main calls |
|---|---|---|
| `/` (`home`) | Dashboard | home page note+image from tree config, home person card, anniversaries today, recently changed (8), latest blog post, statistics (`object_counts`) |
| `/login`, `/register`, `/firstrun/{tree?}`, `/create-tree` | pre-auth | see 1-2 |
| `/oidc/callback`, `/oidc/complete` | OIDC | token exchange |
| `/people` `/families` `/events` `/places` `/sources` `/citations` `/repositories` `/notes` | object lists | section 5 |
| `/medialist` | media list (grid/table) | section 5 |
| `/person/{id}` `/family/{id}` `/event/{id}` `/place/{id}` `/source/{id}` `/citation/{id}` `/repository/{id}` `/note/{id}` `/media/{id}` | detail pages | section 6 |
| `/tree/{chart}/{id}` | charts: `ancestor`, `descendant`, `hourglass`, `relationship`, `fan` | section 7 |
| `/timeline` | global event timeline | section 8.2 |
| `/map` | map of places/events | section 8.1 |
| `/search?q=` | full-text search | section 9 |
| `/blog`, `/blog/{sourceId}`, `/new_blog_post` | blog = Sources tagged `Blog` | section 10.1 |
| `/tasks`, `/task/{sourceId}`, `/new_task` | tasks = Sources tagged `ToDo` | section 10.2 |
| `/bookmarks` | localStorage bookmarks | section 10.3 |
| `/recent` ("History") | recently **viewed** objects (localStorage) | section 10.3 |
| `/revisions`, `/revision/{transactionId}` | change history, undo | section 10.4 |
| `/notifications` | local notification log + running tasks | section 11 |
| `/export` | exporters + media archive | section 10.5 |
| `/reports`, `/report/{reportId}` | Gramps reports | section 10.5 |
| `/dna-matches/{id}/{matchId?}`, `/dna-chromosome/{id}/{matchId?}`, `/ydna/{id}` | DNA | section 10.6 |
| `/chat` | AI assistant | section 10.7 |
| `/settings` (`/settings/user`), `/settings/administration`, `/settings/users`, `/settings/info` | settings | section 12 |
| `/new_person` `/new_family` `/new_event` `/new_place` `/new_source` `/new_citation` `/new_repository` `/new_note` `/new_media` | create forms | section 13 |
| `/help` | static help | - |

Main menu order: Home, Blog, Family Tree, Timeline, Map, DNA, Lists (people...),
Media, Assistant, History, Bookmarks, Tasks, Reports, Export, Revisions (ViewPrivate),
Notifications, Settings.

Endpoint name mapping (`objectTypeToEndpoint`): person->people, family->families,
event->events, place->places, source->sources, citation->citations,
repository->repositories, note->notes, media->media, tag->tags.
Class names (`_class`): Person, Family, Event, Place, Source, Citation, Repository,
Note, Media, Tag.

---

## 5. Object lists

### 5.1 Common list query parameters (`GET /api/{type}/`)

| Param | Meaning |
|---|---|
| `page` | 1-based; **omitted/0 = return ALL objects** (no pagination) |
| `pagesize` | default 20 (frontend lists use 24) |
| `sort` | comma list, `-` prefix = desc, e.g. `-change`, `surname,-birth` |
| `keys` / `skipkeys` | top-level keys whitelist / blacklist (applies to each object) |
| `strip` | drop empty values |
| `extend` | `all` or comma list (see 6.3) -> objects under `extended` |
| `profile` | `all,self,families,events,age,span,ratings,references,participants` |
| `backlinks` | `true` -> `backlinks: {"family": [h...], "event": [...]}` (lowercase class) |
| `locale` | language for profile strings/dates/types (`de`, `en`, ...) |
| `name_format` | Gramps name format string |
| `precision` | 1..3 components in age/span strings (1 = years only) |
| `gramps_id` | single object by Gramps ID (404 if missing); returns 1-element array |
| `handles` | comma list of handles (missing silently skipped) |
| `rules` | JSON filter, URL-encoded (see 5.3) |
| `filter` | name of a saved custom filter |
| `gql` | Gramps QL string, e.g. `media_list.length >= 10` |
| `dates` | `y/m/d-y/m/d`, `-y/m/d`, `y/m/d-`, wildcard `*` (e.g. `*/10/21` = anniversaries) |
| `soundex` | persons/families: add soundex |
| `place_hierarchy` | places: `0` to skip parent hierarchy in profile |
| `filemissing` | media: only objects whose file is missing |
| `formats`, `format_options` | notes: `formats=html` -> `formatted.html`; `format_options={"link_format":"/{obj_class}/{gramps_id}"}` |

Sort keys:
- all: `gramps_id`, `change`, `private`
- Person: `surname`, `name`, `soundex`, `birth`, `death`, `gender`
- Family: `surname`, `type`, `soundex`
- Event: `date`, `type`, `description`, `place`
- Place: `title`, `type`, `latitude`, `longitude`
- Citation: `date`, `confidence`
- Source: `title`, `author`, `pubinfo`, `abbrev`
- Repository: `name`, `type`; Media: `title`, `path`, `mime`, `date`; Note: `type`, `text`
- Tag: `name`, `color`, `priority`, `change`

### 5.2 Total count

- Response body is a **bare JSON array**; total in header **`X-Total-Count`** (count after
  filtering, before pagination). Also `ETag` (sha256 of body) and `Cache-Control: no-cache`.
- Pages = `ceil(total / pagesize)`.
- Same header on `/search/`, `/users/`, `/transactions/history/`, write responses
  (= number of changed objects).
- nginx: headers are same-origin so no `Access-Control-Expose-Headers` needed.

### 5.3 `rules` filter JSON

```json
{"function": "and" | "or" | "one", "invert": false,
 "rules": [{"name": "HasBirth", "values": ["between 1800 and 1850", "", ""], "regex": false}]}
```
Rule names are Gramps filter rule class names per namespace. `GET /filters/{namespace}`
(`People`, `Families`, `Events`, ...) lists available rules + saved filters;
`?locale=` translates descriptions. Frontend list filter UI sends `{"rules": [...]}`
(default function `and`).

### 5.4 Per-list fetch URL, columns, filters (frontend defaults: `pagesize=24`, `sort=-change`)

| List | Fetch URL (+ `&page&pagesize&sort&rules&gql`) | Columns (sortKey) | Filter sections (rule names) |
|---|---|---|---|
| People | `/people/?locale={lang}&profile=self&keys=gramps_id,profile,change,handle` | Gramps ID (gramps_id), Surname (surname), Given name, Birth Date (birth), Birth Place*, Death Date (death), Death Place*, Age at death* (client calc), Last changed (change) | Birth year `HasBirth[0]`, Death year `HasDeath[0]`, Properties (`IsFemale, IsMale, HasUnknownGender, HasAlternateName, HasNickname, HaveAltFamilies, HaveChildren, IncompleteNames, NeverMarried, MultipleMarriages, NoBirthdate, NoDeathdate, PersonWithIncompleteEvent, FamilyWithIncompleteEvent, MissingParent, Disconnected`), Associations (`HavePhotos, HasNote, HasSourceCount, HasAddress, HasAssociation` with `["0","greater than"]`), Tag `HasTag`, Privacy `PeoplePrivate`/`PeoplePublic` |
| Families | `/families/?locale={lang}&profile=self&keys=gramps_id,profile,change,handle` | Gramps ID, Father (surname), Mother, Relationship type*, Marriage Date, Marriage place*, Number of Children*, Last changed | type `HasRelType`, Associations (`HasGallery, HasNote, HasSourceCount`), Tag, Privacy `FamilyPrivate` |
| Events | `/events/?locale={lang}&profile=participants&keys=gramps_id,profile,description,change,handle` | Gramps ID, Event Type (type), Date (date), Place (place), Participants, Description*, Last changed | Year `HasData[1]`, type `HasType` (event_types), text `HasData` (place/description), Associations, Tag, Privacy `EventPrivate` |
| Places | `/places/?keys=gramps_id,name,place_type,change,handle` | Gramps ID, Name (title), Place type, Last changed | Name `HasData` (3 args), Associations, Tag, `PlacePrivate` |
| Sources | `/sources/?keys=gramps_id,title,author,pubinfo,change,handle` | Gramps ID, Title, Author, Publication info, Last changed | `MatchesTitleSubstringOf`, Associations, Tag, `SourcePrivate` |
| Citations | `/citations/?extend=source_handle&keys=gramps_id,extended,page,change,handle` | Gramps ID, Source: Title (`extended.source.title`), Page, Last changed | `MatchesPageSubstringOf`, `HasSource`, Associations, Tag, `CitationPrivate` |
| Repositories | `/repositories/?keys=gramps_id,name,type,change,handle` | Gramps ID, Name, Type, Last changed | `MatchesNameSubstringOf`, Tag, `RepoPrivate` |
| Notes | `/notes/?keys=gramps_id,type,text,change,handle` | Gramps ID, Type, Text (`text.string`), Last changed | `MatchesRegexpOf`, type `HasType` (note_types), Tag, `NotePrivate` |
| Media | `/media/?keys=gramps_id,mime,desc,change,handle,checksum,extended&extend=tag_list` | grid of thumbnails or table: Gramps ID, Type (mime), Description (title), Last changed | Title `HasMedia[0]` (4 args), Date `HasMedia`, MIME `HasMedia[1]`, Associations `HasSourceCount`, Tag, Subject `IsReferencedByObjectType`, `MediaPrivate` |

`*` = hidden by default (column picker, persisted). `change` is a Unix timestamp
(rendered as relative time). Row click -> `/{type}/{gramps_id}`.

Tags: no dedicated list route; managed in Settings > Administration > Tags
(`GET /tags/?locale={lang}&pagesize=500`, `POST /tags/ {name,color,priority}`,
`PUT/DELETE /tags/{h}`).

List multi-select actions (canEdit): delete -> `POST /objects/delete-by-handle/`
`{"namespace": "people", "handles": [...]}`; merge two -> `POST /{type}/{phoenix}/merge/{titanic}`
(people, families, events, places, citations, sources, repositories, media, notes).

### 5.5 List response example (`/people/?profile=self&keys=gramps_id,profile,change,handle&page=1&pagesize=2`)

```
HTTP 200
X-Total-Count: 812
ETag: "4c1e..."
```
```json
[
  {"change": 1729500000, "gramps_id": "I0001", "handle": "66TJQC6CC7ZWL9YZ64",
   "profile": {
     "handle": "66TJQC6CC7ZWL9YZ64", "gramps_id": "I0001", "sex": "F",
     "name_given": "Sarah Suzanne", "name_surname": "Warner", "name_suffix": "",
     "name_display": "Warner, Sarah Suzanne",
     "birth": {"type": "Birth", "date": "1987-08-29", "place": "Gainesville, Llano, TX, USA",
               "place_name": "Gainesville", "summary": "Birth - Warner, Sarah Suzanne"},
     "death": {},
     "addresses": []}},
  ...
]
```

---

## 6. Object detail pages

### 6.1 Fetch URLs (all by Gramps ID; response is a 1-element array -> `data[0]`)

| Page | URL |
|---|---|
| person | `/people/?gramps_id={id}&locale={lang}&profile=all&backlinks=true&extend=all&precision=1` + lazy `/people/{h}/timeline?locale={lang}&precision=1` |
| family | `/families/?gramps_id={id}&locale={lang}&profile=all&backlinks=true&extend=all&precision=1` |
| event | `/events/?gramps_id={id}&locale={lang}&profile=all&backlinks=true&extend=all` |
| place | `/places/?gramps_id={id}&backlinks=true&extend=all&locale={lang}&profile=all` |
| source | `/sources/?gramps_id={id}&locale={lang}&profile=all&backlinks=true&extend=all` |
| citation | `/citations/?gramps_id={id}&locale={lang}&profile=all&backlinks=true&extend=all` |
| repository | `/repositories/?gramps_id={id}&locale={lang}&profile=all&backlinks=true&extend=all` |
| note | `/notes/?gramps_id={id}&locale={lang}&profile=all&backlinks=true&extend=all&formats=html&format_options={"link_format":"/{obj_class}/{gramps_id}"}` |
| media | `/media/?gramps_id={id}&locale={lang}&backlinks=true&extend=all&profile=all` |
| hover preview | same URLs (person/family with `precision=1`) |
| relationship to home person | `/relations/{homeHandle}/{h}?depth=20&locale={lang}` -> `{relationship_string, distance_common_origin, distance_common_other}` |

Other single-object helpers: `GET /{type}/{h}?...` (same params as list minus paging),
`/people/{h}/timeline`, `/families/{h}/timeline`, `/relations/{h1}/{h2}/all`,
`/living/{h}` (is alive), `/living/{h}/dates`, `/events/{h1}/span/{h2}`.

### 6.2 Tabs (shown only when non-empty; edit mode shows when the key exists)

Tab order (same component for all types):

| Tab | Shown when | Data |
|---|---|---|
| Relationships | `family_list` or `parent_family_list` non-empty | `profile.primary_parent_family`, `profile.other_parent_families`, `profile.families`, `extended.families`, `extended.parent_families` |
| Place Hierarchy | place: `placeref_list` / enclosed places | `profile.parent_places`, backlinks.place |
| Alternate Names | place `alt_names` | |
| Map | place with lat/long, or event with place | |
| Children | family `child_ref_list` | `extended.children`, `profile.children` |
| Sources | repository: `backlinks.source` | |
| Events | `event_ref_list` | `extended.events` + `profile.events` (person: merged with timeline; toggles for family/relative events) |
| Events (place) | events at this place | `backlinks.event` |
| Participants | event: participants | `profile.participants` |
| Gallery | `media_list` | `extended.media` + MediaRef `rect` |
| Names | person (`primary_name` + `alternate_names`) | |
| Notes | `note_list` | `extended.notes` (each fetched as HTML: `/notes/{h}?locale&formats=html&...`) |
| Source Citations | `citation_list` | `extended.citations` |
| Citations | source: `backlinks.citation` | |
| Metadata | `attribute_list` / `urls` / `address_list` | |
| Associations | person `person_ref_list` | `extended.people` |
| Repositories | source `reporef_list` | `extended.repositories` |
| References | any backlinks | `profile.references` (profiles of referring objects) |
| Revisions | ViewPrivate, API >= 3.22 | `/transactions/history/objects/{Class}/{h}?sort=-id&page&pagesize` |

Person header: portrait = first `media_list` entry (cropped by `rect`), name, gender
(editable), birth/death lines from `profile.birth/death` (`date`, `place`, `age`),
relationship to home person, tags. Buttons: Show in tree (`/tree/ancestor/{id}` etc.),
Show on timeline, Open in map, DNA matches, External search, bookmark star,
"set as home person".

Siblings = `profile.primary_parent_family.children` (includes the person). There is **no**
`siblings`/`parents` key in the profile.

### 6.3 `extend` values -> `extended` keys

| extend | extended key | content |
|---|---|---|
| `child_ref_list` | `children` | Person objects |
| `citation_list` | `citations` | Citation objects |
| `event_ref_list` | `events` | Event objects (same order as refs) |
| `media_list` | `media` | Media objects |
| `note_list` | `notes` | Note objects |
| `person_ref_list` | `people` | Person objects (associations) |
| `placeref_list` | `places` | Place objects |
| `reporef_list` | `repositories` | Repository objects |
| `tag_list` | `tags` | Tag objects |
| `backlinks` (+`backlinks=true`) | `backlinks` | `{class: [objects]}` |
| `family_list` (Person) | `families` | Family objects |
| `parent_family_list` (Person) | `parent_families` | Family objects |
| `primary_parent_family` (Person) | `primary_parent_family` | Family object |
| `father_handle` / `mother_handle` (Family) | `father` / `mother` | Person |
| `place` (Event) | `place` | Place |
| `source_handle` (Citation) | `source` | Source |
| `all` | everything applicable | |

---

## 7. Profile JSON shapes

`profile` is computed, localized, read-only. Sections controlled by `profile=`:
`self` (always: base fields), `events`, `families`, `age`, `span`, `ratings`,
`references`, `participants`, `all`. `sex`: `M | F | U | X`.

### 7.1 `GET /api/people/{h}?extend=all&profile=all&backlinks=true` (abridged)

```json
{
  // no "_class" on reads - add it yourself on writes
  "handle": "OS6KQCDBW36VIRF98Z", "gramps_id": "I0702", "change": 1729500000,
  "private": false, "gender": 0,
  "primary_name": {"first_name": "Eleanor", "surname_list": [{"surname": "Aguilar", "prefix": "", "primary": true, "origintype": "", "connector": ""}],
                   "suffix": "", "title": "", "call": "", "nick": "", "famnick": "", "type": "Birth Name",
                   "date": {...}, "citation_list": [], "note_list": [], "private": false,
                   "group_as": "", "sort_as": 0, "display_as": 0},
  "alternate_names": [],
  "event_ref_list": [{"ref": "<event h>", "role": "Primary", "private": false, "citation_list": [], "note_list": [], "attribute_list": []}],
  "birth_ref_index": 0, "death_ref_index": 1,
  "family_list": ["<family h>"], "parent_family_list": ["<family h>"],
  "media_list": [{"ref": "<media h>", "rect": [10, 5, 60, 70], "private": false, "citation_list": [], "note_list": [], "attribute_list": []}],
  "person_ref_list": [{"ref": "<person h>", "rel": "Godfather", "private": false, "citation_list": [], "note_list": []}],
  "address_list": [], "attribute_list": [{"type": "Nickname", "value": "Ellie", "private": false, "citation_list": [], "note_list": []}],
  "urls": [], "lds_ord_list": [], "citation_list": [], "note_list": [], "tag_list": [],
  "backlinks": {"family": ["<h>", "<h>"], "event": ["<h>"]},
  "extended": {
    "events": [{...Event...}], "media": [{...Media...}], "notes": [], "citations": [],
    "people": [], "tags": [{"handle": "...", "name": "ToDo", "color": "#000000000000", "priority": 0}],
    "families": [{...Family...}], "parent_families": [{...}], "primary_parent_family": {...Family...},
    "backlinks": {"family": [{...}], "event": [{...}]}
  },
  "profile": {
    "handle": "OS6KQCDBW36VIRF98Z", "gramps_id": "I0702", "sex": "F",
    "name_given": "Eleanor", "name_surname": "Aguilar", "name_suffix": "",
    "name_display": "Aguilar, Eleanor",
    "addresses": [{"date_str": ""}],
    "birth": {"type": "Birth", "date": "after 1717", "place": "Hickory-Morganton-Lenoir, NC, USA",
              "place_name": "Hickory-Morganton-Lenoir", "summary": "Birth - Aguilar, Eleanor",
              "citations": 0, "confidence": 0, "age": "0 days"},
    "death": {"type": "Death", "date": "after 1760-02", "place": "Plattsburgh, Clinton, NY, USA",
              "place_name": "Plattsburgh", "summary": "Death - Aguilar, Eleanor",
              "citations": 0, "confidence": 0, "age": "unknown"},
    "events": [
      {"type": "Birth", "date": "after 1717", "place": "...", "place_name": "...",
       "summary": "Birth - Aguilar, Eleanor", "role": "Primary",
       "citations": 0, "confidence": 0, "age": "0 days"}
    ],
    "primary_parent_family": { ...FamilyProfile (7.2), members without "events" ... },
    "other_parent_families": [ ...FamilyProfile ... ],
    "families": [ ...FamilyProfile, each with "events" ... ],
    "references": {"family": [FamilyProfile...], "event": [EventProfile...], "person": [...],
                   "media": [{"gramps_id","date"}], "citation": [{"source":{...},"gramps_id","date","page"}],
                   "place": [PlaceProfile...], ...}
  }
}
```
Notes:
- `birth`/`death` = best available (falls back to baptism/burial etc.); `{}` if none.
- `birth.age` is always `"0 days"`; `death.age` = lifespan; event `age` = age at event
  relative to birth (`precision` controls granularity: `precision=1` -> "86 years").
- Dates in profiles are display strings in the requested locale (e.g. "um 1700-10-26").
- `families[]` = families where the person is a partner; nested `father/mother/children`
  are PersonProfiles with `birth/death` (+ ratings/age) but no `events`/`families`.
- `references` comes from backlinks (one level).

### 7.2 `GET /api/families/{h}?extend=all&profile=all` -> `profile`

```json
{
  "handle": "R14KQCXMSQYXI2CS6W", "gramps_id": "F0204",
  "relationship": "Married",              // localized FamilyRelType
  "family_surname": "Adams",              // father's surname, else mother's
  "father": {PersonProfile: handle, gramps_id, sex, name_*, birth, death, addresses},
  "mother": {PersonProfile} | {},
  "children": [{PersonProfile}, ...],     // in child_ref_list order
  "marriage": {"type": "Marriage", "date": "...", "place": "...", "place_name": "...",
               "summary": "Marriage - Adams, William and Aguilar, Eleanor",
               "citations": 0, "confidence": 0, "span": "0 days"},
  "divorce": {} ,
  "events": [{"type": "Marriage", "date": "", "place": "...", "place_name": "...",
              "summary": "...", "citations": 0, "confidence": 0, "span": "unknown"}],
  "references": {...}
}
```
Raw Family keys: `handle, gramps_id, change, private, father_handle ("" if none),
mother_handle, child_ref_list:[{ref, frel:"Birth", mrel:"Birth", private, citation_list,
note_list}], type ("Married"|"Unmarried"|"Civil Union"|"Unknown"|custom),
event_ref_list, media_list, attribute_list, lds_ord_list, citation_list, note_list,
tag_list, complete`. `extended`: `father`, `mother`, `children`, `events`, `media`,
`notes`, `citations`, `tags`, `backlinks`.

### 7.3 Other profiles

- **Event profile**: `{type, date, place, place_name, summary, role?, citations?, confidence?,
  age|span?, participants?: {people: [{role, person: PersonProfile}], families: [{role, family: FamilyProfile}]}}`.
- **Place profile**: `{gramps_id, type, name, alternate_names: [str], alternate_place_names:
  [{value, date_str}], lat, long (floats or null), parent_places: [PlaceProfile...] (chain to root),
  direct_parent_places: [{place, date_str}], references?}`.
- **Citation profile**: `{source: {author, title, pubinfo, gramps_id}, gramps_id, date, page}`.
- **Media profile**: `{gramps_id, date}` (+ `references`).
- **Repository profile**: name/type summary.

### 7.4 Raw object field cheat-sheet (for reads and writes)

| Class | Keys |
|---|---|
| Person | handle, gramps_id, change, private, tag_list, gender (0 F, 1 M, 2 unknown, 3 other), primary_name, alternate_names, event_ref_list, birth_ref_index, death_ref_index (-1 = none), family_list, parent_family_list, person_ref_list, address_list, attribute_list, urls, lds_ord_list, citation_list, note_list, media_list |
| Name | first_name, surname_list[Surname], suffix, title, call, nick, famnick, type ("Birth Name"/"Also Known As"/"Married Name"), date, group_as, sort_as, display_as, private, citation_list, note_list |
| Surname | surname, prefix, connector, primary (bool), origintype (str) |
| Event | handle, gramps_id, change, private, tag_list, type (e.g. "Birth"), date, place (handle or ""), description, citation_list, note_list, media_list, attribute_list |
| EventRef | ref, role ("Primary", "Family", "Witness"...), private, attribute_list, citation_list, note_list |
| ChildRef | ref, frel, mrel ("Birth","Adopted","Stepchild","Sponsored","Foster","Unknown"), private, citation_list, note_list |
| MediaRef | ref, rect ([x1,y1,x2,y2] percent 0-100, or `[]`), private, attribute_list, citation_list, note_list |
| PersonRef | ref, rel (string, e.g. "DNA"), private, citation_list, note_list |
| Place | handle, gramps_id, title, name {value, date, lang}, alt_names, place_type ("City"...), lat, long (strings), code, placeref_list [{ref, date}], alt_loc, urls, media_list, citation_list, note_list, tag_list, private |
| Source | title, author, pubinfo, abbrev, reporef_list [{ref, call_number, media_type, private, note_list}], attribute_list (SrcAttribute {type,value}), media_list, note_list, tag_list, private |
| Citation | source_handle, page, date, confidence (0-4), attribute_list, media_list, note_list, tag_list, private |
| Repository | name, type, address_list, urls, note_list, tag_list, private |
| Note | text {string, tags:[StyledTextTag {name, value, ranges}]}, format (0 flowed, 1 preformatted), type ("General", "Research"...), tag_list, private; read with `formats=html` adds `formatted.html` |
| Media | path, mime, desc, checksum, date, attribute_list, citation_list, note_list, tag_list, private |
| Tag | name, color ("#RRRRGGGGBBBB"), priority |
| Date | calendar (0 Gregorian), modifier (0 regular, 1 before, 2 after, 3 about, 4 range, 5 span, 6 text-only, 7 from, 8 to), quality (0 regular, 1 estimated, 2 calculated), dateval [day, month, year, slash, (day2, month2, year2, slash2 for range/span)], newyear, sortval, text, year |

Gramps types (`type`, `role`, `frel`, `place_type`, ...) are serialized as English
strings; custom types as their custom string. Lists of valid values:
`GET /types/` -> `{default: {event_types: [...], ...}, custom: {...}}`; `?locale=1`
returns translated defaults; `GET /types/default/{datatype}/map` maps English->localized.
`fix_object_dict` on the server accepts plain strings and restores nested `_class`
names, so writes only strictly need top-level `_class`.

---

## 8. Charts, map, timeline

### 8.1 Tree charts (`/tree/{chart}/{grampsId}`)

All charts are laid out **client-side** from one people query:

```
GET /api/people/?rules={encoded}&locale={lang}&profile=self
                &extend=event_ref_list,primary_parent_family,family_list[,parent_family_list]
```
Each person object provides: `handle, gramps_id, gender, media_list (portrait),
profile (names, birth/death)`, `extended.primary_parent_family` (Family with
`father_handle/mother_handle/child_ref_list[frel,mrel]`), `extended.families` (partner
families with `child_ref_list`), `extended.parent_families`, `extended.events`.
A `FamilyGraph` index maps handle -> person, family; parents = primary parent family;
children = all `child_ref_list` of partner families.

| Chart | Rules | Settings (localStorage key, default) |
|---|---|---|
| `ancestor` | `or`: `IsLessThanNthGenerationAncestorOf [id, anc+1]`, `IsLessThanNthGenerationDescendantOf [id, 2]` + per expanded branch (`...Of [branchId, 2]`) | `treeChartAnc` 3, `treeChartOrientation` horizontal/vertical, `treeChartNameDisplayFormat` |
| `descendant` | ancestors 2, descendants `desc+1` (+branches) | `descendantChartDesc` 1, orientation, name format |
| `hourglass` | ancestors `anc+1`, descendants `desc+1` | `hourglassChartAnc` 2, `hourglassChartDesc` 1 |
| `relationship` | `DegreesOfSeparation [id, sep]`, extend adds `parent_family_list` | `relationshipChartSep` 2 (max degree) |
| `fan` | ancestors `anc+1`, descendants 2 | `fanChartAnc` 4, color mode (client) |
| connection (DNA match page) | `RelationshipPathBetween [id1, id2]` + `parent_family_list` | - |

Charts support zoom/pan, SVG export, "expand branch" (+1 generation for a node), edit
mode (add parent/child/partner via `POST /api/objects/`). Portrait URL:
`/api/media/{ref}/thumbnail/{size}?square=true` or cropped variant using `media_list[0].rect`.

### 8.2 Map (`/map`)

| Data | Call |
|---|---|
| All geocoded places | (API >= 3.23) `GET /places/coordinates/` -> `[{handle, name, lat, long}]`; older: `/places/?locale&profile=self&place_hierarchy=0&keys=handle,profile` |
| Events with places (time slider) | `GET /events/?keys=date,handle,place,type` |
| Search box | `GET /search/?query=..&locale&profile=self&page=1&pagesize=20&type=place,person,event` |
| Selected person's places | `GET /people/{h}?extend=all&profile=all&locale` |
| Historic map overlays | `GET /media/?rules={"rules":[{"name":"HasAttribute","values":["map:bounds","*"],"regex":true}]}` -> image + tiles `GET /media/{h}/tile/{z}/{x}/{y}?jwt&checksum&max_zoom` |
| Place vector files (KML/GPX/GeoJSON in place media) | `/places/{h}?extend=media_list` + media file |

Base maps: MapLibre GL, `https://tiles.openfreemap.org/styles/liberty` (light),
`.../styles/dark`, historic `https://www.openhistoricalmap.org/map-styles/main/main.json`
(+ `@openhistoricalmap/maplibre-gl-dates`). Viewport/layers persisted per tree.

### 8.3 Global timeline (`/timeline`)

1. `GET /events/?keys=gramps_id,handle,date,type,place` (all events; client sorts by
   `date.sortval`).
2. Details for visible items: `GET /events/?handles=h1,h2,...&profile=self&locale={lang}`.
3. Person filter (ancestors/descendants): `GET /people/?rules={IsLessThanNthGeneration(Ancestor|Descendant)Of [id,100]}&keys=handle,event_ref_list`.
4. Place filter (enclosed): `GET /places/?rules={IsEnclosedBy [id,"1"]}&keys=handle`.

Person timeline (`/people/{h}/timeline`): params `ancestors` 1-5, `offspring` 1-5,
`relatives` (father,mother,brother,sister,wife,husband,son,daughter), `events`,
`event_classes` (vital,family,religious,vocational,academic,travel,legal,residence,other,custom),
`relative_events`, `relative_event_classes`, `dates`, `discard_empty` (default true),
`first`, `last`, `omit_anchor`, `ratings`, `precision`, `locale`, `page`, `pagesize`.
Item: `{handle, gramps_id, date (display), type, description, label, media: [h],
person: {...}, place: {...}, age, role}`. `/families/{h}/timeline` and
`/timelines/people/?...`, `/timelines/families/` exist too.

Anniversaries widget: `GET /events/?dates=*/{m}/{d}&profile=all&sort=-date&locale&pagesize=10&page=1`.

---

## 9. Search

```
GET /api/search/?query={q}&locale={lang}&profile=all&page=1&pagesize=20
               [&type=person,family,event,place,citation,source,repository,note,media]
               [&sort=-change|type] [&change=>1729000000] [&strip=1]
X-Total-Count: 57
[
  {"handle": "...", "object_type": "person", "score": 3.2,
   "object": {...full Person with "profile" if profile requested...}},
  ...
]
```
- Full text over all object types; respects privacy (ViewPrivate).
- `query=*` with `change=>ts` and `sort=-change` = "recently changed" widget.
- Recently viewed (`/recent`): `query=I0001 OR F0002 OR ...&pagesize=100`.
- Object pickers: `/search/?query=..&type={objType}&profile=all&page=1&pagesize=20`.
- 503 if no search index for the tree. `POST /search/index/?full=1` rebuild (TriggerReindex) -> task.
- Structured query (OQL, 3.2x): `POST /{type}/query/` body
  `{select, where:[{column, op, value}|{and|or|not|exists}], where_expr, order_by:[{column,direction}], limit, after, locale, count}`;
  count in `X-Total-Count`. Not used by the Lit list views (they use `rules`/`gql`).

---

## 10. Feature views

### 10.1 Blog
- List: `GET /sources/?rules={"rules":[{"name":"HasTag","values":["Blog"]}]}&page&pagesize&sort=-change&locale&profile=all&extend=all`.
- Post: `GET /sources/?gramps_id={id}&locale&profile=all&backlinks=true&extend=all`; body = first note:
  `GET /notes/?gramps_id={noteId}&locale&profile=all&extend=all&formats=html&format_options={"link_format":"/{obj_class}/{gramps_id}"}` -> `formatted.html`.
  Title = source title, author = source author, images = source `media_list`.
- New post: ensure tag `Blog` exists (`POST /tags/ {name:"Blog"}`), then `POST /objects/`
  with `[Note{handle:n, text:{string}}, Source{title, author, note_list:[n], tag_list:[blogTag]}]`.

### 10.2 Tasks (ToDo)
- `GET /sources/?rules={"rules":[{"name":"HasTag","values":["ToDo"]},...filters]}&locale&sort=-gramps_id&extend=tag_list`.
- Task = Source tagged `ToDo` with `attribute_list` SrcAttributes `Status`
  (`Open`, `In Progress`, `Blocked`, `Done`) and `Priority` (`"1"`..`"9"`, default `"5"`);
  description = attached Note. Sorted by status order then priority.

### 10.3 Bookmarks, History
- Bookmarks are **localStorage only** (`bookmarks[tree][endpoint] = [handles]`), not
  `/api/bookmarks/` (that API exposes Gramps desktop bookmarks: `GET /bookmarks/`,
  `/bookmarks/{namespace}`, `PUT/DELETE /bookmarks/{namespace}/{handle}`).
  Resolved via `GET /{endpoint}/{h}?locale&profile=self`.
- History (`/recent`) = recently viewed objects (localStorage `recentObjects[tree]`).

### 10.4 Revisions (change history, ViewPrivate)
- `GET /transactions/history/?sort=-id&page&pagesize` (+`old`,`new`, `before`, `after`, `before_id`, `after_id`) -> X-Total-Count.
  Item: `{id, timestamp, description, connection: {id, timestamp, user: {name, full_name}}, changes: [{id, obj_class, trans_type, obj_handle, ref_handle, timestamp, old_data?, new_data?}]}`.
- Detail: `GET /transactions/history/{id}?old=1&new=1` (JSON diff view).
- Undo: `POST /transactions/history/{id}/undo[?force=1]` (409-ish with conflict description).
- Per-object: `GET /transactions/history/objects/{Class}/{h}?sort=-id&page&pagesize`.
- Toast "undo" after delete: `POST /transactions/?undo=1` with the transaction array returned by the delete.

### 10.5 Export / reports / import / backups
- `GET /exporters/` -> list `{extension, name, description, ...}`. Generate:
  `POST /exporters/{ext}/file?{options}` -> 202 task (or 200 `{file_name, url, messages}`);
  download `GET {url}?jwt={access}` (`/exporters/{ext}/file/processed/{filename}`).
  Options (query): `private`, `living`, `current_year`, `years_after_death`, `person`
  (filter name), `event`, `note`, `reference`, `sequence`, `include_witnesses`,
  `include_media`, `include_places`, `compress`, `translate_headers`, `locale`, ...
- Media archive: `POST /media/archive/` -> task -> `{url}`; `GET /media/archive/{filename}?jwt=`. Rate limited (429).
- Reports: `GET /reports/` (+`?include_help=1`), `GET /reports/{id}`,
  `POST /reports/{id}/file?options={json}` -> task -> `{file_name, file_type, url}`,
  download `GET /reports/{id}/file/processed/{filename}?jwt=`.
- Import (owner): `POST /importers/{ext}/file` raw file body -> task; `POST /media/archive/upload/zip`.
- Backups (owner, if `server.backups`): `GET/POST /backups/`, `GET/DELETE /backups/{id}`,
  `POST /backups/{id}/restore` (fresh token), `POST /backups/restore` (upload).

### 10.6 DNA
- People with matches: `GET /people/?rules={"rules":[{"name":"HasAssociationType","values":["DNA"]}]}&locale&sort=name&extend=person_ref_list&profile=references`.
- Matches: `GET /people/{h}/dna/matches?locale&raw=1` -> list of matches with segments
  (chromosome, start, stop, cM, SNPs), relation, ancestor info.
- A match = `PersonRef {ref: otherPerson, rel: "DNA", citation_list, note_list:[noteH]}` in
  the source person's `person_ref_list`; segment data lives in the Note text (CSV-like),
  parsed via `POST /parsers/dna-match {string}`.
- Y-DNA: people with `Y-DNA` attribute/event; `GET /people/{h}/ydna?locale&raw=1` (haplogroup tree via yclade).

### 10.7 Chat / AI assistant (UseChat + server.chat)
- `POST /chat/?background=1&verbose=1` body
  `{"query": "...", "message_history_raw": "<opaque string from last response>"}`
  (legacy `history: [{role, message}]`). Returns 202 task or
  `{response, metadata, message_history_raw}`. History stored per tree in localStorage.
- Tree min role for AI: `PUT /trees/- {min_role_ai}`.

### 10.8 Misc read endpoints
`/facts/` (statistics "did you know"), `/holidays/`, `/holidays/{country}/{y}/{m}/{d}`,
`/name-formats/`, `/name-groups/`, `/anniversaries.ics?token=` (persistent token),
`/places/coordinates/`, `/media/{h}/ocr?lang&format` (OCR -> note), `/media/{h}/face_detection`.

---

## 11. Background tasks and notifications

### 11.1 Tasks
- Async endpoints return `202 {"task": {"id": "<uuid>", "href": "/api/tasks/<uuid>"}}`.
- Poll `GET /tasks/{id}` every 1 s until `state` in `SUCCESS|FAILURE|REVOKED`:
  `{state: "PENDING|STARTED|PROGRESS|SUCCESS|FAILURE", info, result, result_object, ...}`;
  progress in `info`/`result_object` while `PROGRESS`.
- `GET /tasks/?include_state=true` -> running tasks of the tree:
  `[{task_id, name, created_at, user_id, user_name, status: queued|running|succeeded|failed|..., state}]`.
- 409 with `error.type == "task_locked"`: another task holds the tree lock.

### 11.2 Notifications
`/notifications` is a client-side log (toasts, finished tasks) + running tasks list.
Web push exists: `POST/DELETE /users/-/push-subscriptions/`.

---

## 12. Settings

### 12.1 User settings (`/settings/user`)
- `GET /users/-/` -> `{name, email, full_name, role, tree, user_id}`.
- `PUT /users/-/` `{full_name?, email?, name_new?}`; password: `POST /users/-/password/change`.
- Language (`GET /translations/` -> `[{language, default, current, native}]`), theme
  (light/dark/system), genealogical symbols, home person, per-chart settings: all localStorage.
- Access tokens (`anniversaries_ics`, `sync`), linked OIDC accounts (`/users/-/oidc-accounts/`).
- API docs link: `/api/swagger-ui`.

### 12.2 Administration (`/settings/administration`, EditOtherUser)
Sections: Data (counts), Search index (`POST /search/index/?full=1`), Tree settings
(name via `PUT /trees/- {name}`, researcher `GET/PUT /metadata/researcher/`), Customization
(tree config colors/app title/home note/home image; export/import config JSON),
Check and Repair (`POST /trees/-/repair`), Verify the Data
(`POST /trees/-/verify?oldage=..&hwdif=..&...`), Tags CRUD, Backups, Danger zone
(`POST /objects/delete/?namespaces=people,...` fresh token).

### 12.3 User management (`/settings/users`)
- `GET /users/[?tree&role=1,2&page&pagesize&user_id]` -> `[{name, email, full_name, role, tree}]`, X-Total-Count.
- Create: `POST /users/` `[{name, email, full_name, password, role, tree?}]` (batch) or
  `POST /users/{name}/` `{email, full_name, password, role, tree?}`.
- Update: `PUT /users/{name}/` `{email?, full_name?, role?, tree?, name_new?}`
  (role change needs EditUserRole; role 5 needs MakeAdmin; owners cannot cross trees).
- Delete: `DELETE /users/{name}/`.
- `/settings/info` (system info): `GET /metadata/` dump.

---

## 13. Editing and creating objects

### 13.1 Endpoints

| Action | Call | Notes |
|---|---|---|
| Create one | `POST /{type}/` body = object with `_class` | 201, body = transaction (13.3) |
| Create many (atomic) | `POST /objects/` body = `[obj, obj, ...]` | 201; handles chosen client-side (uuid4) so objects can reference each other |
| Update | `PUT /{type}/{h}` body = **full** object (`_class` + all writable keys) | 200 transaction; optional `If-Match: <etag>` -> 412 on mismatch |
| Delete | `DELETE /{type}/{h}` | 200 transaction (refs to it are removed) |
| Batch delete | `POST /objects/delete-by-handle/` `{namespace, handles}` | DeleteObject |
| Merge | `POST /{type}/{phoenix}/merge/{titanic}` | |
| Replace media file | `PUT /media/{h}/file` raw body | |
| Undo arbitrary transaction | `POST /transactions/?undo=1` body = transaction array | |

`gramps_id` may be omitted on create -> server assigns next ID (I####, F####...).
`change` is ignored/overwritten. Read-only keys to strip before PUT: `extended`,
`profile`, `backlinks`, `formatted` (frontend `toWritableObject`). Places: also drop a
stray `type` key. Server updates reciprocal refs (family -> members' `family_list` /
`parent_family_list`) on family create/update.

### 13.2 Frontend edit pattern

Edits are "read full object -> modify list/field -> PUT whole object", e.g. add an
event ref to a person:
```js
const obj = {_class: 'Person', ...toWritableObject(person)}
obj.event_ref_list = [...obj.event_ref_list, {_class: 'EventRef', ref: eventHandle, role: 'Primary'}]
await apiPut(`/api/people/${person.handle}`, obj)   // then refetch page
```
Same for `note_list` (handles), `citation_list` (handles), `media_list` (MediaRef with
`rect`), `child_ref_list`, `placeref_list`, `reporef_list`, `attribute_list`, `urls`,
`address_list`, `person_ref_list`, `alternate_names`, `primary_name`, `tag_list`,
`private`, `gender`, reorder (move up/down) of any list.

### 13.3 Write response (transaction JSON)

```json
[
  {"type": "add", "handle": "a1b2...", "_class": "Person", "old": null,
   "new": {"_class": "Person", "handle": "a1b2...", "gramps_id": "I0813", ...}},
  {"type": "add", "handle": "c3d4...", "_class": "Event", "old": null, "new": {...}},
  {"type": "update", "handle": "...", "_class": "Family", "old": {...}, "new": {...}}
]
```
Find the created object with `data.find(o => o.new._class === 'Person').new.gramps_id`
and navigate to `/person/{gramps_id}`.

### 13.4 Payload examples

New person with birth (`POST /api/objects/`):
```json
[
  {"_class": "Person", "handle": "uuid-p", "gender": 1, "private": false, "citation_list": [],
   "primary_name": {"_class": "Name", "first_name": "Johann",
                    "surname_list": [{"_class": "Surname", "surname": "Huber", "primary": true}],
                    "type": "Birth Name"},
   "event_ref_list": [{"_class": "EventRef", "ref": "uuid-b", "role": "Primary"}],
   "birth_ref_index": 0},
  {"_class": "Event", "handle": "uuid-b", "type": "Birth", "place": "<place handle>",
   "date": {"_class": "Date", "calendar": 0, "modifier": 0, "quality": 0,
            "dateval": [12, 3, 1890, false], "sortval": 0},
   "citation_list": [], "private": false}
]
```
(`type` string is sent in the server's/UI locale-translated default name in the Lit app;
English `"Birth"` is safe. Death: second EventRef + `death_ref_index`.)

New family (`POST /api/objects/`, requires AddObject + EditObject):
```json
[
  {"_class": "Family", "father_handle": "<h>", "mother_handle": "<h>", "type": "Married",
   "child_ref_list": [{"_class": "ChildRef", "ref": "<h>", "frel": "Birth", "mrel": "Birth"}]}
]
```
(new partner/child persons can be prepended in the same array.)
Add parents to existing person: `POST /api/families/` `{_class:"Family", child_ref_list:[{_class:"ChildRef", ref:personH, frel:"Birth", mrel:"Birth"}], father_handle?, mother_handle?, type?}`.
Add partner: `POST /api/families/` `{_class:"Family", father_handle: personH, mother_handle?: partnerH}`.

New event linked to participants (`/new_event`): `POST /api/events/` `{_class:"Event", handle: uuid, type, date, place, description}`,
then for each participant GET the person/family and PUT it with an extra
`{_class:"EventRef", ref: eventH, role: "Primary"|"Family"|"Witness"}`.

New note: `POST /api/notes/` `{_class:"Note", text:{_class:"StyledText", string:"..."}, type:"General"}`.
New citation: `POST /api/citations/` `{_class:"Citation", source_handle, page, date, confidence}`.
New place: `POST /api/places/` `{_class:"Place", name:{_class:"PlaceName", value:"Wien"}, place_type:"City", lat:"48.2", long:"16.37", placeref_list:[{_class:"PlaceRef", ref:parentH}]}`.
New tag: `POST /api/tags/` `{name, color, priority}`.

Drafts: forms autosave to localStorage `grampsjs_editor_drafts[tree][key]` (7 days).

### 13.5 Media upload

1. `POST /api/media/` with the raw file as body (`Content-Type` = file MIME type, set by
   the browser from the `File`; frontend fixes missing MIME by extension). Requires
   AddObject; quota checked. Response 201 transaction; new Media object at
   `data[0].new` (`handle`, `gramps_id`, `path`, `mime`, `checksum`).
2. `PUT /api/media/{handle}` with `{...data[0].new, desc, date, tag_list, private, ...}`.
3. Link: add `{_class:"MediaRef", ref: mediaHandle, rect: [x1,y1,x2,y2] | []}` to the
   person's `media_list` (PUT person). Face suggestions: `GET /media/{h}/face_detection`.

ZIP of media files: `POST /media/archive/upload/zip` (owner) -> task.

---

## 14. Media / image URLs

All require auth; for `<img src>` pass the **access token** as `?jwt=`:

| Purpose | URL |
|---|---|
| Original file | `/api/media/{h}/file?jwt={access}` (`&download=1` for attachment) |
| Thumbnail | `/api/media/{h}/thumbnail/{size}?jwt={access}&square={true\|false}[&checksum={media.checksum}]` |
| Cropped region (full res) | `/api/media/{h}/cropped/{x1}/{y1}/{x2}/{y2}?jwt={access}` |
| Cropped thumbnail (portrait) | `/api/media/{h}/cropped/{x1}/{y1}/{x2}/{y2}/thumbnail/{size}?jwt={access}&square=true` |
| Map tiles (georeferenced image) | `/api/media/{h}/tile/{z}/{x}/{y}?jwt={access}[&checksum][&max_zoom]` |
| Face regions | `GET /api/media/{h}/face_detection` -> `[[x1,y1,x2,y2], ...]` (percent) |

- `{x1..y2}` = integers 0-100 (percent of width/height) from `MediaRef.rect`; frontend
  normalizes (clamp, round, order) and skips invalid rects. There is **no** `/face/...`
  thumbnail route; portraits use `cropped/.../thumbnail`.
- `size` = max edge in px (frontend uses 100-200 for chart/list cards, 600, 1000 for lightbox).
- `square=true` = center-cropped square thumbnail.
- `checksum` is ignored by the backend (only cache-busting for the service worker; tiles
  with checksum get `Cache-Control: immutable`).
- Since the jwt in the URL expires after 15 min, rebuild URLs after `token:refreshed`
  (or use a fetch+blob/service-worker approach). With nginx same-origin proxy no CORS.
- Thumbnails for PDF/video only if `metadata.server.thumbnails.pdf/video`.
- Person portrait in lists/charts: `person.media_list[0]` (ref + rect) -> cropped
  thumbnail if rect valid else plain thumbnail. In profile-only list queries
  (`keys=...profile...`) `media_list` is not returned; add `media_list` to `keys`.

---

## 15. Implementation checklist for the React app

1. `api.ts`: fetch wrapper with token refresh (60 s skew, single in-flight refresh,
   logout on 403/422, retry 429), returns `{data, totalCount, etag}`.
2. Parse JWT claims for `tree` and `permissions`; namespace all local state by `tree`.
3. Lists: `?page&pagesize&sort&keys&profile=self&locale` + `X-Total-Count`.
4. Detail pages: `?gramps_id=..&profile=all&extend=all&backlinks=true&locale&precision=1`.
5. Charts: one `/people/?rules=...&extend=event_ref_list,primary_parent_family,family_list&profile=self` query, layout client-side.
6. Images: `getThumbnailUrl(handle,size,square)` / cropped variant with `?jwt=`.
7. Writes: full-object PUT with `_class`; multi-object creates via `POST /objects/`;
   client-side uuid4 handles; read `new.gramps_id` from the transaction response.
8. Hide UI by permission flags (section 3); guests never see private objects anyway.
