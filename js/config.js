// Base URL of the Worker API (e.g. 'https://plot-portal-api.<account>.workers.dev').
export const API_BASE = globalThis.PLOT_API_BASE ?? 'https://plot-portal-api.northh.workers.dev';

export const MAP_IMAGE_URL = 'map.webp';
// Square city map drawn over the base map. Bounds are inclusive block coordinates:
// X -596..903, Z -719..780 (1500x1500 blocks).
export const CITY_MAP = { url: 'city_map.webp', x1: -596, z1: -719, x2: 903, z2: 780 };

export const MAP_WIDTH = 4296;
export const MAP_HEIGHT = 2360;

