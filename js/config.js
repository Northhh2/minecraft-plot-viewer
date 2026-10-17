export const SHEET_ID = '1swtElpz27sqLMNbATocFe9VHc1yZTSRxvHyikFL_R7U';
const PLOTS_GID = '0';
const MERGED_GID = '43897086';
const STREETS_GID = '2101138806';
const LOCALS_GID = '875214507';
const OWNERS_GID = '92681717';
const TRANSACTIONS_GID = '231383988';
const SETTINGS_GID = '464636229';
const LOTTERY_GID = '1580637376';

export const urls = {
    plots: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${PLOTS_GID}`,
    merged: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${MERGED_GID}`,
    streets: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${STREETS_GID}`,
    locals: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${LOCALS_GID}`,
    owners: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${OWNERS_GID}`,
    transactions: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${TRANSACTIONS_GID}`,
    settings: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SETTINGS_GID}`,
    lottery: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${LOTTERY_GID}`
};

// Base URL of the Worker API (e.g. 'https://plot-portal-api.<account>.workers.dev').
// Empty string = legacy mode: read straight from the Google Sheet above.
export const API_BASE = globalThis.PLOT_API_BASE ?? 'https://plot-portal-api.northh.workers.dev';

export const MAP_IMAGE_URL = 'map.webp';
// Square city map drawn over the base map. Bounds are inclusive block coordinates:
// X -596..903, Z -719..780 (1500x1500 blocks).
export const CITY_MAP = { url: 'city_map.webp', x1: -596, z1: -719, x2: 903, z2: 780 };

export const MAP_WIDTH = 4296;
export const MAP_HEIGHT = 2360;

