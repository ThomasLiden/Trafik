// map.js
export function useTrafficMap(apiUrl, countyList, countyNumberToName) {
    let mapInstance = null;
    let markerClusterGroup = null;

    const TRAFIKVERKET_ICON_BASE_URL = "https://api.trafikinfo.trafikverket.se/v2/icons/";

    const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    const defaultTrafficSafetyCameraIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    // Fallback-ikoner (URL:er, helst PNG för direkt L.icon-stöd)
    // const FALLBACK_ICON_ACCIDENT_URL = 'path/to/your/accident_fallback.png'; 
    // const FALLBACK_ICON_ROADWORK_URL = 'path/to/your/roadwork_fallback.png';


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
         console.log("Initializing Leaflet map...");
         if (!mapInstance && document.getElementById(mapElementId)) {
             mapInstance = L.map(mapElementId).setView([62.0, 15.0], 5);
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
             if (wktString.trim() && !wktString.toUpperCase().startsWith("POINT")) { // Logga bara om det inte är en tom sträng och inte ser ut som en POINT
                console.warn(`[parseWktPoint] WKT string format not recognized for ${objectIdForLog}: ${wktString}`);
             }
             return null;
         }
    };

    // Funktion för att parsa WKT LINESTRING-sträng (WGS84)
    const parseWktLineString = (wktString, objectIdForLog = 'UnknownLine') => {
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
            return coordinates.length > 0 ? coordinates : null; // Returnera arrayen med koordinater (kan vara en enpunktslinje om bara ett par parsades korrekt)
        } else {
            if (wktString.trim() && !wktString.toUpperCase().startsWith("LINESTRING")) {
                console.warn(`[parseWktLineString] WKT string format not recognized for ${objectIdForLog}: ${wktString}`);
            }
            return null;
        }
    };

    const fetchTrafficDataFromServer = async (selectedCountyValue) => {
        const logPrefix = `[FetchData][County: ${selectedCountyValue || 'All'}]`;
        let url = apiUrl; 
        const params = new URLSearchParams();
        if (selectedCountyValue) { 
            params.append('county', selectedCountyValue); 
        }
        params.append('messageTypeValue', 'Accident,Roadwork,MaintenanceWorks,ConstructionWork,RoadResurfacing,TrafficSafetyCamera'); 
        
        const queryString = params.toString();
        if (queryString) { 
            url += (apiUrl.includes('?') ? '&' : '?') + queryString; 
        }
        
        console.log(`${logPrefix} Fetching from URL: ${url}`);
        try {
            const response = await fetch(url);
            if (!response.ok) { 
                throw new Error(`HTTP error! status: ${response.status}`); 
            }
            const backendResponse = await response.json();
            // console.log(`${logPrefix} Data fetched successfully. Deviations sample:`, backendResponse?.RESPONSE?.RESULT?.[0]?.Situation?.[0]?.Deviation?.slice(0,2));
            return { success: true, data: backendResponse, message: "Data hämtad." };
        } catch (error) {
            console.error(`${logPrefix} Error fetching traffic info:`, error);
            return { success: false, data: null, message: "Kunde inte hämta trafikinformation." };
        }
    };

    const renderMarkersOnMap = (backendData, showAccidents, showRoadworks, showCameras) => {
        const logPrefix = `[RenderMarkers]`;
        if (!mapInstance || !markerClusterGroup || !backendData) {
            console.warn(`${logPrefix} Prerequisites not met for rendering.`);
            return { success: false, message: "Kunde inte rendera markörer på kartan." };
        }

        markerClusterGroup.clearLayers();
        
        let accidentMarkersOnMap = 0, roadworkMarkersOnMap = 0, safetyCameraMarkersOnMap = 0;
        let impreciseAccidentMarkersOnMap = 0, impreciseRoadworkMarkersOnMap = 0;
        let totalDeviationsFromApi = 0, totalAccidentsFromApi = 0, totalRoadworksFromApi = 0, totalSafetyCamerasFromApi = 0;

        const displayedDeviationIds = new Set();

        const results = backendData?.RESPONSE?.RESULT;
        const appVueInstance = document.getElementById('app')?.__vue_app__;
        const currentSelectedCountyValue = appVueInstance ? appVueInstance._instance.setupState.selectedCounty : '';

        if (results && Array.isArray(results)) {
            const situationResult = results.find(r => r.Situation);
            if (situationResult?.Situation) {
                const situationArray = situationResult.Situation;
                let allDeviations = [];
                if (Array.isArray(situationArray)) { 
                    situationArray.forEach(s => { 
                        if (s?.Deviation && Array.isArray(s.Deviation)) {
                             allDeviations = allDeviations.concat(s.Deviation); 
                        }
                    }); 
                }
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

                    // 1. Försök med punktgeometri
                    const pointWGS84 = deviation.Geometry?.Point?.WGS84;
                    if (pointWGS84) {
                        displayCoords = parseWktPoint(pointWGS84, devId);
                        if (displayCoords) {
                            console.log(`${logPrefix} ID: ${devId} - Using PRECISE POINT location for marker.`);
                        }
                    }

                    // 2. Om ingen punkt, försök med första punkten från linjegeometri
                    if (!displayCoords) {
                        const lineWGS84 = deviation.Geometry?.Line?.WGS84;
                        if (lineWGS84) {
                            const lineCoordsArray = parseWktLineString(lineWGS84, devId);
                            if (lineCoordsArray && lineCoordsArray.length > 0) {
                                displayCoords = lineCoordsArray[0]; // Använd första punkten i linjen
                                console.log(`${logPrefix} ID: ${devId} - Using START OF PRECISE LINESTRING as backup location for marker.`);
                            } else {
                                console.warn(`${logPrefix} ID: ${devId} - Parsed LINESTRING was empty or invalid, cannot use as backup.`);
                            }
                        }
                    }
                    
                    // 3. Om fortfarande inga koordinater, använd oprecis positionering
                    if (!displayCoords) { 
                        isImprecise = true;
                        console.log(`${logPrefix} ID: ${devId} - No precise geometry. Attempting IMPRECISE (county) location for marker.`);
                        if (deviation.CountyNo && deviation.CountyNo.length > 0) {
                            const firstCountyNo = deviation.CountyNo[0];
                            const countyForImpreciseMarker = countyList.find(c => c.number === firstCountyNo);
                            if (countyForImpreciseMarker && countyForImpreciseMarker.coords) {
                                let baseLat = countyForImpreciseMarker.coords[0];
                                let baseLon = countyForImpreciseMarker.coords[1];
                                const descriptorForHash = deviation.LocationDescriptor || deviation.Header || devId;
                                const hash = simpleStringHash(descriptorForHash);
                                const deterministicOffsetScale = 0.015; 
                                const offsetX = ((hash % 1000) / 1000 - 0.5) * 2 * deterministicOffsetScale;
                                const offsetY = (((hash / 1000) % 1000) / 1000 - 0.5) * 2 * deterministicOffsetScale;
                                displayCoords = [baseLat + offsetY, baseLon + offsetX];
                            } else { 
                                console.warn(`${logPrefix} ID: ${devId} - No county coords for imprecise placement (CountyNo: ${firstCountyNo}).`);
                                return; 
                            }
                        } else { 
                            console.warn(`${logPrefix} ID: ${devId} - No CountyNo for imprecise positioning.`);
                            return; 
                        }
                    }
                    
                    // Sätt ikon
                    if (deviation.IconId) {
                       try { 
                           markerIcon = L.icon({ 
                               iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${deviation.IconId}?type=svg`, 
                               iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32],
                           }); 
                       } catch(e) { 
                           console.error(`${logPrefix} Icon error for Deviation ${devId} with IconId ${deviation.IconId}:`, e);
                           markerIcon = defaultIcon; 
                       }
                    } else if (isAccident) { 
                        // Använd defaultIcon eller en specifik PNG fallback för olyckor
                        // markerIcon = L.icon({ iconUrl: 'path/to/accident.png', ... });
                        markerIcon = defaultIcon; 
                    } else if (isRoadwork) {
                        // Använd defaultIcon eller en specifik PNG fallback för vägarbeten
                        // markerIcon = L.icon({ iconUrl: 'path/to/roadwork.png', ... });
                        markerIcon = defaultIcon; 
                    }

                    if (displayCoords) {
                        const marker = L.marker(displayCoords, { icon: markerIcon });
                        
                        const countyNumbers = deviation.CountyNo;
                        let countyNames = 'N/A';
                        if (Array.isArray(countyNumbers)) { countyNames = countyNumbers.map(num => countyNumberToName[num] || `Okänt län (${num})`).join(', '); }
                        else if (countyNumbers) { countyNames = countyNumberToName[countyNumbers] || `Okänt län (${countyNumbers})`; }

                        let devPopupContent = `<b>${deviation.Header || 'Händelse'}</b> (${deviation.MessageType || deviation.MessageTypeValue || 'Okänd typ'})<br>`;
                        if (isImprecise) { devPopupContent += `<span style="color: orange; font-weight: bold;">OBS! Positionen är ungefärlig.</span><br>`; }
                        if (deviation.Message) devPopupContent += `Meddelande: ${deviation.Message}<br>`;
                        if (deviation.SeverityText) devPopupContent += `Allvarlighetsgrad: ${deviation.SeverityText}<br>`;
                        let roadInfo = '';
                        if (deviation.RoadNumber) roadInfo += deviation.RoadNumber;
                        if (deviation.RoadName) roadInfo += (roadInfo ? ` (${deviation.RoadName})` : deviation.RoadName);
                        if (roadInfo) devPopupContent += `Väg: ${roadInfo}<br>`;
                        if (deviation.LocationDescriptor) devPopupContent += `Plats: ${deviation.LocationDescriptor}<br>`;
                        if (deviation.AffectedDirection) { 
                            if (typeof deviation.AffectedDirection === 'string') {
                                devPopupContent += `Riktning: ${deviation.AffectedDirection}<br>`;
                            } else if (deviation.AffectedDirection.Description) { 
                                devPopupContent += `Riktning: ${deviation.AffectedDirection.Description}<br>`; 
                            } else if (deviation.AffectedDirection.Value) { 
                                devPopupContent += `Riktning: ${deviation.AffectedDirection.Value}<br>`; 
                            } 
                        }
                        if (deviation.TrafficRestrictionType) devPopupContent += `Restriktion: ${deviation.TrafficRestrictionType}<br>`;
                        if (deviation.NumberOfLanesRestricted !== undefined) devPopupContent += `Påverkade körfält: ${deviation.NumberOfLanesRestricted}<br>`;
                        if (deviation.StartTime) devPopupContent += `Starttid: ${new Date(deviation.StartTime).toLocaleString('sv-SE')}<br>`;
                        if (deviation.EndTime) { devPopupContent += `Beräknad sluttid: ${new Date(deviation.EndTime).toLocaleString('sv-SE')}<br>`; }
                        else if (deviation.ValidUntilFurtherNotice) { devPopupContent += `Gäller tills vidare<br>`; }
                        if (deviation.WebLink) devPopupContent += `<a href="${deviation.WebLink}" target="_blank" rel="noopener noreferrer">Mer information</a><br>`;
                        devPopupContent += `Län: ${countyNames}<br>`;
                        if (deviation.VersionTime) devPopupContent += `Senast uppdaterad: ${new Date(deviation.VersionTime).toLocaleString('sv-SE')}<br>`;
                        
                        marker.bindPopup(devPopupContent);
                        markerClusterGroup.addLayer(marker);
                        displayedDeviationIds.add(devId);

                        if (isAccident) {
                            if (isImprecise) impreciseAccidentMarkersOnMap++; else accidentMarkersOnMap++;
                        } else if (isRoadwork) {
                            if (isImprecise) impreciseRoadworkMarkersOnMap++; else roadworkMarkersOnMap++;
                        }
                    } else {
                        console.warn(`${logPrefix} ID: ${devId} - No display coordinates could be determined for marker.`);
                    }
                });
            } else {
                 console.log(`${logPrefix} No 'Situation' data found in the first result item, or 'Situation' array is missing/empty.`);
            }

            const cameraResult = results.find(r => r.TrafficSafetyCamera);
            if (cameraResult?.TrafficSafetyCamera && Array.isArray(cameraResult.TrafficSafetyCamera)) {
                const cameras = cameraResult.TrafficSafetyCamera;
                totalSafetyCamerasFromApi = cameras.length;
                if (showCameras) {
                    cameras.forEach(camera => {
                        const camId = camera.Id || `UnknownCam_${Math.random().toString(36).substring(2,9)}`;
                        const coords = parseWktPoint(camera.Geometry?.WGS84, camId);
                        if (!coords) {
                            console.warn(`${logPrefix} Could not parse coordinates for Camera ID: ${camId}`);
                            return;
                        }
                        let icon = defaultTrafficSafetyCameraIcon;
                        if (camera.IconId) { 
                            try { 
                                icon = L.icon({ 
                                    iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${camera.IconId}?type=svg`,
                                    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] 
                                }); 
                            } catch(e) {
                                console.error(`${logPrefix} Icon error for SafetyCamera ${camId} with IconId ${camera.IconId}:`, e);
                            } 
                        }
                        const countyNum = camera.CountyNo;
                        const countyName = countyNum ? (countyNumberToName[countyNum] || `Okänt län (${countyNum})`) : 'Okänt län';
                        let camPopupContent = `<b>Fartkamera</b><br>`;
                        if (camera.Name) camPopupContent += `Namn: ${camera.Name}<br>`;
                        else if (!camId.startsWith('UnknownCam_')) camPopupContent += `ID: ${camId}<br>`;
                        if (camera.Bearing !== undefined && camera.Bearing !== null) { camPopupContent += `Riktning (grader): ${camera.Bearing}°<br>`; }
                        if (camera.SpeedLimit) camPopupContent += `Hastighetsgräns: ${camera.SpeedLimit} km/h<br>`;
                        camPopupContent += `Län: ${countyName}`;
                        
                        const cameraMarker = L.marker(coords, { icon: icon }).bindPopup(camPopupContent);
                        markerClusterGroup.addLayer(cameraMarker);
                        safetyCameraMarkersOnMap++;
                    });
                }
            } else {
                console.log(`${logPrefix} No 'TrafficSafetyCamera' data found in results, or 'TrafficSafetyCamera' array is missing/empty.`);
            }
        } else {
            console.log(`${logPrefix} No RESPONSE.RESULT array found in backendData or it was empty.`);
        }
        
        const countyDisplayName = countyList.find(c => c.value === currentSelectedCountyValue)?.name?.replace(' län', '') || currentSelectedCountyValue || "Sverige";
        let message = "";
        let success = false; 
        let messageParts = [];
        if (accidentMarkersOnMap > 0) { messageParts.push(`${accidentMarkersOnMap} ${accidentMarkersOnMap === 1 ? "olycka" : "olyckor"}`); }
        if (impreciseAccidentMarkersOnMap > 0) { messageParts.push(`${impreciseAccidentMarkersOnMap} ${impreciseAccidentMarkersOnMap === 1 ? "ungefärlig olycka" : "ungefärliga olyckor"}`); }
        if (roadworkMarkersOnMap > 0) { messageParts.push(`${roadworkMarkersOnMap} ${roadworkMarkersOnMap === 1 ? "vägarbete" : "vägarbeten"}`); }
        if (impreciseRoadworkMarkersOnMap > 0) { messageParts.push(`${impreciseRoadworkMarkersOnMap} ${impreciseRoadworkMarkersOnMap === 1 ? "ungefärligt vägarbete" : "ungefärliga vägarbeten"}`); }
        if (safetyCameraMarkersOnMap > 0) { messageParts.push(`${safetyCameraMarkersOnMap} ${safetyCameraMarkersOnMap === 1 ? "fartkamera" : "fartkameror"}`); }

        if (messageParts.length > 0) {
            success = true;
            message = `Visar ${messageParts.join(' och ')} för ${countyDisplayName} län.`;
            if (markerClusterGroup.getLayers().length > 0) {
                try { 
                    setTimeout(() => {
                        if (mapInstance && markerClusterGroup.getLayers().length > 0) {
                            mapInstance.fitBounds(markerClusterGroup.getBounds(), { padding: [50, 50], maxZoom: 16 }); 
                        }
                    }, 100);
                }
                catch (boundsError) {
                    console.error(`${logPrefix} Could not fit map bounds for MarkerClusterGroup:`, boundsError);
                    if (currentSelectedCountyValue) centerMapOnCounty(currentSelectedCountyValue);
                    else mapInstance.setView([62.0, 15.0], 5);
                }
            }
        } else { 
            success = false;
            if (currentSelectedCountyValue) centerMapOnCounty(currentSelectedCountyValue);
            else mapInstance.setView([62.0, 15.0], 5);
            
            let noDataReason = "";
            if (!showAccidents && totalAccidentsFromApi > 0) noDataReason += `${totalAccidentsFromApi} ${totalAccidentsFromApi === 1 ? "olycka dold" : "olyckor dolda"}. `;
            if (!showRoadworks && totalRoadworksFromApi > 0) noDataReason += `${totalRoadworksFromApi} ${totalRoadworksFromApi === 1 ? "vägarbete dolt" : "vägarbeten dolda"}. `;
            if (!showCameras && totalSafetyCamerasFromApi > 0) noDataReason += `${totalSafetyCamerasFromApi} ${totalSafetyCamerasFromApi === 1 ? "fartkamera dold" : "fartkameror dolda"}. `;
            
            if (noDataReason) { 
                message = noDataReason.trim(); 
            } else if (totalDeviationsFromApi > 0 || totalSafetyCamerasFromApi > 0) { 
                message = `Inga händelser med positionsdata att visa på kartan för ${countyDisplayName} just nu (med aktiva filter).`; 
            } else { 
                message = `Inga trafikstörningar eller fartkameror rapporterade för ${countyDisplayName} just nu.`; 
            }
        }
        console.log(`${logPrefix} Rendering complete. Status: ${success ? 'Success' : 'No items to display'}. Message: ${message}`);
        return { success: success, message: message };
    };

    const centerMapOnCounty = (selectedCountyValue) => {
         if (!mapInstance) return;
         const countyInfo = countyList.find(c => c.value === selectedCountyValue);
         if (countyInfo && countyInfo.coords && typeof countyInfo.zoom === 'number') {
             mapInstance.setView(countyInfo.coords, countyInfo.zoom);
         } else {
             mapInstance.setView([62.0, 15.0], 5);
         }
    };

    return {
        initMap,
        centerMapOnCounty,
        fetchTrafficDataFromServer,
        renderMarkersOnMap
    };
}
