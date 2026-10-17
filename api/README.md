# Plot portal API (Cloudflare Worker + D1)

## Setup (once)
```
cd api
npx wrangler d1 create plot-portal            # paste database_id into wrangler.toml
npx wrangler d1 execute plot-portal --remote --file=schema.sql
(cd ../tools && npm install && node import-sheet.mjs)   # writes api/seed.sql from the sheet
npx wrangler d1 execute plot-portal --remote --file=seed.sql
npx wrangler secret put PEPPER                # long random string; never change it later (invalidates all PINs)
npx wrangler secret put SYNC_TOKEN            # long random string used by the PIN sync call below
npx wrangler deploy
```
Then set `API_BASE` in `js/config.js` to the Worker URL.

`schema.sql` uses `IF NOT EXISTS`, so re-running it after an update only adds new tables.

## Local development (no Cloudflare account)
```
cd tools && npm install && node import-sheet.mjs     # once, creates api/seed.sql
node dev-server.mjs                                  # http://localhost:8787, dev login: identifier 1, PIN 12345678
```
Serves the portal and runs the Worker on SQLite (Node 22+). The database is in memory and resets on restart;
set `DB_FILE=dev.sqlite` to keep edits.

## First admin
Roles are `citizen` (default), `clerk`, `admin`. Promote someone directly in D1:
```
npx wrangler d1 execute plot-portal --remote --command "UPDATE citizens SET role='admin' WHERE name='<Name>'"
```

## Getting PINs from the game
1. In game: Citizen app -> Citizen affairs -> *Portal PIN* -> generate. The player gets their identifier and an 8-digit PIN once.
2. Operator runs `/scriptevent nb:gov_pin_export`. The content log gets a line `[gov_pin_export] {"records":[...]}` (salted hashes only).
3. POST that JSON object to the Worker:
```
curl -X POST $API_BASE/api/sync/pins -H "Authorization: Bearer $SYNC_TOKEN" -H "Content-Type: application/json" -d @pins.json
```
Records are matched to portal citizens by identity number, or (first time) by case-insensitive name, which then links
`citizens.identity_number`. The response lists `unmatched` records; link those by hand:
`UPDATE citizens SET identity_number = <n> WHERE number = <portal number>` and sync again.

## PIN hash spec
Shared with GovernmentBP `src/registry/PinHash.ts` (`PIN_ROUNDS` must match `api/src/auth.js`). The Worker additionally
stores `HMAC-SHA256(PEPPER, hash)`, so a leaked database cannot be brute-forced without the secret.

## Exchange with GovernmentBP (manual JSON)
Until the server-net API is usable, land data moves as JSON. The format is `api/src/LandExchange.ts`, a verbatim copy
of `GovernmentBP/src/registry/land/LandExchange.ts` (the canonical one; keep them identical). Ids are preserved, money is
numeric, and an owner is `{kind, number}` where a citizen's number is their GovBP identity number and a company's number is
its GovBP company number (`citizens.identity_number`, `companies.gov_number` here).

**GovBP -> portal**
1. In game (operator): `/scriptevent nb:land_export` writes numbered `[gov_land_export]` lines to the content log.
2. `node tools/log-to-json.mjs <content-log> land-export.json` rebuilds the document.
3. Portal, as admin: *Import JSON...* -> review the summary (before/after counts, citizens/companies to be linked by name or
   created) -> *Zastosuj import*. Import **replaces the whole land dataset** (one batch); accounts, roles and PINs are kept.

**Portal -> GovBP**
1. Portal, as admin: *Plik importu GovBP* downloads `ImportData.ts` (or *Eksport JSON* for the bare document).
   Owners without a GovBP number block the export (409) unless you accept exporting them as the City Treasury.
2. Replace `GovernmentBP/src/registry/land/ImportData.ts` with it and `npm run build`.
3. In game: `/scriptevent nb:land_import_check` (dry run), then `/scriptevent nb:land_import_apply`. The game validates
   the whole file first, logs a backup export, then replaces each set in the file.

