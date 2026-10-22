# Family Archive — a modern UI for Gramps Web

A new, fast and friendly web interface for [Gramps Web](https://www.grampsweb.org/), the web version of the
genealogy software [Gramps](https://gramps-project.org/). It replaces only the user interface: your data,
users, permissions, search, media, reports and background jobs stay exactly as they are, served by the
unchanged Gramps Web API.

![Person page](docs/screenshots/person-dark.webp)

| | |
|---|---|
| ![Family tree](docs/screenshots/tree.webp) | ![Family page](docs/screenshots/family.webp) |
| ![People list](docs/screenshots/people.webp) | ![Map](docs/screenshots/map.webp) |
| ![Light theme](docs/screenshots/person-light.webp) | ![Phone](docs/screenshots/phone.webp) |

## Why

Gramps Web is a great backend with a capable but dated interface. This project keeps the backend and gives
it a UI that relatives of every age enjoy using:

- **People first** — large portraits, a life story told by years, families as faces.
- **Fast** — lists with thousands of people scroll instantly; data is cached and refreshed precisely after edits.
- **Uses your whole screen** — three-column layouts on wide monitors, one column on phones.
- **Made for phones too** — bottom tab bar, bottom sheets, swipeable photos; installable as an app.
- **Dark and light themes**, neutral by default, with a personal accent colour.
- **German and English.**

Everything Gramps Web can do is supported: people, families, events, places, sources, citations,
repositories, notes and media (with face regions and OCR); family tree charts (ancestors, descendants,
hourglass, fan, relationships); map with historic overlays; timeline; full-text search; blog; tasks;
bookmarks; change history with undo; reports, export and import; DNA matches; user management and tree
settings. See [docs/gramps-web-reference.md](docs/gramps-web-reference.md) for the full feature mapping.

## Switch an existing Gramps Web installation

If you run Gramps Web with the [official docker-compose setup](https://www.grampsweb.org/install_setup/deployment/),
you only change the image. The new image *is* the official Gramps Web image with this UI built in, so the API,
the Celery worker, your volumes and your configuration stay exactly the same.

1. In your `docker-compose.yml`, replace the image of the `grampsweb` service (and of `grampsweb_celery`,
   which usually shares it):

   ```diff
    services:
      grampsweb: &grampsweb
   -    image: ghcr.io/gramps-project/grampsweb:latest
   +    image: ghcr.io/b21-agency/gramps-ui:latest
   ```

2. Pull and restart:

   ```sh
   docker compose pull
   docker compose up -d
   ```

3. Open Gramps Web as before. Sign in with your existing account — that's it.

**Going back** is the same step in reverse: change the image back to `ghcr.io/gramps-project/grampsweb:latest`
and run `docker compose up -d`. Nothing in your data is changed by switching.

> Tip: back up your volumes (or use Gramps Web's export) before any upgrade — good practice, not a requirement.

### Keep the classic UI running side by side (optional)

If you prefer to try the new interface next to the classic one, use the small proxy variant instead. It
serves the new UI and forwards `/api/` to your existing Gramps Web container:

```yaml
services:
  # ... your existing grampsweb, grampsweb_celery and grampsweb_redis services ...
  ui:
    image: ghcr.io/b21-agency/gramps-ui:latest-proxy
    restart: always
    ports:
      - "8080:80"            # new UI on :8080, classic UI stays on its usual port
    environment:
      GRAMPSWEB_UPSTREAM: http://grampsweb:5000
    depends_on: [grampsweb]
```

### Image tags

| Tag | What it is |
|---|---|
| `latest` | Official Gramps Web (latest) with the new UI — drop-in replacement |
| `<commit sha>` | The same, pinned to a specific build |
| `latest-proxy` | nginx serving only the new UI, proxying `/api/` to an existing Gramps Web |

## Development

Requirements: Node 22, pnpm, Docker.

```sh
pnpm install
docker compose -p gramps-dev -f dev/docker-compose.yml up -d   # local Gramps Web backend
./dev/seed.sh                                                  # first run: example tree + users
pnpm dev                                                       # http://localhost:5173
```

Test users: `owner`, `editor`, `guest` (password = user name). To develop against a real instance:
`GRAMPS_API_TARGET=https://your-gramps-web.example pnpm dev`.

Stack: React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, RTK Query (generated from the Gramps Web
OpenAPI spec: `pnpm api:fetch-spec && pnpm api:generate`), react-router, i18next, MapLibre.
Read [docs/ui-conventions.md](docs/ui-conventions.md) before contributing code.

Build the images locally:

```sh
docker build -t gramps-ui .                    # drop-in (default target)
docker build --target proxy -t gramps-ui:proxy .
```

## How you can help

This is a young project and every bit of help makes it better for families everywhere.

- **Try it and tell us what you think.** Switch your installation (it's reversible), use it with your
  family, and open an issue with anything that feels wrong, confusing or slow — screenshots help.
- **Report bugs** with steps to reproduce, your browser/device and your Gramps Web version.
- **Test on phones and tablets.** Real devices find problems no emulator does (keyboards in bottom sheets,
  notches, gestures, installing as an app).
- **Translate.** UI texts live in `src/locales/<area>.<lang>.ts`. Adding a language means copying the
  English files and translating them — no programming needed. Corrections to the German texts are welcome too.
- **Improve accessibility.** Screen-reader and keyboard users: tell us where it doesn't work for you.
- **Share your use case.** Large trees, unusual data, other cultures' naming and calendars — real-world
  data exposes the edge cases.
- **Contribute code.** Pick an issue, open a pull request, keep changes focused and follow the conventions.
- **Spread the word** — and star the repository if you like it.
- **Support Gramps itself.** This UI stands on the shoulders of the Gramps and Gramps Web projects;
  consider contributing to or donating to them as well.

## Relationship to Gramps Web

This is an independent, community frontend. It is not affiliated with or endorsed by the Gramps project.
It talks only to the public Gramps Web API and does not modify the backend. Many thanks to the Gramps and
Gramps Web developers for their excellent work.
