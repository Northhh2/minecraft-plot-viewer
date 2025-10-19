export function getColorForType(type, alpha = 0.8) {
    switch (type) {
        case 'Parkowa': return `rgba(0, 170, 0, ${alpha})`;
        case 'Rolna': return `rgba(180, 104, 77, ${alpha})`;
        case 'Hotelowa': return `rgba(44, 186, 168, ${alpha})`;
        case 'Mieszkalna': return `rgba(222, 177, 45, ${alpha})`;
        case 'Sakralna': return `rgba(154, 92, 198, ${alpha})`;
        case 'Przemysłowo-biurowa': return `rgba(255, 85, 255, ${alpha})`;
        case 'Mieszkalno-usługowa': return `rgba(33, 73, 123, ${alpha})`;
        case 'Publiczna': return `rgba(255, 170, 0, ${alpha})`;
        case 'Medyczna': return `rgba(170, 0, 0, ${alpha})`;
        case 'Usługowa': return `rgba(17, 160, 54, ${alpha})`;
        default: return `rgba(128, 128, 128, ${alpha})`;
    }
}

export function parseDate(dateStr) {
    const parts = dateStr.split('.');
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

export function dateDiffInDays(a, b) {
    const _MS_PER_DAY = 1000 * 60 * 60 * 24;
    const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}
