-- D1 schema for the plot portal. Field names mirror GovernmentBP land registries
-- (src/registry/land/*): plots, streets, districts, sectors, zoning types, units,
-- ownership history, lottery, merges. Owners are OwnerRef pairs (kind, number).
-- schemaVersion 1

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS zoning_types (
    id                   INTEGER PRIMARY KEY,
    name                 TEXT NOT NULL UNIQUE,
    price_per_100_blocks INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS districts (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sectors (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    x1 INTEGER NOT NULL, z1 INTEGER NOT NULL, x2 INTEGER NOT NULL, z2 INTEGER NOT NULL
);

-- A street is one rectangle; a named street may consist of several rows.
CREATE TABLE IF NOT EXISTS streets (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    x1 INTEGER NOT NULL, z1 INTEGER NOT NULL, x2 INTEGER NOT NULL, z2 INTEGER NOT NULL
);

-- Identity numbers come from GovBP (nb_identity). NULL until linked to a player.
CREATE TABLE IF NOT EXISTS citizens (
    number          INTEGER PRIMARY KEY,
    identity_number INTEGER UNIQUE,
    name            TEXT NOT NULL,
    nio             TEXT,
    age             TEXT,
    profession      TEXT,
    photo_url       TEXT,
    role            TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen','clerk','admin')),
    pin_salt        TEXT,
    pin_hash        TEXT
);

CREATE TABLE IF NOT EXISTS companies (
    number     INTEGER PRIMARY KEY,
    gov_number INTEGER UNIQUE,            -- GovernmentBP company number; NULL until linked
    name       TEXT NOT NULL,
    legal_form TEXT,
    photo_url  TEXT
);

CREATE TABLE IF NOT EXISTS plots (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    zoning_type_id  INTEGER REFERENCES zoning_types(id),
    x1 INTEGER NOT NULL, z1 INTEGER NOT NULL, x2 INTEGER NOT NULL, z2 INTEGER NOT NULL,
    side_x          INTEGER NOT NULL,
    side_z          INTEGER NOT NULL,
    area            INTEGER NOT NULL DEFAULT 0,
    value           INTEGER NOT NULL DEFAULT 0,
    sector_id       INTEGER REFERENCES sectors(id),
    district_id     INTEGER REFERENCES districts(id),
    street_id       INTEGER REFERENCES streets(id),
    building_number TEXT,
    owner_kind      TEXT CHECK (owner_kind IN ('citizen','company')),
    owner_number    INTEGER,
    merged_into     INTEGER REFERENCES plots(id),
    version         INTEGER NOT NULL DEFAULT 1,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS units (
    id               INTEGER PRIMARY KEY,
    plot_id          INTEGER NOT NULL REFERENCES plots(id),
    unit_number      TEXT,
    stairwell        TEXT,
    floor            TEXT,
    area             INTEGER NOT NULL DEFAULT 0,
    bed_count        INTEGER NOT NULL DEFAULT 0,
    workplace_count  INTEGER NOT NULL DEFAULT 0,
    tenant_kind      TEXT CHECK (tenant_kind IN ('citizen','company')),
    tenant_number    INTEGER,
    tenant_label     TEXT
);

CREATE TABLE IF NOT EXISTS ownership_history (
    id                INTEGER PRIMARY KEY,
    plot_id           INTEGER NOT NULL REFERENCES plots(id),
    owner_kind        TEXT CHECK (owner_kind IN ('citizen','company')),
    owner_number      INTEGER,
    transaction_value TEXT,
    transaction_day   INTEGER,
    transaction_type  TEXT,
    check_number      TEXT,
    paid              INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lottery (
    id            INTEGER PRIMARY KEY,
    plot_id       INTEGER NOT NULL REFERENCES plots(id),
    winner_kind   TEXT CHECK (winner_kind IN ('citizen','company')),
    winner_number INTEGER,
    amount        TEXT,
    check_number  TEXT,
    paid          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS merges (
    id              INTEGER PRIMARY KEY,
    main_plot_id    INTEGER NOT NULL REFERENCES plots(id),
    merging_plot_id INTEGER NOT NULL REFERENCES plots(id)
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    at          TEXT NOT NULL DEFAULT (datetime('now')),
    actor       INTEGER,
    entity      TEXT NOT NULL,
    entity_id   INTEGER,
    action      TEXT NOT NULL,
    diff        TEXT
);

CREATE INDEX IF NOT EXISTS idx_plots_district ON plots(district_id);
CREATE INDEX IF NOT EXISTS idx_units_plot ON units(plot_id);
CREATE INDEX IF NOT EXISTS idx_ownership_plot ON ownership_history(plot_id);

-- Metro (stage 5). Mirrors TransportationBP (src/registry/metro/MetroExchange.ts). Track and platforms exist only in
-- the game, so stations/lines are imported from it; the portal edits line attributes and station names, which are
-- exported back as updates. `portal_edited` marks rows edited here and not yet overwritten by a game import.
CREATE TABLE IF NOT EXISTS metro_stations (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    x INTEGER, y INTEGER, z INTEGER,       -- NULL when the station has no platform in the world
    platform_count  INTEGER NOT NULL DEFAULT 0,
    portal_edited   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS metro_lines (
    id             INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    color          TEXT NOT NULL,           -- Minecraft formatting-code character, see METRO_PALETTE
    speed          INTEGER NOT NULL,
    dwell_seconds  INTEGER NOT NULL,
    train_count    INTEGER NOT NULL DEFAULT 1,
    circular       INTEGER NOT NULL DEFAULT 0,
    through_loops  INTEGER NOT NULL DEFAULT 0,
    shuttle        INTEGER NOT NULL DEFAULT 0,
    running        INTEGER NOT NULL DEFAULT 0,
    station_ids    TEXT NOT NULL DEFAULT '[]',   -- JSON array, in service order
    segments       TEXT NOT NULL DEFAULT '[]',   -- JSON: one [[x,z],...] polyline per compiled leg
    portal_edited  INTEGER NOT NULL DEFAULT 0
);

-- Auth (stage 2). Session tokens are stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash    TEXT PRIMARY KEY,
    citizen_number INTEGER NOT NULL REFERENCES citizens(number),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    key    TEXT NOT NULL,            -- 'id:<identityNumber>' or 'ip:<address>'
    at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_key ON login_attempts(key, at);
