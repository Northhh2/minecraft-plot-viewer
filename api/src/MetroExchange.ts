/**
 * Metro exchange format v1 — the JSON shared by TransportationBP and the plot portal.
 *
 * Pure TypeScript with no Minecraft imports (unit-testable in plain Node); MetroSync.ts does the registry
 * I/O around it. The portal keeps a verbatim copy at api/src/MetroExchange.ts — this file is the canonical one.
 *
 * Two documents, told apart by `kind`:
 *  - "metro-snapshot" (game -> portal): stations with world positions and lines with colours, stops and the
 *    drawn route. Track and platforms only exist in the world, so the portal can show them but never create them.
 *  - "metro-updates"  (portal -> game): changes to EXISTING lines (colour, speed, dwell, trains, flags, stops)
 *    and station names, matched by id. Line names stay as they are: the voice announcements only know M1–M12.
 */

export const METRO_EXCHANGE_VERSION = 1;

/** Minecraft formatting-code characters a line may use, with the colour they render as. `n` (copper) and
 *  `u` (amethyst) are Bedrock material colours, approximated here. */
export const METRO_PALETTE: ReadonlyArray<{ code: string; hex: string }> = [
    { code: "c", hex: "#FF5555" }, { code: "9", hex: "#5555FF" }, { code: "a", hex: "#55FF55" }, { code: "e", hex: "#FFFF55" },
    { code: "6", hex: "#FFAA00" }, { code: "d", hex: "#FF55FF" }, { code: "b", hex: "#55FFFF" }, { code: "f", hex: "#FFFFFF" },
    { code: "5", hex: "#AA00AA" }, { code: "2", hex: "#00AA00" }, { code: "3", hex: "#00AAAA" }, { code: "4", hex: "#AA0000" },
    { code: "1", hex: "#0000AA" }, { code: "n", hex: "#B4684D" }, { code: "u", hex: "#9A5CC6" }
];

export type PlatformSide = "left" | "right";
export type PlatformDirection = "forward" | "backward" | "both";

export interface PlatformRec { pieceId: number; side: PlatformSide; direction: PlatformDirection; x: number; y: number; z: number }
export interface StationRec { id: number; name: string; x: number | null; y: number | null; z: number | null; platforms: PlatformRec[] }
export type PathPoint = [number, number];
export interface LineRec {
    id: number; name: string; color: string; speed: number; dwellSeconds: number; trainCount: number;
    circular: boolean; throughLoops: boolean; shuttle: boolean; running: boolean;
    stationIds: number[];
    /** The drawn route, one polyline per compiled leg ([x, z] block coordinates); empty when the line does not compile. */
    segments: PathPoint[][];
}

export interface MetroSnapshot {
    schemaVersion: number;
    kind: "metro-snapshot";
    source: string;
    exportedAt: string;
    palette: Array<{ code: string; hex: string }>;
    stations: StationRec[];
    lines: LineRec[];
}

export interface LineUpdate {
    id: number; color: string; speed: number; dwellSeconds: number; trainCount: number;
    circular: boolean; throughLoops: boolean; shuttle: boolean; stationIds: number[];
}
export interface StationUpdate { id: number; name: string }
export interface MetroUpdates {
    schemaVersion: number;
    kind: "metro-updates";
    source: string;
    exportedAt: string;
    stations: StationUpdate[];
    lines: LineUpdate[];
}

export const hexOfColor = (code: string): string => METRO_PALETTE.find(p => p.code === code)?.hex ?? "#FFFFFF";

// ─── geometry helpers ────────────────────────────────────────────────────────────

/** Thins a dense path to roughly one point per `spacing` blocks, always keeping both ends, so a whole
 *  line stays small enough to ship (the game samples tracks every 1/8 block). */
