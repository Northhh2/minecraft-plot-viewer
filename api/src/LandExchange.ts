/**
 * Land exchange format v1 — the JSON shared by GovernmentBP and the plot portal.
 *
 * Pure TypeScript with no Minecraft imports so it can be unit-tested in plain Node. LandSync.ts does
 * the registry I/O around it. The portal side lives in its repo (api/src/exchange.js, schema/gov-land.schema.json).
 *
 * Conventions (same as the land registries): ids are preserved across systems; coordinates are inclusive
 * X/Z block corners; money (plot value, transaction value, lottery amount) is a number; transaction days are
 * raw `world.getDay()`; an owner is `{ kind, number }` where a citizen's number is their identity number
 * (nb_identity) and a company's number is its CompanyIdentity number; `null` means City Treasury.
 */

export const EXCHANGE_VERSION = 1;

export type OwnerKind = "citizen" | "company";
export interface OwnerRef { kind: OwnerKind; number: number }
export type TransactionType = "donation" | "sale";

export interface XZRect { x1: number; z1: number; x2: number; z2: number }
export interface ZoningTypeRec { id: number; name: string; pricePer100Blocks: number }
export interface NamedRec { id: number; name: string }
export interface SectorRec extends XZRect { id: number; name: string }
export interface StreetRec extends XZRect { id: number; name: string }
export interface PlotRec extends XZRect {
    id: number; name: string; zoningTypeId: number | null;
    sideX: number; sideZ: number; area: number; value: number;
    sectorId: number | null; districtId: number | null; streetId: number | null;
    buildingNumber: string | null; owner: OwnerRef | null; mergedInto: number | null;
}
export interface UnitRec extends XZRect {
    id: number; plotId: number; unitNumber: string; stairwell: string; floor: number;
    sideX: number; sideZ: number; area: number; bedCount: number; workplaceCount: number; tenant: OwnerRef | null;
}
export interface OwnershipRec {
    id: number; plotId: number; newOwner: OwnerRef | null; transactionValue: number; transactionDay: number;
    transactionType: TransactionType; checkNumber: string | null; paid: boolean;
}
export interface LotteryRec { id: number; plotId: number; winner: OwnerRef | null; amount: number; checkNumber: string | null; paid: boolean }
export interface MergeRec {
    id: number; mainPlotId: number; mergingPlotId: number;
    originalCombinedArea: number; combinedAreaAfter: number; areaDifference: number; fee: number; day: number;
}

/** Informational identity records so the other side can create/link owners. Never carries PINs. */
export interface CitizenInfo { identityNumber: number; name: string; photoUrl?: string | null; profession?: string | null }
export interface CompanyInfo { number: number; name: string; legalForm?: string | null }

export interface ExchangeDoc {
    schemaVersion: number;
    source: string;
    exportedAt: string;
    zoningTypes?: ZoningTypeRec[];
    districts?: NamedRec[];
    sectors?: SectorRec[];
    streets?: StreetRec[];
    plots?: PlotRec[];
    units?: UnitRec[];
    ownershipHistory?: OwnershipRec[];
    lottery?: LotteryRec[];
    merges?: MergeRec[];
    settings?: { plot_lottery_enabled?: boolean };
    citizens?: CitizenInfo[];
    companies?: CompanyInfo[];
}

// ─── export ──────────────────────────────────────────────────────────────────────

export interface ExportInput {
    zoningTypes: ZoningTypeRec[]; districts: NamedRec[]; sectors: SectorRec[]; streets: StreetRec[];
    plots: PlotRec[]; units: UnitRec[]; ownershipHistory: OwnershipRec[]; lottery: LotteryRec[]; merges: MergeRec[];
    plotLotteryEnabled: boolean;
}
export interface ExportResolvers {
    citizen(identityNumber: number): CitizenInfo;
    company(number: number): CompanyInfo;
}

