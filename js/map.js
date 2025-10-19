import { state } from './state.js';
import { MAP_WIDTH, MAP_HEIGHT, MAP_IMAGE_URL } from './config.js';
import { openNewModal, showSimpleTooltip, hideTooltip, moveTooltip } from './ui.js';
import { getColorForType } from './utils.js';

let appData;
let dom;
const layers = {};

export function initializeMap(data) {
    appData = data;
    dom = {
        svg: document.getElementById('map-svg'),
        mapContainer: document.getElementById('map-container'),
        coordsDisplay: document.getElementById('coords-display'),
        tooltip: document.getElementById('tooltip'),
    };

    setupMapInteraction();
    setupMapControls();
}

export function drawMap() {
    if (!appData.allPlots.length) return;

    dom.svg.innerHTML = '';
    const mapImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    mapImage.setAttribute('href', MAP_IMAGE_URL);
    mapImage.setAttribute('x', -MAP_WIDTH / 2);
    mapImage.setAttribute('y', -MAP_HEIGHT / 2);
    mapImage.setAttribute('width', MAP_WIDTH);
    mapImage.setAttribute('height', MAP_HEIGHT);
    dom.svg.appendChild(mapImage);

    ['districts', 'merged', 'streets', 'plots'].forEach(layerId => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.id = `${layerId}-layer`;
        layers[layerId] = g;
        dom.svg.appendChild(g);
    });
    
    drawStreets();
    drawPlots();
    drawMergedPlots();
    drawDistrictBoundaries();
    
    calculateInitialViewBox();
}

function calculateInitialViewBox() {
    const padding = 100;
    const { allPlots } = appData;
    const minX = Math.min(...allPlots.map(p => p.x1));
    const maxX = Math.max(...allPlots.map(p => p.x2));
    const minZ = Math.min(...allPlots.map(p => p.z1));
    const maxZ = Math.max(...allPlots.map(p => p.z2));
    const mapContentWidth = maxX - minX + 2 * padding;
    const mapContentHeight = maxZ - minZ + 2 * padding;
    const clientRatio = dom.mapContainer.clientWidth / dom.mapContainer.clientHeight;
    let w, h;

    if (clientRatio > (mapContentWidth / mapContentHeight)) {
        h = mapContentHeight;
        w = h * clientRatio;
    } else {
        w = mapContentWidth;
        h = w / clientRatio;
    }

    state.initialViewBox.x = minX - (w - mapContentWidth + 2 * padding) / 2;
    state.initialViewBox.y = minZ - (h - mapContentHeight + 2 * padding) / 2;
    state.initialViewBox.w = w;
    state.initialViewBox.h = h;
    
    const mapRatio = MAP_WIDTH / MAP_HEIGHT;
    state.maxViewboxWidth = clientRatio > mapRatio ? MAP_HEIGHT * clientRatio : MAP_WIDTH;
    
    setViewBox(state.initialViewBox.x, state.initialViewBox.y, state.initialViewBox.w, state.initialViewBox.h);
}


function setViewBox(x, y, w, h) {
    const isMobile = window.innerWidth <= 768;
    const minZoom = isMobile ? 50 : 100;
    w = Math.max(minZoom, w);
    w = Math.min(w, state.maxViewboxWidth);
    if (state.initialViewBox.w) { h = (w / state.initialViewBox.w) * state.initialViewBox.h; }
    
    const minX_bound = -MAP_WIDTH / 2, minY_bound = -MAP_HEIGHT / 2;
    const maxX_bound = MAP_WIDTH / 2, maxY_bound = MAP_HEIGHT / 2;
    
    if (x < minX_bound) x = minX_bound;
    if (y < minY_bound) y = minY_bound;
    if (x + w > maxX_bound) x = maxX_bound - w;
    if (y + h > maxY_bound) y = maxY_bound - h;
    
    state.viewBox = { x, y, w, h };
    dom.svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    
    if ('ontouchstart' in window) {
        const centerX = Math.round(state.viewBox.x + state.viewBox.w / 2);
        const centerZ = Math.round(state.viewBox.y + state.viewBox.h / 2);
        dom.coordsDisplay.textContent = `X: ${centerX}, Z: ${centerZ}`;
    }
}

