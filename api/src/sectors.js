// Sector of a plot: the sector whose bounding box overlaps the plot's box the most (by area), or null when
// none overlaps. The portal is the only place that computes this; the game just stores the result.
// Both boxes are inclusive block rectangles, and corners may come in any order.

/** @param sectors rows/records with x1, z1, x2, z2 and id (snake or camel case does not matter, only these keys)
 *  @returns the sector id, or null */
export function assignSector(sectors, x1, z1, x2, z2) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
    let sectorId = null, best = 0;
    for (const s of sectors) {
        const w = Math.min(maxX, Math.max(s.x1, s.x2)) - Math.max(minX, Math.min(s.x1, s.x2)) + 1;
        const h = Math.min(maxZ, Math.max(s.z1, s.z2)) - Math.max(minZ, Math.min(s.z1, s.z2)) + 1;
        if (w > 0 && h > 0 && w * h > best) { best = w * h; sectorId = s.id; }
    }
    return sectorId;
}
