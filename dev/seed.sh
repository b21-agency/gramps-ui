#!/bin/sh
# Seed the local dev stack: users, example tree (via the import API), example media files.
set -e
cd "$(dirname "$0")"
C="docker compose -p gramps-dev -f docker-compose.yml"
$C exec -T grampsweb sh -c '
  python3 -m gramps_webapi user add --fullname "Demo Owner" --email owner@example.com --role 4 owner owner
  python3 -m gramps_webapi user add --fullname "Demo Editor" --role 3 editor editor
  python3 -m gramps_webapi user add --fullname "Demo Guest" --role 0 guest guest
  cp /venv/share/doc/gramps/example/gramps/*.jpg /venv/share/doc/gramps/example/gramps/*.png /app/media/
  cp /venv/share/doc/gramps/example/gramps/example.gramps /tmp/example.gramps'
TMP=$(mktemp -d)
$C cp grampsweb:/tmp/example.gramps "$TMP/example.gramps"
TOKEN=$(curl -fsS -X POST http://localhost:5055/api/token/ -H 'content-type: application/json' \
  -d '{"username":"owner","password":"owner"}' | sed -E 's/.*"access_token": ?"([^"]+)".*/\1/')
curl -fsS -X POST -H "Authorization: Bearer $TOKEN" --data-binary @"$TMP/example.gramps" \
  http://localhost:5055/api/importers/gramps/file
echo
echo "Import started; the example tree is ready after ~30 s."
rm -rf "$TMP"