function drawStreets() {
    const streetsByName = new Map();
    appData.streets.forEach(segment => {
        if (!segment.name || segment.name.trim() === '') return;
        if (!streetsByName.has(segment.name)) {
            streetsByName.set(segment.name, []);
        }
        streetsByName.get(segment.name).push(segment);
    });

    streetsByName.forEach((segments, streetName) => {
        const streetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        streetGroup.dataset.streetName = streetName;

        segments.forEach(segment => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', segment.x1);
            rect.setAttribute('y', segment.z1);
            rect.setAttribute('width', segment.width);
            rect.setAttribute('height', segment.height);
            rect.setAttribute('class', 'street-rect');
            streetGroup.appendChild(rect);
        });

        const longestSegment = segments.reduce((a, b) => Math.max(a.width, a.height) > Math.max(b.width, b.height) ? a : b);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', longestSegment.x1 + longestSegment.width / 2);
        text.setAttribute('y', longestSegment.z1 + longestSegment.height / 2);
        text.setAttribute('class', `street-text ${longestSegment.height > longestSegment.width ? 'street-vertical' : ''}`);
        text.textContent = streetName;
        streetGroup.appendChild(text);

        streetGroup.addEventListener('click', (e) => {
            if (state.isDragging) return;
            e.stopPropagation();
            openNewModal({ type: 'street', data: streetName });
        });

        streetGroup.addEventListener('mouseenter', (e) => {
            dom.tooltip.innerHTML = `<div class="font-semibold">${streetName}</div>`;
            dom.tooltip.classList.remove('hidden');
            moveTooltip(e);
            streetGroup.querySelectorAll('.street-rect').forEach(r => {
                r.style.fillOpacity = '0.7';
                r.style.stroke = '#9ca3af';
            });
        });
        streetGroup.addEventListener('mouseleave', () => {
            hideTooltip();
            streetGroup.querySelectorAll('.street-rect').forEach(r => {
                r.style.fillOpacity = '';
                r.style.stroke = '';
            });
        });
        
        streetGroup.addEventListener('mousemove', moveTooltip);
        layers.streets.appendChild(streetGroup);
    });
}

function drawPlots() {
    appData.allPlots.forEach(plot => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.dataset.plotId = plot.id;
        g.dataset.plotName = plot.name;
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', plot.x1); rect.setAttribute('y', plot.z1);
        rect.setAttribute('width', plot.width); rect.setAttribute('height', plot.height);
        rect.setAttribute('class', 'plot-rect');
        
        const isOwned = plot.owner && plot.owner.trim() !== '' && plot.owner.toLowerCase().trim() !== 'skarb miasta';
        rect.style.fill = getColorForType(plot.type);
        rect.style.stroke = plot.status === 'pending' ? '#facc15' : (isOwned ? '#ef4444' : '#22c55e');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', plot.x1 + plot.width / 2);
        text.setAttribute('y', plot.z1 + plot.height / 2);
        text.setAttribute('class', 'plot-text');
        text.textContent = plot.id.padStart(3, '0');
        
        g.appendChild(rect);
        g.appendChild(text);

        g.addEventListener('mouseenter', (e) => { 
            showSimpleTooltip(e, plot); 
            if(state.modalHistory.length === 0 && plot.district) highlightDistrict(plot.district);
        });
        g.addEventListener('mouseleave', () => { 
            hideTooltip(); 
            if(state.modalHistory.length === 0) clearHighlight();
        });
        g.addEventListener('mousemove', moveTooltip);
        g.addEventListener('click', (e) => {
            if (state.isDragging) return;
            e.stopPropagation(); 
            openNewModal({type: 'plot', data: plot}); 
        });
        
        layers.plots.appendChild(g);
    });
}

function drawMergedPlots() {
    appData.mergedPlots.forEach((merged) => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', merged.x1); rect.setAttribute('y', merged.z1);
        rect.setAttribute('width', merged.width); rect.setAttribute('height', merged.height);
        rect.setAttribute('class', 'merged-plot');
        rect.addEventListener('click', (e) => {
            if (state.isDragging) return;
            e.stopPropagation(); 
            openNewModal({type: 'merged', data: merged}); 
        });
        layers.merged.appendChild(rect);
    });
}

function drawDistrictBoundaries() {
    const districts = {};
    appData.allPlots.forEach(plot => {
        if (plot.district) {
            if (!districts[plot.district]) districts[plot.district] = [];
            districts[plot.district].push(plot);
        }
    });
    Object.entries(districts).forEach(([districtName, districtPlots]) => {
        createDistrictClusters(districtPlots, 50).forEach((cluster) => {
            const boundary = createDistrictOutline(cluster);
            if (!boundary) return;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', boundary);
            path.style.cssText = "fill:none; stroke:#8b5cf6; stroke-width:2; stroke-dasharray:8,4; opacity:0.7; cursor:pointer; pointer-events:all;";
            path.addEventListener('click', (e) => { 
                if (state.isDragging) return;
                e.stopPropagation(); 
                openNewModal({type: 'district', data: {name: districtName, plots: cluster}}); 
            });
            layers.districts.appendChild(path);
        });
    });
}