What the game cannot hold is skipped with a warning rather than invented: portal units have no geometry (game units stay as
they are), transfers to the Treasury and lottery entries without a winner are dropped, and merges need the surveyed areas
only the game has. Transaction days are raw `world.getDay()` on both sides; `Darowizna`/`Sprzedaż` map to `donation`/`sale`.

Existing deployments need `ALTER TABLE companies ADD COLUMN gov_number INTEGER;` (fresh installs get it from `schema.sql`).

## Metro (TransportationBP)
Tracks and platforms only exist in the game, so the portal shows the metro but never creates lines or stations. The format is
`api/src/MetroExchange.ts`, a verbatim copy of `TransportationBP/src/registry/metro/MetroExchange.ts` (the canonical one; keep
them identical), described in `schema/transportation.schema.json`.

**Game -> portal** (stations with the world position of their platforms, lines with colour, stops and the drawn route):
1. In game (operator): `/scriptevent nb:metro_export` writes numbered `[trn_metro_export]` lines to the content log.
2. `node tools/log-to-json.mjs <content-log> metro.json` rebuilds the document (the tool understands both exports).
3. Portal, as admin: *Import metra...* -> the summary lists portal edits that the import would replace -> *Zastosuj import*.
   Import replaces all metro data. Lines that do not compile are drawn as dashed straight links between their stops.

**Portal -> game** (admin edits in the portal: line colour, speed, dwell, trains, kind and stops, plus station names):
1. Portal, as admin: *Plik metra dla gry* downloads `MetroImportData.ts`.
2. Replace `TransportationBP/src/registry/metro/MetroImportData.ts`, `npm run build`.
3. In game: `/scriptevent nb:metro_import_check`, then `/scriptevent nb:metro_import_apply`. Only existing ids are updated; a running
   line whose stops or kind changed is stopped and has to be compiled and started again from the controller. Line names stay
   as they are (the voice announcements only know M1-M12).

Rows edited in the portal are marked until the next game import replaces them (`portal_edited`).

## Endpoints
| Method | Path | Notes |
|---|---|---|
| GET | `/api/snapshot` | Public; with a bearer token, includes the caller's confidential transaction fields (staff: all) |
| POST | `/api/login` | `{identityNumber, pin}` -> `{token, user}`; 5 failures/identity and 20/IP per 15 min -> 429 |
| GET | `/api/me`, POST `/api/logout` | Bearer token |
| POST | `/api/sync/pins` | `SYNC_TOKEN` only |
| POST | `/api/plots` | clerk/admin. Rectangle is normalized, area/value/sector computed, overlap with other plots -> 409 (`ignoreOverlap` is admin-only) |
| PATCH | `/api/plots/:id` | clerk/admin. Body needs the `version` you read; stale -> 409 `version_conflict` with the current plot |
| POST | `/api/plots/:id/transfer` | clerk/admin. Adds an ownership row; the owner changes only when `paid` is true |
| DELETE | `/api/plots/:id` | admin. Refused (409) while units, history, lottery or merges reference the plot |
| POST/PATCH/DELETE | `/api/streets[/:id]`, `/api/districts[/:id]` | clerk/admin create+edit, admin delete (refused while plots use them) |
| GET | `/api/export[?allowUnlinked=1][&format=module]` | admin. `{doc, warnings}`, or `ImportData.ts` for the game; 409 `unlinked_owners` lists owners without a GovBP number |
| POST | `/api/import[?dryRun=1]` | admin. Body is the exchange document; replaces all land data; dry run returns the plan only |
| GET | `/api/metro` | Public. Palette, stations, lines with colour hex and route segments |
| POST | `/api/metro/import[?dryRun=1]` | admin. A `metro-snapshot` document; replaces all metro data; the plan lists portal edits that would be lost |
| GET | `/api/metro/export[?format=module]` | admin. A `metro-updates` document, or `MetroImportData.ts` for the game |
| PATCH | `/api/metro/lines/:id`, `/api/metro/stations/:id` | admin. Validated with the game's own validator; audited |
| GET | `/api/audit?entity=&id=&limit=` | clerk/admin. Every write above is logged with actor and before/after |

Text written through the plot/street/district endpoints may not contain `< > & " ' \`` or control characters (defence in depth: the portal
escapes everything it renders, but the same data is also read by the game and by exports).