export function buildExchangeDoc(input: ExportInput, resolvers: ExportResolvers, exportedAt: string): ExchangeDoc {
    const citizens = new Map<number, CitizenInfo>();
    const companies = new Map<number, CompanyInfo>();
    const note = (ref: OwnerRef | null) => {
        if (!ref) return;
        if (ref.kind === "citizen" && !citizens.has(ref.number)) citizens.set(ref.number, resolvers.citizen(ref.number));
        if (ref.kind === "company" && !companies.has(ref.number)) companies.set(ref.number, resolvers.company(ref.number));
    };
    input.plots.forEach(p => note(p.owner));
    input.units.forEach(u => note(u.tenant));
    input.ownershipHistory.forEach(o => note(o.newOwner));
    input.lottery.forEach(l => note(l.winner));

    return {
        schemaVersion: EXCHANGE_VERSION,
        source: "GovernmentBP",
        exportedAt,
        zoningTypes: input.zoningTypes, districts: input.districts, sectors: input.sectors, streets: input.streets,
        plots: input.plots, units: input.units, ownershipHistory: input.ownershipHistory,
        lottery: input.lottery, merges: input.merges,
        settings: { plot_lottery_enabled: input.plotLotteryEnabled },
        citizens: [...citizens.values()], companies: [...companies.values()]
    };
}

const LOG_TAG = "[gov_land_export]";

/** Splits a JSON string into tagged log lines (`[gov_land_export] <id> <i>/<n> <chunk>`) because a
 *  single content-log line is too long to copy reliably. tools/log-to-json.mjs reassembles them.
 *  JSON.stringify output only contains spaces inside strings, so they are written as the escape `\u0020`:
 *  a log viewer that trims whitespace at the end of a line can then never corrupt a chunk boundary. */
export function chunkForLog(json: string, exportId: string, chunkSize = 1200): string[] {
    const safe = json.replace(/ /g, "\\u0020");
    const parts: string[] = [];
    for (let i = 0; i < safe.length; i += chunkSize) parts.push(safe.slice(i, i + chunkSize));
    if (parts.length === 0) parts.push("");
    return parts.map((p, i) => `${LOG_TAG} ${exportId} ${i + 1}/${parts.length} ${p}`);
}

// ─── import ──────────────────────────────────────────────────────────────────────

export interface ImportContext {
    citizenExists(identityNumber: number): boolean;
    companyExists(number: number): boolean;
    /** The game needs complete records, so by default records it cannot represent are skipped with a
     *  warning (units without geometry, transfers to the Treasury, lottery entries without a winner,
     *  merges without surveyed areas). The portal sets this to keep them (missing numbers become 0). */
    lenient?: boolean;
}

export interface ParsedImport {
    zoningTypes?: ZoningTypeRec[]; districts?: NamedRec[]; sectors?: SectorRec[]; streets?: StreetRec[];
    plots?: PlotRec[]; units?: UnitRec[]; ownershipHistory?: OwnershipRec[]; lottery?: LotteryRec[]; merges?: MergeRec[];
    plotLotteryEnabled?: boolean;
}

export interface ImportReport {
    ok: boolean;
    errors: string[];
    warnings: string[];
    counts: Record<string, number>;
    data: ParsedImport;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Integer from a number or a numeric string (the portal stores money as text); undefined if not one. */
function toInt(v: unknown): number | undefined {
    if (typeof v === "number") return Number.isInteger(v) ? v : undefined;
    if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
    return undefined;
}
const nullableStr = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));

function geometry(x1: number, z1: number, x2: number, z2: number) {
    const sideX = Math.abs(x2 - x1) + 1, sideZ = Math.abs(z2 - z1) + 1;
    return { sideX, sideZ, area: sideX * sideZ };
}

