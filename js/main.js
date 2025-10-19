import { urls } from './config.js';
import { fetchData, processData } from './api.js';
import { initializeMap, drawMap } from './map.js';
import { initializeUI } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    
    try {
        const rawData = await fetchData(urls);
        const appData = processData(rawData);
        
        initializeUI(appData);
        initializeMap(appData);
        
        drawMap(appData);
        
        loader.style.display = 'none';
    } catch (error) {
        console.error("Błąd podczas inicjalizacji aplikacji:", error);
        loader.innerHTML = `<div class="text-center"><p class="text-lg font-medium text-red-500">Błąd inicjalizacji</p><p class="text-sm text-gray-400">Sprawdź konsolę.</p></div>`;
    }
});
