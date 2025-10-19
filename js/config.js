export const SHEET_ID = '1swtElpz27sqLMNbATocFe9VHc1yZTSRxvHyikFL_R7U';

const gids = {
    PLOTS: '0',
    MERGED: '43897086',
    STREETS: '2101138806',
    LOCALS: '875214507',
    OWNERS: '92681717',
    TRANSACTIONS: '231383988',
    SETTINGS: '464636229',
    LOTTERY: '1580637376'
};

export const urls = Object.fromEntries(
    Object.entries(gids).map(([key, gid]) => [
        key.toLowerCase(), 
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`
    ])
);

export const MAP_IMAGE_URL = 'map.png';
export const MAP_WIDTH = 4296;
export const MAP_HEIGHT = 2360;