function createDistrictClusters(plots, maxDistance) {
    const clusters = []; let visited = new Set();
    plots.forEach(plot => {
        if (!visited.has(plot.id)) {
            const newCluster = []; const queue = [plot];
            visited.add(plot.id);
            while (queue.length > 0) {
                const currentPlot = queue.shift();
                newCluster.push(currentPlot);
                plots.forEach(otherPlot => {
                    if (!visited.has(otherPlot.id) && (currentPlot.x1 <= otherPlot.x2 + maxDistance && currentPlot.x2 >= otherPlot.x1 - maxDistance &&
                        currentPlot.z1 <= otherPlot.z2 + maxDistance && currentPlot.z2 >= otherPlot.z1 - maxDistance)) {
                        visited.add(otherPlot.id);
                        queue.push(otherPlot);
                    }
                });
            }
            clusters.push(newCluster);
        }
    });
    return clusters;
}

function createDistrictOutline(plots) {
    if (plots.length === 0) return '';
    const minX = Math.min(...plots.map(p => p.x1));
    const maxX = Math.max(...plots.map(p => p.x2));
    const minZ = Math.min(...plots.map(p => p.z1));
    const maxZ = Math.max(...plots.map(p => p.z2));
    return `M ${minX} ${minZ} L ${maxX} ${minZ} L ${maxX} ${maxZ} L ${minX} ${maxZ} Z`;
}

