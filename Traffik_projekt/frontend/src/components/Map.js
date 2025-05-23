// frontend/src/components/map.js
// Se till att denna fil finns och innehåller din `useTrafficMap`-funktion.
// En liten justering föreslås:
// I renderMarkersOnMap, se till att du använder countyNumberToName som skickas med som argument
// istället för att förlita dig på en closure om den definieras utanför.

export function useTrafficMap(apiUrl, countyListSource, initialCountyNumberToName) {
    let mapInstance = null;
    let markerClusterGroup = null;
    const TRAFIKVERKET_ICON_BASE_URL = "https://api.trafikinfo.trafikverket.se/v2/icons/";

    // ... (resten av din defaultIcon, defaultTrafficSafetyCameraIcon, roadworkTypeValues, simpleStringHash)
     const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    const defaultTrafficSafetyCameraIcon = L.icon({ // Används om ingen IconId finns för kameror
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-red.png', // Exempel: röd ikon
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    const roadworkTypeValues = ['Roadwork', 'MaintenanceWorks', 'ConstructionWork', 'RoadResurfacing'];

    function simpleStringHash(str) {
        let hash = 0;
        if (!str || str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; 
        }
        return Math.abs(hash);
    }


    const initMap = (mapElementId) => {
        // ... (din initMap-logik)
         console.log("Initializing Leaflet map...");
         if (!mapInstance && document.getElementById(mapElementId)) {
             mapInstance = L.map(mapElementId).setView([62.0, 15.0], 5); // Startvy
             L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                 maxZoom: 19,
                 attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
             }).addTo(mapInstance);
             markerClusterGroup = L.markerClusterGroup({
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
             });
             mapInstance.addLayer(markerClusterGroup);
             console.log("Map initialized with MarkerClusterGroup.");
         } else if (mapInstance) { console.log("Map already initialized."); }
         else { console.error(`Map element with ID '${mapElementId}' not found.`); }
    };

    const parseWktPoint = (wktString, objectIdForLog = 'UnknownPoint') => {
        // ... (din parseWktPoint-logik)
         if (!wktString || typeof wktString !== 'string') { return null; }
         const match = wktString.match(/POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/i);
         if (match && match[1] && match[2]) {
             try {
                 const lon = parseFloat(match[1]);
                 const lat = parseFloat(match[2]);
                 if (isNaN(lon) || isNaN(lat) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                     console.warn(`[parseWktPoint] Invalid coordinates for ${objectIdForLog}: Lat ${lat}, Lon ${lon}. WKT: ${wktString}`);
                     return null;
                 }
                 return [lat, lon]; // Leaflet använder [lat, lon]
             } catch (e) {
                 console.error(`[parseWktPoint] Could not parse coordinates for ${objectIdForLog}: ${wktString}`, e);
                 return null;
             }
         } else {
             if (wktString.trim() && !wktString.toUpperCase().startsWith("POINT")) { 
                console.warn(`[parseWktPoint] WKT string format not recognized for ${objectIdForLog}: ${wktString}`);
             }
             return null;
         }
    };

    const parseWktLineString = (wktString, objectIdForLog = 'UnknownLine') => {
        // ... (din parseWktLineString-logik)
        if (!wktString || typeof wktString !== 'string') { return null; }
        const match = wktString.match(/LINESTRING\s*\((.*)\)/i);
        if (match && match[1]) {
            const coordPairsStr = match[1].split(',');
            const coordinates = [];
            for (const pairStr of coordPairsStr) {
                const coords = pairStr.trim().split(/\s+/); 
                if (coords.length === 2) {
                    try {
                        const lon = parseFloat(coords[0]);
                        const lat = parseFloat(coords[1]);
                        if (isNaN(lon) || isNaN(lat) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                            console.warn(`[parseWktLineString] Invalid coordinate pair in LINESTRING for ${objectIdForLog}: Lon ${lon}, Lat ${lat}. Original pair: "${pairStr}"`);
                            continue; 
                        }
                        coordinates.push([lat, lon]); 
                    } catch (e) {
                        console.error(`[parseWktLineString] Could not parse coordinate pair "${pairStr}" in LINESTRING for ${objectIdForLog}`, e);
                        return null; 
                    }
                } else {
                    console.warn(`[parseWktLineString] Malformed coordinate pair "${pairStr}" in LINESTRING for ${objectIdForLog}`);
                    return null; 
                }
            }
            return coordinates.length > 0 ? coordinates : null;
        } else {
            if (wktString.trim() && !wktString.toUpperCase().startsWith("LINESTRING")) {
                console.warn(`[parseWktLineString] WKT string format not recognized for ${objectIdForLog}: ${wktString}`);
            }
            return null;
        }
    };

    const fetchTrafficDataFromServer = async (selectedCountyValue) => {
        // ... (din fetchTrafficDataFromServer-logik)
        const logPrefix = `[FetchData][County: ${selectedCountyValue || 'All'}]`;
        let url = apiUrl; 
        const params = new URLSearchParams();
        if (selectedCountyValue) { 
            params.append('county', selectedCountyValue); 
        }
        // Hämta alltid alla dessa typer, filtrering sker på klienten eller vid rendering
        params.append('messageTypeValue', 'Accident,Roadwork,MaintenanceWorks,ConstructionWork,RoadResurfacing,TrafficSafetyCamera'); 
        
        const queryString = params.toString();
        if (queryString) { 
            url += (apiUrl.includes('?') ? '&' : '?') + queryString; 
        }
        
        console.log(`${logPrefix} Fetching from URL: ${url}`);
        try {
            const response = await fetch(url);
            if (!response.ok) { 
                const errorText = await response.text();
                console.error(`${logPrefix} HTTP error! status: ${response.status}`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`); 
            }
            const backendResponse = await response.json();
            return { success: true, data: backendResponse, message: "Data hämtad." };
        } catch (error) {
            console.error(`${logPrefix} Error fetching traffic info:`, error);
            return { success: false, data: null, message: "Kunde inte hämta trafikinformation från servern." };
        }
    };

    // Modifierad för att ta emot countyNumberToName
    const renderMarkersOnMap = (backendData, showAccidents, showRoadworks, showCameras, currentCountyNumberToName) => {
        // ... (din renderMarkersOnMap-logik, se till att använda currentCountyNumberToName)
        const logPrefix = `[RenderMarkers]`;
        if (!mapInstance || !markerClusterGroup || !backendData) {
            console.warn(`${logPrefix} Prerequisites not met for rendering.`);
            return { success: false, message: "Kunde inte rendera markörer (kartan inte redo)." };
        }

        markerClusterGroup.clearLayers();
        
        let markersAdded = 0;
        let accidentMarkersOnMap = 0, roadworkMarkersOnMap = 0, safetyCameraMarkersOnMap = 0;
        let impreciseAccidentMarkersOnMap = 0, impreciseRoadworkMarkersOnMap = 0;
        let totalDeviationsFromApi = 0, totalAccidentsFromApi = 0, totalRoadworksFromApi = 0, totalSafetyCamerasFromApi = 0;

        const displayedDeviationIds = new Set();
        const results = backendData?.RESPONSE?.RESULT;
        const currentSelectedCountyValue = document.getElementById('county-select')?.value || '';


        if (results && Array.isArray(results)) {
            const situationResult = results.find(r => r.Situation);
            if (situationResult?.Situation) {
                const situationArray = Array.isArray(situationResult.Situation) ? situationResult.Situation : [situationResult.Situation];
                let allDeviations = [];
                situationArray.forEach(s => { 
                    if (s?.Deviation && Array.isArray(s.Deviation)) {
                         allDeviations = allDeviations.concat(s.Deviation); 
                    } else if (s?.Deviation) { // Om Deviation inte är en array
                        allDeviations.push(s.Deviation);
                    }
                }); 
                totalDeviationsFromApi = allDeviations.length;

                allDeviations.forEach(deviation => {
                    const devId = deviation.Id || `UnknownDev_${Math.random().toString(36).substring(2,9)}`;
                    if (displayedDeviationIds.has(devId)) return;

                    const isAccident = deviation.MessageTypeValue === 'Accident';
                    const isRoadwork = roadworkTypeValues.includes(deviation.MessageTypeValue);

                    if (isAccident) totalAccidentsFromApi++;
                    if (isRoadwork) totalRoadworksFromApi++;

                    if (!((isAccident && showAccidents) || (isRoadwork && showRoadworks))) return; 

                    let displayCoords = null;
                    let isImprecise = false;
                    let markerIcon = defaultIcon; 

                    const pointWGS84 = deviation.Geometry?.Point?.WGS84;
                    if (pointWGS84) {
                        displayCoords = parseWktPoint(pointWGS84, devId);
                    }

                    if (!displayCoords) {
                        const lineWGS84 = deviation.Geometry?.Line?.WGS84;
                        if (lineWGS84) {
                            const lineCoordsArray = parseWktLineString(lineWGS84, devId);
                            if (lineCoordsArray && lineCoordsArray.length > 0) {
                                displayCoords = lineCoordsArray[0]; 
                            }
                        }
                    }
                    
                    if (!displayCoords) { 
                        isImprecise = true;
                        if (deviation.CountyNo && deviation.CountyNo.length > 0) {
                            const firstCountyNo = deviation.CountyNo[0];
                            const countyData = countyListSource.find(c => c.number === firstCountyNo); // Använd countyListSource
                            if (countyData && countyData.coords) {
                                let baseLat = countyData.coords[0];
                                let baseLon = countyData.coords[1];
                                const descriptorForHash = deviation.LocationDescriptor || deviation.Header || devId;
                                const hash = simpleStringHash(descriptorForHash);
                                const deterministicOffsetScale = 0.025; // Justerat för spridning
                                const offsetX = ((hash % 1000) / 1000 - 0.5) * 2 * deterministicOffsetScale;
                                const offsetY = (((hash / 1000) % 1000) / 1000 - 0.5) * 2 * deterministicOffsetScale;
                                displayCoords = [baseLat + offsetY, baseLon + offsetX];
                            } else { 
                                return; 
                            }
                        } else { 
                            return; 
                        }
                    }
                    
                    if (deviation.IconId) {
                       try { 
                           markerIcon = L.icon({ 
                               iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${deviation.IconId}?type=svg`, 
                               iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30],
                           }); 
                       } catch(e) { markerIcon = defaultIcon; }
                    } else if (isAccident) { 
                        markerIcon = defaultIcon; // Eller specifik olycksikon
                    } else if (isRoadwork) {
                        markerIcon = defaultIcon; // Eller specifik vägarbetsikon
                    }

                    if (displayCoords) {
                        const marker = L.marker(displayCoords, { icon: markerIcon });
                        const countyNames = Array.isArray(deviation.CountyNo) 
                            ? deviation.CountyNo.map(num => currentCountyNumberToName[num] || `Län ${num}`).join(', ')
                            : (currentCountyNumberToName[deviation.CountyNo] || `Län ${deviation.CountyNo}`);


                        let devPopupContent = `<h3>${deviation.Header || 'Händelse'}</h3>`;
                        devPopupContent += `<strong>Typ:</strong> ${deviation.MessageType || deviation.MessageTypeValue || 'Okänd'}<br>`;
                        if (isImprecise) { devPopupContent += `<strong style="color: orange;">Position är ungefärlig (länsnivå)</strong><br>`; }
                        if (deviation.Message) devPopupContent += `<strong>Info:</strong> ${deviation.Message}<br>`;
                        if (deviation.SeverityText) devPopupContent += `<strong>Allvarlighetsgrad:</strong> ${deviation.SeverityText}<br>`;
                        
                        let roadInfo = '';
                        if (deviation.RoadNumber) roadInfo += deviation.RoadNumber;
                        if (deviation.RoadName) roadInfo += (roadInfo ? ` (${deviation.RoadName})` : deviation.RoadName);
                        if (roadInfo) devPopupContent += `<strong>Väg:</strong> ${roadInfo}<br>`;
                        
                        if (deviation.LocationDescriptor) devPopupContent += `<strong>Plats:</strong> ${deviation.LocationDescriptor}<br>`;
                        if (deviation.AffectedDirection) { 
                            const dir = deviation.AffectedDirection.Description || deviation.AffectedDirection.Value || deviation.AffectedDirection;
                            devPopupContent += `<strong>Riktning:</strong> ${dir}<br>`; 
                        }
                        if (deviation.StartTime) devPopupContent += `<strong>Start:</strong> ${new Date(deviation.StartTime).toLocaleString('sv-SE')}<br>`;
                        if (deviation.EndTime) { devPopupContent += `<strong>Slut (beräknad):</strong> ${new Date(deviation.EndTime).toLocaleString('sv-SE')}<br>`; }
                        else if (deviation.ValidUntilFurtherNotice) { devPopupContent += `<strong>Gäller:</strong> Tills vidare<br>`; }
                        if (deviation.WebLink) devPopupContent += `<a href="${deviation.WebLink}" target="_blank" rel="noopener noreferrer">Mer information (Trafikverket)</a><br>`;
                        devPopupContent += `<strong>Län:</strong> ${countyNames}<br>`;
                        if (deviation.VersionTime) devPopupContent += `<small>Uppdaterad: ${new Date(deviation.VersionTime).toLocaleString('sv-SE')}</small><br>`;
                        
                        marker.bindPopup(devPopupContent);
                        markerClusterGroup.addLayer(marker);
                        displayedDeviationIds.add(devId);
                        markersAdded++;

                        if (isAccident) {
                            if (isImprecise) impreciseAccidentMarkersOnMap++; else accidentMarkersOnMap++;
                        } else if (isRoadwork) {
                            if (isImprecise) impreciseRoadworkMarkersOnMap++; else roadworkMarkersOnMap++;
                        }
                    }
                });
            }

            const cameraResult = results.find(r => r.TrafficSafetyCamera);
            if (cameraResult?.TrafficSafetyCamera && Array.isArray(cameraResult.TrafficSafetyCamera)) {
                const cameras = cameraResult.TrafficSafetyCamera;
                totalSafetyCamerasFromApi = cameras.length;
                if (showCameras) {
                    cameras.forEach(camera => {
                        const camId = camera.Id || `UnknownCam_${Math.random().toString(36).substring(2,9)}`;
                        const coords = parseWktPoint(camera.Geometry?.WGS84, camId);
                        if (!coords) return;

                        let icon = defaultTrafficSafetyCameraIcon;
                        if (camera.IconId) { 
                            try { 
                                icon = L.icon({ 
                                    iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${camera.IconId}?type=svg`,
                                    iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30] 
                                }); 
                            } catch(e) { /* fallback to defaultTrafficSafetyCameraIcon */ } 
                        }
                        const countyName = currentCountyNumberToName[camera.CountyNo] || `Län ${camera.CountyNo}`;
                        let camPopupContent = `<h3>Fartkamera</h3>`;
                        if (camera.Name) camPopupContent += `<strong>Namn:</strong> ${camera.Name}<br>`;
                        if (camera.Bearing !== undefined) camPopupContent += `<strong>Riktning:</strong> ${camera.Bearing}°<br>`;
                        if (camera.SpeedLimit) camPopupContent += `<strong>Hastighet:</strong> ${camera.SpeedLimit} km/h<br>`;
                        camPopupContent += `<strong>Län:</strong> ${countyName}`;
                        
                        const cameraMarker = L.marker(coords, { icon: icon }).bindPopup(camPopupContent);
                        markerClusterGroup.addLayer(cameraMarker);
                        safetyCameraMarkersOnMap++;
                        markersAdded++;
                    });
                }
            }
        }
        
        const countyDisplayName = countyListSource.find(c => c.value === currentSelectedCountyValue)?.name?.replace(' län', '') || currentSelectedCountyValue || "hela Sverige";
        let message = "";
        let success = markersAdded > 0;
        let messageParts = [];

        const actualAccidentsShown = accidentMarkersOnMap + impreciseAccidentMarkersOnMap;
        const actualRoadworksShown = roadworkMarkersOnMap + impreciseRoadworkMarkersOnMap;

        if (actualAccidentsShown > 0) messageParts.push(`${actualAccidentsShown} ${actualAccidentsShown === 1 ? "olycka" : "olyckor"}`);
        if (actualRoadworksShown > 0) messageParts.push(`${actualRoadworksShown} ${actualRoadworksShown === 1 ? "vägarbete" : "vägarbeten"}`);
        if (safetyCameraMarkersOnMap > 0) messageParts.push(`${safetyCameraMarkersOnMap} ${safetyCameraMarkersOnMap === 1 ? "fartkamera" : "fartkameror"}`);

        if (messageParts.length > 0) {
            message = `Visar ${messageParts.join(' och ')} för ${countyDisplayName}.`;
            if (markerClusterGroup.getLayers().length > 0 && mapInstance.getBounds().isValid()) { // Kolla om kartan har giltiga bounds
                 try {
                    setTimeout(() => { // Ge kartan tid att rendera DOM-element
                        if (mapInstance && markerClusterGroup.getLayers().length > 0) {
                            const bounds = markerClusterGroup.getBounds();
                            if (bounds.isValid()) {
                                mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
                            } else if (currentSelectedCountyValue) { // Om bounds inte är giltiga, centrera på län
                                centerMapOnCounty(currentSelectedCountyValue);
                            } else { // Fallback till defaultvy
                                mapInstance.setView([62.0, 15.0], 5);
                            }
                        }
                    }, 150);
                } catch (boundsError) {
                     console.error(`${logPrefix} Could not fit map bounds:`, boundsError);
                     if (currentSelectedCountyValue) centerMapOnCounty(currentSelectedCountyValue);
                     else mapInstance.setView([62.0, 15.0], 5);
                }
            } else if (currentSelectedCountyValue) { // Om inga markörer men ett län är valt
                centerMapOnCounty(currentSelectedCountyValue);
            }

        } else {
            if (currentSelectedCountyValue) centerMapOnCounty(currentSelectedCountyValue); // Centrera även om inget visas
            else mapInstance.setView([62.0, 15.0], 5); // Defaultvy om inget län är valt

            let noDataReason = "";
            if (!showAccidents && totalAccidentsFromApi > 0) noDataReason += `${totalAccidentsFromApi} olyckor dolda. `;
            if (!showRoadworks && totalRoadworksFromApi > 0) noDataReason += `${totalRoadworksFromApi} vägarbeten dolda. `;
            if (!showCameras && totalSafetyCamerasFromApi > 0) noDataReason += `${totalSafetyCamerasFromApi} fartkameror dolda. `;
            
            if (noDataReason) { 
                message = noDataReason.trim(); 
            } else { 
                message = `Inga aktiva händelser eller valda filter matchar i ${countyDisplayName} just nu.`; 
            }
        }
        return { success: success, message: message };
    };


    const centerMapOnCounty = (selectedCountyValue) => {
        // ... (din centerMapOnCounty-logik)
         if (!mapInstance) return;
         const countyInfo = countyListSource.find(c => c.value === selectedCountyValue); // Använd countyListSource
         if (countyInfo && countyInfo.coords && typeof countyInfo.zoom === 'number') {
             mapInstance.setView(countyInfo.coords, countyInfo.zoom);
         } else { // Fallback till "Alla län" eller defaultvy
             const allCountiesInfo = countyListSource.find(c => c.value === '');
             if (allCountiesInfo) {
                 mapInstance.setView(allCountiesInfo.coords, allCountiesInfo.zoom);
             } else {
                 mapInstance.setView([62.0, 15.0], 5); // Generell default
             }
         }
    };

    return {
        initMap,
        centerMapOnCounty,
        fetchTrafficDataFromServer,
        renderMarkersOnMap
    };
}