export function simplifyPath(points: Array<{ x: number; z: number }>, spacing = 6): PathPoint[] {
    if (points.length === 0) return [];
    const out: PathPoint[] = [];
    const push = (x: number, z: number) => {
        const p: PathPoint = [Math.round(x), Math.round(z)];
        const last = out[out.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
    };
    let lx = points[0].x, lz = points[0].z;
    push(lx, lz);
    for (let i = 1; i < points.length - 1; i++) {
        if (Math.hypot(points[i].x - lx, points[i].z - lz) >= spacing) {
            push(points[i].x, points[i].z);
            lx = points[i].x; lz = points[i].z;
        }
    }
    const end = points[points.length - 1];
    push(end.x, end.z);
    return out;
}

// ─── export ──────────────────────────────────────────────────────────────────────

export function buildMetroSnapshot(stations: StationRec[], lines: LineRec[], exportedAt: string): MetroSnapshot {
    return {
        schemaVersion: METRO_EXCHANGE_VERSION, kind: "metro-snapshot", source: "TransportationBP", exportedAt,
        palette: METRO_PALETTE.map(p => ({ ...p })), stations, lines
    };
}

const LOG_TAG = "[trn_metro_export]";

/** Same chunking as the land export (see GovernmentBP LandExchange.chunkForLog): numbered lines, spaces escaped
 *  as ` ` so a viewer trimming line ends cannot corrupt a chunk. tools/log-to-json.mjs reassembles. */
export function chunkForLog(json: string, exportId: string, chunkSize = 1200): string[] {
    const safe = json.replace(/ /g, "\\u0020");
    const parts: string[] = [];
    for (let i = 0; i < safe.length; i += chunkSize) parts.push(safe.slice(i, i + chunkSize));
    if (parts.length === 0) parts.push("");
    return parts.map((p, i) => `${LOG_TAG} ${exportId} ${i + 1}/${parts.length} ${p}`);
}

// ─── validation ──────────────────────────────────────────────────────────────────

export interface ParseResult<T> { ok: boolean; errors: string[]; warnings: string[]; data: T | null }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const MAX_ERRORS = 50;
const MAX_POINTS = 40000;

function collector() {
    const errors: string[] = [];
    return {
        errors,
        fail: (msg: string) => { if (errors.length < MAX_ERRORS) errors.push(msg); else if (errors.length === MAX_ERRORS) errors.push("…kolejne błędy pominięto."); }
    };
}

function checkHeader(raw: unknown, kind: string, fail: (m: string) => void): raw is Record<string, unknown> {
    if (!isObj(raw)) { fail("Dokument nie jest obiektem JSON."); return false; }
    if (raw.schemaVersion !== METRO_EXCHANGE_VERSION) { fail(`Nieobsługiwana wersja schematu: ${String(raw.schemaVersion)} (oczekiwano ${METRO_EXCHANGE_VERSION}).`); return false; }
    if (raw.kind !== kind) { fail(`Zły rodzaj dokumentu: „${String(raw.kind)}” (oczekiwano „${kind}”).`); return false; }
    return true;
}

/** Validates a game export (for the portal). Rejects anything malformed rather than guessing. */
export function parseMetroSnapshot(raw: unknown): ParseResult<MetroSnapshot> {
    const { errors, fail } = collector();
    const warnings: string[] = [];
    if (!checkHeader(raw, "metro-snapshot", fail)) return { ok: false, errors, warnings, data: null };

    const codes = new Set(METRO_PALETTE.map(p => p.code));
    const stationsRaw = Array.isArray(raw.stations) ? raw.stations : (fail("„stations” musi być tablicą."), []);
    const linesRaw = Array.isArray(raw.lines) ? raw.lines : (fail("„lines” musi być tablicą."), []);

    const stations: StationRec[] = [];
    const stationIds = new Set<number>();
    stationsRaw.forEach((s: unknown, i: number) => {
        const w = `Stacja [${i}]`;
        if (!isObj(s) || !isInt(s.id) || s.id < 1) { fail(`${w}: nieprawidłowe id.`); return; }
        if (stationIds.has(s.id)) fail(`${w}: zduplikowane id ${s.id}.`);
        stationIds.add(s.id);
        const name = typeof s.name === "string" ? s.name.trim() : "";
        if (name.length === 0 || name.length > 64) fail(`${w}: nazwa musi mieć 1–64 znaków.`);
        const hasPos = isInt(s.x) && isInt(s.z);
        if (!hasPos && !(s.x === null && s.z === null)) fail(`${w}: współrzędne muszą być oboma liczbami całkowitymi albo oboma null.`);
        const platforms: PlatformRec[] = [];
        for (const p of Array.isArray(s.platforms) ? s.platforms : []) {
            if (!isObj(p) || !isInt(p.pieceId) || !isInt(p.x) || !isInt(p.y) || !isInt(p.z)) { fail(`${w}: nieprawidłowa platforma.`); continue; }
            platforms.push({
                pieceId: p.pieceId, x: p.x, y: p.y, z: p.z,
                side: p.side === "left" ? "left" : "right",
                direction: p.direction === "forward" || p.direction === "backward" ? p.direction : "both"
            });
        }
        stations.push({ id: s.id, name: name.slice(0, 64), x: hasPos ? (s.x as number) : null, y: isInt(s.y) ? s.y : null, z: hasPos ? (s.z as number) : null, platforms });
    });

    const lines: LineRec[] = [];
    const lineIds = new Set<number>();
    let points = 0;
    linesRaw.forEach((l: unknown, i: number) => {
        const w = `Linia [${i}]`;
        if (!isObj(l) || !isInt(l.id) || l.id < 1) { fail(`${w}: nieprawidłowe id.`); return; }
        if (lineIds.has(l.id)) fail(`${w}: zduplikowane id ${l.id}.`);
        lineIds.add(l.id);
        const name = typeof l.name === "string" ? l.name.trim() : "";
        if (name.length === 0 || name.length > 16) fail(`${w}: nazwa musi mieć 1–16 znaków.`);
        if (typeof l.color !== "string" || !codes.has(l.color)) fail(`${w}: nieznany kolor „${String(l.color)}”.`);
        if (!isInt(l.speed) || l.speed < 1 || l.speed > 200) fail(`${w}: prędkość musi być liczbą 1–200.`);
        if (!isInt(l.dwellSeconds) || l.dwellSeconds < 0 || l.dwellSeconds > 600) fail(`${w}: postój musi być liczbą 0–600 s.`);
        const trainCount = l.trainCount === undefined ? 1 : l.trainCount;
        if (!isInt(trainCount) || trainCount < 1 || trainCount > 50) fail(`${w}: liczba pociągów musi być 1–50.`);

        const ids = Array.isArray(l.stationIds) ? l.stationIds : (fail(`${w}: „stationIds” musi być tablicą.`), []);
        for (const id of ids) if (!isInt(id) || !stationIds.has(id)) fail(`${w}: nieznana stacja ${String(id)}.`);

        const segments: PathPoint[][] = [];
        for (const seg of Array.isArray(l.segments) ? l.segments : []) {
            if (!Array.isArray(seg) || !seg.every(p => Array.isArray(p) && p.length === 2 && isInt(p[0]) && isInt(p[1]))) { fail(`${w}: nieprawidłowy odcinek trasy.`); continue; }
            points += seg.length;
            segments.push(seg as PathPoint[]);
        }
        lines.push({
            id: l.id, name: name.slice(0, 16), color: String(l.color), speed: l.speed as number, dwellSeconds: l.dwellSeconds as number,
            trainCount: trainCount as number, circular: l.circular === true, throughLoops: l.throughLoops === true, shuttle: l.shuttle === true,
            running: l.running === true, stationIds: ids.filter(isInt) as number[], segments
        });
    });
    if (points > MAX_POINTS) fail(`Za dużo punktów trasy (${points}, limit ${MAX_POINTS}).`);

    const noPos = stations.filter(s => s.x === null).length;
    if (noPos > 0) warnings.push(`${noPos} stacji nie ma platformy (brak pozycji), więc nie zostaną narysowane na mapie.`);
    const noRoute = lines.filter(l => l.segments.length === 0).length;
    if (noRoute > 0) warnings.push(`${noRoute} linii nie ma skompilowanej trasy; zostaną narysowane jako proste połączenia między stacjami.`);

    if (errors.length > 0) return { ok: false, errors, warnings, data: null };
    return {
        ok: true, errors, warnings,
        data: { schemaVersion: METRO_EXCHANGE_VERSION, kind: "metro-snapshot", source: typeof raw.source === "string" ? raw.source : "unknown", exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "", palette: METRO_PALETTE.map(p => ({ ...p })), stations, lines }
    };
}

export interface UpdatesContext {
    stationExists(id: number): boolean;
    lineExists(id: number): boolean;
}

/** Validates a portal export (for the game). Unknown ids are skipped with a warning — the portal cannot create
 *  lines or stations — while invalid values fail the whole document. */
export function parseMetroUpdates(raw: unknown, ctx: UpdatesContext): ParseResult<MetroUpdates> {
    const { errors, fail } = collector();
    const warnings: string[] = [];
    if (!checkHeader(raw, "metro-updates", fail)) return { ok: false, errors, warnings, data: null };

    const codes = new Set(METRO_PALETTE.map(p => p.code));
    const stations: StationUpdate[] = [];
    const lines: LineUpdate[] = [];
    let unknownStations = 0, unknownLines = 0;

    (Array.isArray(raw.stations) ? raw.stations : []).forEach((s: unknown, i: number) => {
        const w = `Stacja [${i}]`;
        if (!isObj(s) || !isInt(s.id)) { fail(`${w}: nieprawidłowe id.`); return; }
        const name = typeof s.name === "string" ? s.name.trim() : "";
        if (name.length === 0 || name.length > 64) { fail(`${w}: nazwa musi mieć 1–64 znaków.`); return; }
        if (!ctx.stationExists(s.id)) { unknownStations++; return; }
        stations.push({ id: s.id, name });
    });

    (Array.isArray(raw.lines) ? raw.lines : []).forEach((l: unknown, i: number) => {
        const w = `Linia [${i}]`;
        if (!isObj(l) || !isInt(l.id)) { fail(`${w}: nieprawidłowe id.`); return; }
        if (typeof l.color !== "string" || !codes.has(l.color)) fail(`${w}: nieznany kolor „${String(l.color)}”.`);
        if (!isInt(l.speed) || l.speed < 1 || l.speed > 200) fail(`${w}: prędkość musi być liczbą 1–200.`);
        if (!isInt(l.dwellSeconds) || l.dwellSeconds < 0 || l.dwellSeconds > 600) fail(`${w}: postój musi być liczbą 0–600 s.`);
        if (!isInt(l.trainCount) || l.trainCount < 1 || l.trainCount > 50) fail(`${w}: liczba pociągów musi być 1–50.`);
        const ids = Array.isArray(l.stationIds) ? l.stationIds : (fail(`${w}: „stationIds” musi być tablicą.`), []);
        for (const id of ids) if (!isInt(id) || !ctx.stationExists(id)) fail(`${w}: nieznana stacja ${String(id)}.`);
        if (typeof l.circular !== "boolean" || typeof l.throughLoops !== "boolean" || typeof l.shuttle !== "boolean") fail(`${w}: flagi circular/throughLoops/shuttle muszą być wartościami logicznymi.`);
        if (!ctx.lineExists(l.id)) { unknownLines++; return; }
        lines.push({
            id: l.id, color: String(l.color), speed: l.speed as number, dwellSeconds: l.dwellSeconds as number, trainCount: l.trainCount as number,
            circular: l.circular === true, throughLoops: l.throughLoops === true, shuttle: l.shuttle === true, stationIds: ids.filter(isInt) as number[]
        });
    });

    if (unknownStations > 0) warnings.push(`Pominięto ${unknownStations} stacji, których nie ma w tym świecie (portal nie tworzy stacji).`);
    if (unknownLines > 0) warnings.push(`Pominięto ${unknownLines} linii, których nie ma w tym świecie (portal nie tworzy linii).`);

    if (errors.length > 0) return { ok: false, errors, warnings, data: null };
    return { ok: true, errors, warnings, data: { schemaVersion: METRO_EXCHANGE_VERSION, kind: "metro-updates", source: typeof raw.source === "string" ? raw.source : "unknown", exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "", stations, lines } };
}
