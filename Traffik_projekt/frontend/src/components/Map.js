// map.js
export function useTrafficMap(apiUrl, countyList, countyNumberToName) {
    let mapInstance = null;
    let markerClusterGroup = null;

    const TRAFIKVERKET_ICON_BASE_URL = "https://api.trafikinfo.trafikverket.se/v1/icons/";

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

    // Lista över MessageTypeValue som klassas som "vägarbete"
    const roadworkTypeValues = ['Roadwork', 'MaintenanceWorks', 'ConstructionWork', 'RoadResurfacing'];

    const initMap = (mapElementId) => {
         console.log("Initializing Leaflet map...");
         if (!mapInstance && document.getElementById(mapElementId)) {
             mapInstance = L.map(mapElementId).setView([62.0, 15.0], 5);
             L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                 maxZoom: 19,
                 attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
             }).addTo(mapInstance);
             markerClusterGroup = L.markerClusterGroup();
             mapInstance.addLayer(markerClusterGroup);
             console.log("Map initialized with MarkerClusterGroup.");
         } else if (mapInstance) { console.log("Map already initialized."); }
         else { console.error(`Map element with ID '${mapElementId}' not found.`); }
    };

    const parseWktPoint = (wktString, objectIdForLog = 'Unknown') => {
         if (!wktString || typeof wktString !== 'string') { if (wktString) console.warn(`Invalid WKT input type for ID ${objectIdForLog}:`, typeof wktString); return null; }
         const match = wktString.match(/POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/i);
         if (match && match[1] && match[2]) { try { const lon = parseFloat(match[1]); const lat = parseFloat(match[2]); if (isNaN(lon) || isNaN(lat) || lat < -90 || lat > 90 || lon < -180 || lon > 180) { console.warn("Invalid coordinates parsed from WKT:", wktString, `(Lat: ${lat}, Lon: ${lon}) for ID ${objectIdForLog}`); return null; } return [lat, lon]; } catch (e) { console.error("Could not parse coordinates from WKT:", wktString, `for ID ${objectIdForLog}`, e); return null; } }
         else { if (wktString.trim()) console.warn("WGS84 WKT string format not recognized:", wktString, `for ID ${objectIdForLog}`); return null; }
    };

    const fetchTrafficDataFromServer = async (selectedCountyValue) => {
        const logPrefix = `[FetchData][County: ${selectedCountyValue || 'All'}]`;
        // console.log(`${logPrefix} Attempting to fetch traffic info from server...`);

        let url = apiUrl; const params = new URLSearchParams();
        if (selectedCountyValue) { params.append('county', selectedCountyValue); }
        // API:et hämtar fortfarande alla typer vi är intresserade av
        params.append('messageTypeValue', 'Accident,Roadwork,MaintenanceWorks,ConstructionWork,RoadResurfacing');
        const queryString = params.toString();
        if (queryString) { url += (apiUrl.includes('?') ? '&' : '?') + queryString; }
        // console.log(`${logPrefix} Fetching from constructed URL: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            const backendResponse = await response.json();
            // console.log(`${logPrefix} Successfully fetched data.`);
            return { success: true, data: backendResponse, message: "Data hämtad." };
        } catch (error) {
            console.error(`${logPrefix} Error fetching traffic info:`, error);
            return { success: false, data: null, message: "Kunde inte hämta trafikinformation." };
        }
    };

    // renderMarkersOnMap tar nu emot showAccidents och showRoadworks
    const renderMarkersOnMap = (backendData, showAccidents, showRoadworks, showCameras) => {
        const logPrefix = `[RenderMarkers]`;
        // console.log(`${logPrefix} Rendering. Accidents: ${showAccidents}, Roadworks: ${showRoadworks}, Cameras: ${showCameras}`);

        if (!mapInstance || !markerClusterGroup || !backendData) {
            console.warn(`${logPrefix} Prerequisities not met for rendering.`);
            return { success: false, message: "Kunde inte rendera markörer." };
        }

        markerClusterGroup.clearLayers();
        
        let accidentMarkersOnMap = 0; // Ny räknare
        let roadworkMarkersOnMap = 0; // Ny räknare
        let safetyCameraMarkersOnMap = 0;
        let impreciseAccidentMarkersOnMap = 0; // Ny räknare
        let impreciseRoadworkMarkersOnMap = 0; // Ny räknare

        let totalDeviationsFromApi = 0;
        let totalAccidentsFromApi = 0; // För statusmeddelande
        let totalRoadworksFromApi = 0; // För statusmeddelande
        let totalSafetyCamerasFromApi = 0;

        const results = backendData?.RESPONSE?.RESULT;
        const appVueInstance = document.getElementById('app')?.__vue_app__;
        const currentSelectedCountyValue = appVueInstance ? appVueInstance._instance.setupState.selectedCounty : '';

        if (results && Array.isArray(results)) {
            if (results.length > 0 && results[0].Situation) {
                const situationArray = results[0].Situation;
                let allDeviations = [];
                if (Array.isArray(situationArray)) { situationArray.forEach(s => { if (s?.Deviation) allDeviations = allDeviations.concat(s.Deviation); }); }
                totalDeviationsFromApi = allDeviations.length;

                allDeviations.forEach(deviation => {
                    const isAccident = deviation.MessageTypeValue === 'Accident';
                    const isRoadwork = roadworkTypeValues.includes(deviation.MessageTypeValue);

                    if (isAccident) totalAccidentsFromApi++;
                    if (isRoadwork) totalRoadworksFromApi++;

                    // TILLÄMPA GRANULÄRT FILTER
                    if (!((isAccident && showAccidents) || (isRoadwork && showRoadworks))) {
                        return; // Hoppa över denna deviation om den inte matchar aktivt filter
                    }

                    const devId = deviation.Id || 'Unknown Dev';
                    let coords = parseWktPoint(deviation.Geometry?.WGS84, devId);
                    let isImprecise = false;
                    let markerIcon = defaultIcon; 

                    if (!coords) { 
                        if (deviation.CountyNo && deviation.CountyNo.length > 0) {
                            const firstCountyNo = deviation.CountyNo[0];
                            const countyForImpreciseMarker = countyList.find(c => c.number === firstCountyNo);
                            if (countyForImpreciseMarker && countyForImpreciseMarker.coords) {
                                coords = countyForImpreciseMarker.coords;
                                isImprecise = true;
                            } else { return; }
                        } else { return; }
                    }
                    
                    if (deviation.IconId) {
                       try { 
                           markerIcon = L.icon({ 
                               iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${deviation.IconId}?type=png32x32`, 
                               iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
                           }); 
                       } catch(e) { console.error(`Icon error for Deviation ${devId} with IconId ${deviation.IconId}:`, e); }
                    }
                    
                    const countyNumbers = deviation.CountyNo;
                    let countyNames = 'N/A';
                    if (Array.isArray(countyNumbers)) { countyNames = countyNumbers.map(num => countyNumberToName[num] || `Okänt län (${num})`).join(', '); }
                    else if (countyNumbers) { countyNames = countyNumberToName[countyNumbers] || `Okänt län (${countyNumbers})`; }

                    let devPopupContent = `<b>${deviation.Header || 'Händelse'}</b> (${deviation.MessageType || deviation.MessageTypeValue || 'Okänd typ'})<br>`;
                    if (isImprecise) { devPopupContent += `<span style="color: orange; font-weight: bold;">OBS! Positionen är ungefärlig (visar länets mittpunkt).</span><br>`; }
                    // ... (resten av din popup-logik)
                    if (deviation.Message) devPopupContent += `Meddelande: ${deviation.Message}<br>`;
                    if (deviation.SeverityText) devPopupContent += `Allvarlighetsgrad: ${deviation.SeverityText}<br>`;
                    let roadInfo = '';
                    if (deviation.RoadNumber) roadInfo += deviation.RoadNumber;
                    if (deviation.RoadName) roadInfo += (roadInfo ? ` (${deviation.RoadName})` : deviation.RoadName);
                    if (roadInfo) devPopupContent += `Väg: ${roadInfo}<br>`;
                    if (deviation.LocationDescriptor) devPopupContent += `Plats: ${deviation.LocationDescriptor}<br>`;
                    if (deviation.PositionalDescription) devPopupContent += `Beskrivning: ${deviation.PositionalDescription}<br>`;
                    if (deviation.AffectedDirection) { if (deviation.AffectedDirection.Description) { devPopupContent += `Riktning: ${deviation.AffectedDirection.Description}<br>`; } else if (deviation.AffectedDirection.Value) { devPopupContent += `Riktning: ${deviation.AffectedDirection.Value}<br>`; } }
                    if (deviation.TrafficRestrictionType) devPopupContent += `Restriktion: ${deviation.TrafficRestrictionType}<br>`;
                    if (deviation.NumberOfLanesRestricted !== undefined) devPopupContent += `Påverkade körfält: ${deviation.NumberOfLanesRestricted}<br>`;
                    if (deviation.TemporaryLimit) devPopupContent += `Tillfällig begränsning: ${deviation.TemporaryLimit}<br>`;
                    if (deviation.StartTime) devPopupContent += `Starttid: ${new Date(deviation.StartTime).toLocaleString('sv-SE')}<br>`;
                    if (deviation.EndTime) { devPopupContent += `Beräknad sluttid: ${new Date(deviation.EndTime).toLocaleString('sv-SE')}<br>`; }
                    else if (deviation.ValidUntilFurtherNotice) { devPopupContent += `Gäller tills vidare<br>`; }
                    if (deviation.WebLink) devPopupContent += `<a href="${deviation.WebLink}" target="_blank">Mer information</a><br>`;
                    devPopupContent += `Län: ${countyNames}<br>`;
                    if (deviation.VersionTime) devPopupContent += `Senast uppdaterad: ${new Date(deviation.VersionTime).toLocaleString('sv-SE')}<br>`;
                    
                    markerClusterGroup.addLayer(L.marker(coords, { icon: markerIcon }).bindPopup(devPopupContent));
                    if (isAccident) {
                        if (isImprecise) impreciseAccidentMarkersOnMap++; else accidentMarkersOnMap++;
                    } else if (isRoadwork) {
                        if (isImprecise) impreciseRoadworkMarkersOnMap++; else roadworkMarkersOnMap++;
                    }
                });
            }

            if (results.length > 1 && results[1].TrafficSafetyCamera) {
                const cameras = results[1].TrafficSafetyCamera;
                if (Array.isArray(cameras)) { 
                    totalSafetyCamerasFromApi = cameras.length;
                    if (showCameras) { // Filter för kameror
                        cameras.forEach(camera => {
                            // ... (befintlig kod för att skapa kameramarkörer)
                            const camId = camera.Id || 'Unknown SafetyCam';
                            const coords = parseWktPoint(camera.Geometry?.WGS84, camId);
                            if (!coords) return;

                            let icon = defaultTrafficSafetyCameraIcon;
                            if (camera.IconId) { try { icon = L.icon({ iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${camera.IconId}?type=png32x32`, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] }); } catch(e) {console.error(`Icon error for SafetyCamera ${camId}:`, e)} }
                            
                            const countyNum = camera.CountyNo;
                            const countyName = countyNum ? (countyNumberToName[countyNum] || `Okänt län (${countyNum})`) : 'Okänt län';
                            let camPopupContent = `<b>Fartkamera</b><br>`;
                            if (camera.Name) camPopupContent += `Namn: ${camera.Name}<br>`;
                            else if (camId !== 'Unknown SafetyCam') camPopupContent += `ID: ${camId}<br>`;
                            if (camera.Bearing !== undefined && camera.Bearing !== null) { camPopupContent += `Riktning (grader): ${camera.Bearing}°<br>`; }
                            camPopupContent += `Län: ${countyName}`;
                            
                            markerClusterGroup.addLayer(L.marker(coords, { icon: icon }).bindPopup(camPopupContent));
                            safetyCameraMarkersOnMap++;
                        });
                    }
                }
            }
        } else {
            console.log(`${logPrefix} No RESPONSE.RESULT array found in backendData or it was empty.`);
        }
        
        const countyDisplayName = countyList.find(c => c.value === currentSelectedCountyValue)?.name?.replace(' län', '') || currentSelectedCountyValue || "Sverige";
        let message = "";
        let success = false; 

        let messageParts = [];
        if (accidentMarkersOnMap > 0) {
            messageParts.push(`${accidentMarkersOnMap} ${accidentMarkersOnMap === 1 ? "olycka" : "olyckor"}`);
        }
        if (impreciseAccidentMarkersOnMap > 0) {
            messageParts.push(`${impreciseAccidentMarkersOnMap} ${impreciseAccidentMarkersOnMap === 1 ? "ungefärlig olycka" : "ungefärliga olyckor"}`);
        }
        if (roadworkMarkersOnMap > 0) {
            messageParts.push(`${roadworkMarkersOnMap} ${roadworkMarkersOnMap === 1 ? "vägarbete" : "vägarbeten"}`);
        }
        if (impreciseRoadworkMarkersOnMap > 0) {
            messageParts.push(`${impreciseRoadworkMarkersOnMap} ${impreciseRoadworkMarkersOnMap === 1 ? "ungefärligt vägarbete" : "ungefärliga vägarbeten"}`);
        }
        if (safetyCameraMarkersOnMap > 0) {
            messageParts.push(`${safetyCameraMarkersOnMap} ${safetyCameraMarkersOnMap === 1 ? "fartkamera" : "fartkameror"}`);
        }

        if (messageParts.length > 0) {
            success = true;
            message = `Visar ${messageParts.join(' och ')} för ${countyDisplayName} län.`;
            
            if (markerClusterGroup.getLayers().length > 0) {
                try { mapInstance.fitBounds(markerClusterGroup.getBounds(), { padding: [50, 50], maxZoom: 16 }); }
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
            if (!showAccidents && totalAccidentsFromApi > 0) noDataReason += `${totalAccidentsFromApi} olyckor dolda. `;
            if (!showRoadworks && totalRoadworksFromApi > 0) noDataReason += `${totalRoadworksFromApi} vägarbeten dolda. `;
            if (!showCameras && totalSafetyCamerasFromApi > 0) noDataReason += `${totalSafetyCamerasFromApi} fartkameror dolda. `;

            if (noDataReason) {
                message = noDataReason.trim();
            } else if (totalDeviationsFromApi > 0 || totalSafetyCamerasFromApi > 0) {
                message = `Inga händelser med positionsdata att visa på kartan för ${countyDisplayName} just nu (med aktiva filter).`;
            } else {
                message = `Inga trafikstörningar eller fartkameror rapporterade för ${countyDisplayName} just nu.`;
            }
        }
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