function setupMapInteraction() {
    let touchPanning = false;
    let pinchZooming = false;
    let lastTouchDistance = 0;
    let startPoint = {x: 0, y: 0};
    let isPanning = false;

    dom.mapContainer.addEventListener('mousedown', (e) => { 
        if (e.button === 0) { 
            state.isDragging = false; 
            isPanning = true; 
            dom.mapContainer.classList.add('grabbing'); 
            startPoint = { x: e.x, y: e.y }; 
        } 
    });
    document.addEventListener('mouseup', () => { 
        isPanning = false; 
        dom.mapContainer.classList.remove('grabbing'); 
        setTimeout(() => { state.isDragging = false; }, 50);
    });
    dom.mapContainer.addEventListener('mousemove', (e) => {
        const pt = dom.svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
        if (!('ontouchstart' in window)) {
             dom.coordsDisplay.textContent = `X: ${Math.round(svgP.x)}, Z: ${Math.round(svgP.y)}`;
        }
        if (!isPanning) return;
        if(Math.abs(e.x - startPoint.x) > 5 || Math.abs(e.y - startPoint.y) > 5) {
            state.isDragging = true;
        }
        const dx = (startPoint.x - e.x) * (state.viewBox.w / dom.mapContainer.clientWidth);
        const dy = (startPoint.y - e.y) * (state.viewBox.h / dom.mapContainer.clientHeight);
        setViewBox(state.viewBox.x + dx, state.viewBox.y + dy, state.viewBox.w, state.viewBox.h);
        startPoint = { x: e.x, y: e.y };
    });
    dom.mapContainer.addEventListener('wheel', (e) => { e.preventDefault(); const dw = state.viewBox.w * -Math.sign(e.deltaY) * 0.1; const dx = dw * e.offsetX / dom.mapContainer.clientWidth; const dy = (dw / state.initialViewBox.w * state.initialViewBox.h) * e.offsetY / dom.mapContainer.clientHeight; setViewBox(state.viewBox.x + dx, state.viewBox.y + dy, state.viewBox.w - dw, state.viewBox.h - (dw / state.initialViewBox.w * state.initialViewBox.h)); }, { passive: false });
    dom.mapContainer.addEventListener('touchstart', (e) => {
        state.isDragging = false;
        if (e.touches.length === 1) {
            touchPanning = true;
            startPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length >= 2) {
            pinchZooming = true;
            touchPanning = false;
            lastTouchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        }
    }, { passive: true });
    dom.mapContainer.addEventListener('touchmove', (e) => {
        if(e.touches.length > 0 && startPoint.x && (Math.abs(e.touches[0].clientX - startPoint.x) > 5 || Math.abs(e.touches[0].clientY - startPoint.y) > 5)) {
            state.isDragging = true; 
        }
        if (touchPanning && e.touches.length === 1) {
            const dx = (startPoint.x - e.touches[0].clientX) * (state.viewBox.w / dom.mapContainer.clientWidth);
            const dy = (startPoint.y - e.touches[0].clientY) * (state.viewBox.h / dom.mapContainer.clientHeight);
            setViewBox(state.viewBox.x + dx, state.viewBox.y + dy, state.viewBox.w, state.viewBox.h);
            startPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (pinchZooming && e.touches.length >= 2) {
            const newDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const scale = lastTouchDistance / newDist;
            const w = state.viewBox.w * scale;
            const { left, top } = dom.mapContainer.getBoundingClientRect();
            const centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - left;
            const centerY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - top;
            const dx = (state.viewBox.w - w) * (centerX / dom.mapContainer.clientWidth);
            const dy = (state.viewBox.h - (w / state.initialViewBox.w * state.initialViewBox.h)) * (centerY / dom.mapContainer.clientHeight);
            setViewBox(state.viewBox.x + dx, state.viewBox.y + dy, w, state.viewBox.h * scale);
            lastTouchDistance = newDist;
        }
    }, { passive: true });
    dom.mapContainer.addEventListener('touchend', (e) => {
        touchPanning = false;
        pinchZooming = false;
        setTimeout(() => { state.isDragging = false; }, 50);
    });
}

function setupMapControls() {
    document.getElementById('zoom-in').addEventListener('click', () => { const dw = state.viewBox.w * -0.2; setViewBox(state.viewBox.x - dw / 2, state.viewBox.y - (dw / state.initialViewBox.w * state.initialViewBox.h) / 2, state.viewBox.w + dw, state.viewBox.h + (dw / state.initialViewBox.w * state.initialViewBox.h)); });
    document.getElementById('zoom-out').addEventListener('click', () => { const dw = state.viewBox.w * 0.2; setViewBox(state.viewBox.x - dw / 2, state.viewBox.y - (dw / state.initialViewBox.w * state.initialViewBox.h) / 2, state.viewBox.w + dw, state.viewBox.h + (dw / state.initialViewBox.w * state.initialViewBox.h)); });
    document.getElementById('reset-view').addEventListener('click', () => setViewBox(state.initialViewBox.x, state.initialViewBox.y, state.initialViewBox.w, state.initialViewBox.h));
    
    document.getElementById('toggle-plots').addEventListener('click', () => toggleLayer('plots'));
    document.getElementById('toggle-streets').addEventListener('click', () => toggleLayer('streets'));
    document.getElementById('toggle-districts').addEventListener('click', () => toggleLayer('districts'));
    document.getElementById('toggle-merged').addEventListener('click', () => toggleLayer('merged'));
}

function toggleLayer(layerId) {
    const layer = document.getElementById(`${layerId}-layer`);
    const button = document.getElementById(`toggle-${layerId}`);
    const isHidden = layer.classList.toggle('hidden');
    button.classList.toggle('active', !isHidden);
}

export function dimOtherPlots(plotsToShow = []) {
    dom.svg.querySelectorAll('.plot-rect.dimmed').forEach(rect => rect.classList.remove('dimmed'));
    if (plotsToShow.length === 0) return;
    const plotNamesToShow = new Set(plotsToShow.map(p => p.name));
    dom.svg.querySelectorAll('.plot-rect').forEach(rect => {
        const g = rect.parentElement;
        if (g && g.dataset && !plotNamesToShow.has(g.dataset.plotName)) {
            rect.classList.add('dimmed');
        }
    });
}

export function highlightDistrict(districtName) {
    dom.svg.querySelectorAll('.plot-rect').forEach(rect => {
        const g = rect.parentElement;
        const plot = appData.allPlots.find(p => p.name === g.dataset.plotName);
        if (plot && plot.district !== districtName) rect.classList.add('dimmed');
    });
}

export function clearHighlight() {
    dom.svg.querySelectorAll('.plot-rect.dimmed').forEach(rect => rect.classList.remove('dimmed'));
    dom.svg.querySelectorAll('.plot-rect.highlighted').forEach(rect => rect.classList.remove('highlighted'));
}

export function highlightPlots(plotIds) {
    clearHighlight();
    plotIds.forEach(id => {
        const plotElement = dom.svg.querySelector(`g[data-plot-id='${id}'] .plot-rect`);
        if (plotElement) plotElement.classList.add('highlighted');
    });
}