export function parseImport(raw: unknown, ctx: ImportContext): ImportReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    const data: ParsedImport = {};
    const counts: Record<string, number> = {};
    const report = (): ImportReport => ({ ok: errors.length === 0, errors, warnings, counts, data });

    if (!isObj(raw)) { errors.push("Dokument nie jest obiektem JSON."); return report(); }
    if (raw.schemaVersion !== EXCHANGE_VERSION) {
        errors.push(`Nieobsługiwana wersja schematu: ${String(raw.schemaVersion)} (oczekiwano ${EXCHANGE_VERSION}).`);
        return report();
    }

    const fail = (msg: string) => { if (errors.length < 50) errors.push(msg); else if (errors.length === 50) errors.push("…kolejne błędy pominięto."); };

    const list = (key: string): Record<string, unknown>[] | undefined => {
        const v = raw[key];
        if (v === undefined) return undefined;
        if (!Array.isArray(v) || !v.every(isObj)) { fail(`„${key}” musi być tablicą obiektów.`); return undefined; }
        return v as Record<string, unknown>[];
    };
    const id = (rec: Record<string, unknown>, where: string): number => {
        const n = toInt(rec.id);
        if (n === undefined || n < 1) { fail(`${where}: nieprawidłowe id.`); return 0; }
        return n;
    };
    const num = (v: unknown, where: string, field: string, min = Number.MIN_SAFE_INTEGER): number => {
        const n = toInt(v);
        if (n === undefined || n < min) { fail(`${where}: nieprawidłowe pole ${field}.`); return 0; }
        return n;
    };
    const uniqueIds = <T extends { id: number }>(items: T[], label: string): T[] => {
        const seen = new Set<number>();
        for (const it of items) { if (seen.has(it.id)) fail(`${label}: zduplikowane id ${it.id}.`); seen.add(it.id); }
        return items;
    };
    const unresolvedOwners = new Set<string>();
    const owner = (v: unknown, where: string): OwnerRef | null => {
        if (v === null || v === undefined) return null;
        if (!isObj(v) || (v.kind !== "citizen" && v.kind !== "company") || toInt(v.number) === undefined) {
            fail(`${where}: nieprawidłowy właściciel.`);
            return null;
        }
        const ref: OwnerRef = { kind: v.kind, number: toInt(v.number) as number };
        const exists = ref.kind === "citizen" ? ctx.citizenExists(ref.number) : ctx.companyExists(ref.number);
        if (!exists) unresolvedOwners.add(`${ref.kind === "citizen" ? "obywatel" : "firma"} #${ref.number}`);
        return ref;
    };

    // Lookups
    const zoning = list("zoningTypes");
    if (zoning) {
        data.zoningTypes = uniqueIds(zoning.map((r, i) => ({
            id: id(r, `Typ strefy [${i}]`), name: String(r.name ?? "").trim(),
            pricePer100Blocks: num(r.pricePer100Blocks, `Typ strefy [${i}]`, "pricePer100Blocks", 0)
        })), "Typy stref");
    }
    const districts = list("districts");
    if (districts) data.districts = uniqueIds(districts.map((r, i) => ({ id: id(r, `Dzielnica [${i}]`), name: String(r.name ?? "").trim() })), "Dzielnice");
    const sectors = list("sectors");
    if (sectors) {
        data.sectors = uniqueIds(sectors.map((r, i) => ({
            id: id(r, `Sektor [${i}]`), name: String(r.name ?? "").trim(),
            x1: num(r.x1, `Sektor [${i}]`, "x1"), z1: num(r.z1, `Sektor [${i}]`, "z1"), x2: num(r.x2, `Sektor [${i}]`, "x2"), z2: num(r.z2, `Sektor [${i}]`, "z2")
        })), "Sektory");
    }
    const streets = list("streets");
    if (streets) {
        data.streets = uniqueIds(streets.map((r, i) => ({
            id: id(r, `Ulica [${i}]`), name: String(r.name ?? "").trim().slice(0, 64),
            x1: num(r.x1, `Ulica [${i}]`, "x1"), z1: num(r.z1, `Ulica [${i}]`, "z1"), x2: num(r.x2, `Ulica [${i}]`, "x2"), z2: num(r.z2, `Ulica [${i}]`, "z2")
        })), "Ulice");
    }
    for (const [label, items] of [["Typy stref", data.zoningTypes], ["Dzielnice", data.districts], ["Sektory", data.sectors], ["Ulice", data.streets]] as const) {
        (items as { id: number; name: string }[] | undefined)?.forEach(it => { if (it.name.length === 0) fail(`${label}: pusta nazwa (id ${it.id}).`); });
    }

    // Plots
    const plots = list("plots");
    if (plots) {
        for (const dep of ["zoningTypes", "districts", "streets", "sectors"] as const) {
            if (!data[dep]) fail(`„plots” wymaga także „${dep}” w tym samym dokumencie.`);
        }
        data.plots = uniqueIds(plots.map((r, i) => {
            const w = `Działka [${i}]`;
            const x1 = num(r.x1, w, "x1"), z1 = num(r.z1, w, "z1"), x2 = num(r.x2, w, "x2"), z2 = num(r.z2, w, "z2");
            const name = String(r.name ?? "").trim();
            if (name.length === 0) fail(`${w}: brak nazwy.`);
            if (name.length > 32) { warnings.push(`${w} „${name}”: nazwa skrócona do 32 znaków.`); }
            const fk = (v: unknown, field: string, set?: { id: number }[]): number | null => {
                if (v === null || v === undefined) return null;
                const n = toInt(v);
                if (n === undefined || (set && !set.some(s => s.id === n))) { fail(`${w}: nieznane ${field} ${String(v)}.`); return null; }
                return n;
            };
            return {
                id: id(r, w), name: name.slice(0, 32),
                zoningTypeId: fk(r.zoningTypeId, "zoningTypeId", data.zoningTypes),
                x1, z1, x2, z2, ...geometry(x1, z1, x2, z2),
                value: num(r.value, w, "value", 0),
                sectorId: fk(r.sectorId, "sectorId", data.sectors),
                districtId: fk(r.districtId, "districtId", data.districts),
                streetId: fk(r.streetId, "streetId", data.streets),
                buildingNumber: nullableStr(r.buildingNumber),
                owner: owner(r.owner, w),
                mergedInto: r.mergedInto === null || r.mergedInto === undefined ? null : (toInt(r.mergedInto) ?? 0)
            };
        }), "Działki");
        const names = new Set<string>();
        for (const p of data.plots) {
            const key = p.name.toLowerCase();
            if (names.has(key)) fail(`Działki: zduplikowana nazwa „${p.name}”.`);
            names.add(key);
        }
        const ids = new Set(data.plots.map(p => p.id));
        for (const p of data.plots) if (p.mergedInto !== null && !ids.has(p.mergedInto)) fail(`Działka „${p.name}”: mergedInto wskazuje nieistniejącą działkę.`);
    }

    // Everything that hangs off plots needs them in the same document.
    const plotIds = new Set((data.plots ?? []).map(p => p.id));
    const needsPlots = (key: string) => { if (raw[key] !== undefined && !data.plots) fail(`„${key}” wymaga także „plots” w tym samym dokumencie.`); };
    const plotRef = (v: unknown, where: string): number => {
        const n = toInt(v);
        if (n === undefined || !plotIds.has(n)) { fail(`${where}: nieznana działka ${String(v)}.`); return 0; }
        return n;
    };

    needsPlots("units");
    const units = data.plots ? list("units") : undefined;
    if (units) {
        const kept: UnitRec[] = [];
        let skipped = 0;
        units.forEach((r, i) => {
            const w = `Lokal [${i}]`;
            const rect = [r.x1, r.z1, r.x2, r.z2].map(toInt);
            const hasRect = !rect.some(v => v === undefined);
            if (!hasRect && !ctx.lenient) { skipped++; return; }   // portal export carries no unit geometry
            const [x1, z1, x2, z2] = hasRect ? rect as number[] : [0, 0, 0, 0];
            kept.push({
                id: id(r, w), plotId: plotRef(r.plotId, w), unitNumber: String(r.unitNumber ?? ""), stairwell: String(r.stairwell ?? ""),
                floor: num(r.floor ?? 0, w, "floor"), x1, z1, x2, z2,
                ...(hasRect ? geometry(x1, z1, x2, z2) : { sideX: 0, sideZ: 0, area: toInt(r.area) ?? 0 }),
                bedCount: num(r.bedCount ?? 0, w, "bedCount", 0), workplaceCount: num(r.workplaceCount ?? 0, w, "workplaceCount", 0),
                tenant: owner(r.tenant, w)
            });
        });
        if (skipped > 0) warnings.push(`Pominięto ${skipped} lokali bez współrzędnych (portal ich nie przechowuje); lokale w grze pozostają bez zmian.`);
        if (skipped > 0 && skipped === units.length) delete data.units;
        else data.units = uniqueIds(kept, "Lokale");
    }

    needsPlots("ownershipHistory");
    const ownership = data.plots ? list("ownershipHistory") : undefined;
    if (ownership) {
        const kept: OwnershipRec[] = [];
        let skipped = 0;
        ownership.forEach((r, i) => {
            const w = `Zmiana własności [${i}]`;
            if ((r.newOwner === null || r.newOwner === undefined) && !ctx.lenient) { skipped++; return; }   // GovBP cannot record a transfer to the Treasury
            kept.push({
                id: id(r, w), plotId: plotRef(r.plotId, w), newOwner: owner(r.newOwner, w),
                transactionValue: num(r.transactionValue ?? 0, w, "transactionValue", 0), transactionDay: num(r.transactionDay, w, "transactionDay", 0),
                transactionType: r.transactionType === "donation" ? "donation" : "sale",
                checkNumber: nullableStr(r.checkNumber), paid: r.paid === true
            });
        });
        if (skipped > 0) warnings.push(`Pominięto ${skipped} zmian własności bez nowego właściciela (przekazanie do Skarbu Miasta).`);
        data.ownershipHistory = uniqueIds(kept, "Zmiany własności");
    }

    needsPlots("lottery");
    const lottery = data.plots ? list("lottery") : undefined;
    if (lottery) {
        const kept: LotteryRec[] = [];
        let skipped = 0;
        lottery.forEach((r, i) => {
            const w = `Loteria [${i}]`;
            if ((r.winner === null || r.winner === undefined) && !ctx.lenient) { skipped++; return; }
            kept.push({
                id: id(r, w), plotId: plotRef(r.plotId, w), winner: owner(r.winner, w),
                amount: num(r.amount ?? 0, w, "amount", 0), checkNumber: nullableStr(r.checkNumber), paid: r.paid === true
            });
        });
        if (skipped > 0) warnings.push(`Pominięto ${skipped} wpisów loterii bez zwycięzcy.`);
        data.lottery = uniqueIds(kept, "Loteria");
    }

    needsPlots("merges");
    const merges = data.plots ? list("merges") : undefined;
    if (merges) {
        const kept: MergeRec[] = [];
        let skipped = 0;
        merges.forEach((r, i) => {
            const w = `Scalenie [${i}]`;
            const parsed = [r.originalCombinedArea, r.combinedAreaAfter, r.areaDifference, r.fee, r.day].map(toInt);
            const complete = !parsed.some(v => v === undefined);
            if (!complete && !ctx.lenient) { skipped++; return; }   // portal knows only which plots were merged, not the surveyed areas
            const [originalCombinedArea, combinedAreaAfter, areaDifference, fee, day] = complete ? parsed as number[] : [0, 0, 0, 0, 0];
            kept.push({ id: id(r, w), mainPlotId: plotRef(r.mainPlotId, w), mergingPlotId: plotRef(r.mergingPlotId, w), originalCombinedArea, combinedAreaAfter, areaDifference, fee, day });
        });
        if (skipped > 0) warnings.push(`Pominięto ${skipped} scaleń bez pełnych danych o powierzchniach; historia scaleń w grze pozostaje bez zmian.`);
        if (skipped > 0 && skipped === merges.length) delete data.merges;
        else data.merges = uniqueIds(kept, "Scalenia");
    }

    if (isObj(raw.settings) && typeof raw.settings.plot_lottery_enabled === "boolean") data.plotLotteryEnabled = raw.settings.plot_lottery_enabled;

    if (unresolvedOwners.size > 0) {
        const sample = [...unresolvedOwners].slice(0, 10).join(", ");
        fail(`Właściciele nieznani w tym świecie (${unresolvedOwners.size}): ${sample}${unresolvedOwners.size > 10 ? ", …" : ""}.`);
    }

    for (const [key, items] of Object.entries(data)) if (Array.isArray(items)) counts[key] = items.length;
    return report();
}
