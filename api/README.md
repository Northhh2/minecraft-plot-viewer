# Plot portal API (Cloudflare Worker + D1)

## Setup (once)
```
cd api
npx wrangler d1 create plot-portal            # paste database_id into wrangler.toml
npx wrangler d1 execute plot-portal --remote --file=schema.sql
npx wrangler secret put PEPPER                # long random string; never change it later (invalidates all PINs)
npx wrangler secret put SYNC_TOKEN            # long random string used by the PIN sync call below
npx wrangler deploy
```
Then set `API_BASE` in `js/config.js` to the Worker URL.

`schema.sql` uses `IF NOT EXISTS`, so re-running it after an update only adds new tables.

## Local development (no Cloudflare account)
```
cd tools && node dev-server.mjs                      # http://localhost:8787, dev login: identifier 1, PIN 12345678
                                                     # (seeds the in-memory database from api/seed.sql)
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

## Exchange with GovernmentBP (automatic)
All game data moves through the sync agent (`tools/sync-agent.mjs`, run from cron on the VPS; see `tools/sync-agent.env.example`
and `tools/run-sync-agent.sh`). There are no manual file imports. The land format is `api/src/LandExchange.ts`, a verbatim copy
of `GovernmentBP/src/registry/land/LandExchange.ts` (the canonical one; keep them identical). Ids are preserved, money is numeric
(zone prices may be fractional, they are rounded only at the end of a value calculation), and an owner is `{kind, number}` where a
citizen's number is their GovBP identity number and a company's number is its GovBP company number.

**Game -> portal** (every few minutes, only when something changed): the game logs numbered `[gov_land_export]`, `[gov_city_export]`
and `[trn_metro_export]` chunks to the content log and the agent POSTs the newest complete export of each to
`/api/sync/land`, `/api/sync/city` and `/api/sync/metro`. A land import **replaces the whole land dataset** (accounts, roles and
PINs are kept). The portal alone assigns a plot's sector: the sector whose box overlaps the plot's box the most, recomputed on every
import and plot edit. A plot's full identifier is `<sector name>/<plot id>`.

**Portal -> game** (`--pull`): the agent sends the portal's data as `scriptevent` chunks through the Crafty console, and applying it
stays a manual step in the game: `/scriptevent nb:land_pull_check` then `nb:land_pull_apply` (a backup export is logged first), and
`nb:metro_pull_check` then `nb:metro_pull_apply`. Portal edits are only pulled when the game did not change in the same pass.

What the game cannot hold is skipped with a warning rather than invented: portal units have no geometry (game units stay as
they are), transfers to the Treasury and lottery entries without a winner are dropped, and merges need the surveyed areas
only the game has. Transaction days are raw `world.getDay()` on both sides; `Darowizna`/`Sprzedaż` map to `donation`/`sale`.

Existing deployments need `ALTER TABLE companies ADD COLUMN gov_number INTEGER;` (fresh installs get it from `schema.sql`).

## Metro (TransportationBP)
Tracks and platforms only exist in the game, so the portal shows the metro but never creates lines or stations. The format is
`api/src/MetroExchange.ts`, a verbatim copy of `TransportationBP/src/registry/metro/MetroExchange.ts` (the canonical one; keep
them identical), described in `schema/transportation.schema.json`.

**Game -> portal** (stations with the world position of their platforms, lines with colour, stops and the drawn route): the
game exports automatically and the agent posts it to `/api/sync/metro`. The import is **refused (409)** while admin edits made in the
portal have not been applied in the game yet, so they are never silently lost; it goes through once the game reports them.
Lines that do not compile are drawn as dashed straight links between their stops.

**Portal -> game** (admin edits in the portal: line colour, speed, dwell, trains, kind and stops, plus station names): `--pull`
delivers the `metro-updates` document (`GET /api/sync/metro-export`); in the game run `/scriptevent nb:metro_pull_check`, then
`/scriptevent nb:metro_pull_apply`. Only existing ids are updated; a running line whose stops or kind changed is stopped and has to be
compiled and started again from the controller. Line names stay as they are (the voice announcements only know M1-M12).

Rows edited in the portal are marked (`portal_edited`) until the game's next export replaces them.

## Building permits and city variables
Both arrive in the city snapshot (`permits`, `variables`; no schema change, served by `GET /api/city`). The Ratusz modal has
*Pozwolenia* (status tracker per permit, "mine" filter) and *Zmienne* (registry, scheduled values, history); a plot modal has a
*Zabudowa* section. A plot counts as built only when one of its permits is `completed`; plots with a permit in progress get an
orange dashed outline on the map. The allowance's variables (`allowance.*`) and Council motions about them are stripped from the
public response, like the rest of the allowance config.

