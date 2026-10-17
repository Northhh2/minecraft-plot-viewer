// Builds the public snapshot (schema/gov-land.schema.json). Money fields are role-aware.

export const SCHEMA_VERSION = 1;

const owner = (kind, number) => (kind ? { kind, number } : null);

export const mapPlot = p => ({
    id: p.id, name: p.name, zoningTypeId: p.zoning_type_id,
    x1: p.x1, z1: p.z1, x2: p.x2, z2: p.z2,
    sideX: p.side_x, sideZ: p.side_z, area: p.area, value: p.value,
    sectorId: p.sector_id, districtId: p.district_id, streetId: p.street_id,
    buildingNumber: p.building_number,
    owner: owner(p.owner_kind, p.owner_number),
    mergedInto: p.merged_into, version: p.version
});

const isStaff = viewer => viewer?.role === 'clerk' || viewer?.role === 'admin';
const sameOwner = (kind, number, viewer) => !!viewer && kind === 'citizen' && number === viewer.number;

// Transaction value and cheque number are confidential: staff see all; a citizen sees a row when
// they are its new owner or the owner of the next transaction (i.e. the one they sold to).
function visibleOwnership(rows, viewer) {
    const byPlot = new Map();
    for (const o of rows) {
        if (!byPlot.has(o.plot_id)) byPlot.set(o.plot_id, []);
        byPlot.get(o.plot_id).push(o);
    }
    const out = [];
    for (const list of byPlot.values()) {
        list.forEach((o, i) => {
            const next = list[i + 1];
            const canSee = isStaff(viewer) || sameOwner(o.owner_kind, o.owner_number, viewer)
                || (next && sameOwner(next.owner_kind, next.owner_number, viewer));
            out.push({
                id: o.id, plotId: o.plot_id, newOwner: owner(o.owner_kind, o.owner_number),
                transactionValue: canSee ? o.transaction_value : null,
                transactionDay: o.transaction_day, transactionType: o.transaction_type,
                checkNumber: canSee ? o.check_number : null, paid: !!o.paid
            });
        });
    }
    return out;
}

async function all(db, sql) {
    const { results } = await db.prepare(sql).all();
    return results;
}

export async function buildSnapshot(db, viewer = null) {
    const [zoning, districts, sectors, streets, citizens, companies, plots, units, ownership, lottery, merges, settings] =
        await Promise.all([
            all(db, 'SELECT * FROM zoning_types ORDER BY id'),
            all(db, 'SELECT * FROM districts ORDER BY id'),
            all(db, 'SELECT * FROM sectors ORDER BY id'),
            all(db, 'SELECT * FROM streets ORDER BY id'),
            // PIN data and role-less private fields are never part of the public snapshot.
            all(db, 'SELECT number, identity_number, name, nio, age, profession, photo_url, role FROM citizens ORDER BY number'),
            all(db, 'SELECT * FROM companies ORDER BY number'),
            all(db, 'SELECT * FROM plots ORDER BY id'),
            all(db, 'SELECT * FROM units ORDER BY id'),
            all(db, 'SELECT * FROM ownership_history ORDER BY plot_id, transaction_day, id'),
            all(db, 'SELECT * FROM lottery ORDER BY id'),
            all(db, 'SELECT * FROM merges ORDER BY id'),
            all(db, 'SELECT * FROM settings')
        ]);

    return {
        schemaVersion: SCHEMA_VERSION,
        zoningTypes: zoning.map(z => ({ id: z.id, name: z.name, pricePer100Blocks: z.price_per_100_blocks })),
        districts: districts.map(d => ({ id: d.id, name: d.name })),
        sectors: sectors.map(s => ({ id: s.id, name: s.name, x1: s.x1, z1: s.z1, x2: s.x2, z2: s.z2 })),
        streets: streets.map(s => ({ id: s.id, name: s.name, x1: s.x1, z1: s.z1, x2: s.x2, z2: s.z2 })),
        citizens: citizens.map(c => ({
            number: c.number, identityNumber: c.identity_number, name: c.name, nio: c.nio,
            age: c.age, profession: c.profession, photoUrl: c.photo_url, role: c.role
        })),
        companies: companies.map(c => ({ number: c.number, name: c.name, legalForm: c.legal_form, photoUrl: c.photo_url })),
        plots: plots.map(mapPlot),
        units: units.map(u => ({
            id: u.id, plotId: u.plot_id, unitNumber: u.unit_number, stairwell: u.stairwell, floor: u.floor,
            area: u.area, bedCount: u.bed_count, workplaceCount: u.workplace_count,
            tenant: owner(u.tenant_kind, u.tenant_number), tenantLabel: u.tenant_label
        })),
        ownershipHistory: visibleOwnership(ownership, viewer),
        lottery: lottery.map(l => ({
            id: l.id, plotId: l.plot_id, winner: owner(l.winner_kind, l.winner_number),
            amount: isStaff(viewer) ? l.amount : null, checkNumber: isStaff(viewer) ? l.check_number : null,
            paid: !!l.paid
        })),
        merges: merges.map(m => ({ id: m.id, mainPlotId: m.main_plot_id, mergingPlotId: m.merging_plot_id })),
        settings: Object.fromEntries(settings.map(s => [s.key, !!s.value]))
    };
}

