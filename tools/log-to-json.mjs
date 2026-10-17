// Rebuilds an export from the Minecraft content log: GovernmentBP land data or TransportationBP metro data.
//
//   In game (operator):   /scriptevent nb:land_export     (GovernmentBP, land)
//                         /scriptevent nb:metro_export    (TransportationBP, metro)
//   Then:                 node log-to-json.mjs <content-log-file> [out.json] [--id <exportId>]
//
// The game writes the export as numbered lines:  [gov_land_export] or [trn_metro_export]  <id> <i>/<n> <chunk>
// The newest complete export in the file is used unless --id is given. The output is the document
// the portal's admin "Import JSON" / "Import metra" accepts. Lines may carry a timestamp prefix; repeats are ignored.
import fs from 'node:fs';

const args = process.argv.slice(2);
const idFlag = args.indexOf('--id');
const wantedId = idFlag >= 0 ? args.splice(idFlag, 2)[1] : null;
const [input, output = 'land-export.json'] = args;

if (!input) {
    console.error('Usage: node log-to-json.mjs <content-log-file> [out.json] [--id <exportId>]');
    process.exit(2);
}

const LINE = /\[(?:gov_land|trn_metro)_export\] (\S+) (\d+)\/(\d+) ?(.*?)\r?$/;
const exports = new Map(); // id -> { total, parts: Map(i -> chunk), lastLine }

fs.readFileSync(input, 'utf8').split('\n').forEach((line, lineNo) => {
    const m = LINE.exec(line);
    if (!m) return;
    const [, id, i, n, chunk] = m;
    if (!exports.has(id)) exports.set(id, { total: Number(n), parts: new Map(), lastLine: 0 });
    const ex = exports.get(id);
    ex.parts.set(Number(i), chunk);
    ex.lastLine = lineNo;
});

if (exports.size === 0) {
    console.error('No [gov_land_export] / [trn_metro_export] lines found. Did you run /scriptevent nb:land_export or nb:metro_export and enable the content log?');
    process.exit(1);
}

const complete = [...exports].filter(([, ex]) => ex.parts.size === ex.total && [...Array(ex.total).keys()].every(k => ex.parts.has(k + 1)));
let chosen;
if (wantedId) {
    chosen = complete.find(([id]) => id === wantedId);
    if (!chosen) { console.error(`Export ${wantedId} not found or incomplete. Complete exports: ${complete.map(([id]) => id).join(', ') || 'none'}`); process.exit(1); }
} else {
    chosen = complete.sort((a, b) => b[1].lastLine - a[1].lastLine)[0];
    if (!chosen) {
        for (const [id, ex] of exports) console.error(`Export ${id}: ${ex.parts.size}/${ex.total} chunks present`);
        console.error('No complete export in the log (a chunk is missing — the log may have been truncated).');
        process.exit(1);
    }
}

const [id, ex] = chosen;
const json = [...Array(ex.total).keys()].map(k => ex.parts.get(k + 1)).join('');
let doc;
try {
    doc = JSON.parse(json);   // also decodes the \u0020 escapes the game uses for spaces
} catch (err) {
    console.error(`Export ${id} is complete but is not valid JSON: ${err.message}`);
    process.exit(1);
}

fs.writeFileSync(output, JSON.stringify(doc, null, 2) + '\n');
console.log(`Export ${id}: ${ex.total} chunk(s) -> ${output}`);
console.log(doc.kind === 'metro-snapshot'
    ? `stations=${doc.stations?.length ?? 0} lines=${doc.lines?.length ?? 0}`
    : `plots=${doc.plots?.length ?? 0} streets=${doc.streets?.length ?? 0} units=${doc.units?.length ?? 0} ownership=${doc.ownershipHistory?.length ?? 0}`);
