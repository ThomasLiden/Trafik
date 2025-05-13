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

    const roadworkTypeValues = ['Roadwork', 'MaintenanceWorks', 'ConstructionWork', 'RoadResurfacing'];

    // Enkel hash-funktion för strängar (för att skapa deterministisk offset)
    function simpleStringHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Konvertera till 32bit integer
        }
        return Math.abs(hash); // Returnera absolutvärdet
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
                zoomToBoundsOnClick: true
             });
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
        let url = apiUrl; const params = new URLSearchParams();
        if (selectedCountyValue) { params.append('county', selectedCountyValue); }
        params.append('messageTypeValue', 'Accident,Roadwork,MaintenanceWorks,ConstructionWork,RoadResurfacing');
        const queryString = params.toString();
        if (queryString) { url += (apiUrl.includes('?') ? '&' : '?') + queryString; }
        try {
            const response = await fetch(url);
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            const backendResponse = await response.json();
            return { success: true, data: backendResponse, message: "Data hämtad." };
        } catch (error) {
            console.error(`${logPrefix} Error fetching traffic info:`, error);
            return { success: false, data: null, message: "Kunde inte hämta trafikinformation." };
        }
    };

    const renderMarkersOnMap = (backendData, showAccidents, showRoadworks, showCameras) => {
        const logPrefix = `[RenderMarkers]`;
        if (!mapInstance || !markerClusterGroup || !backendData) {
            console.warn(`${logPrefix} Prerequisities not met for rendering.`);
            return { success: false, message: "Kunde inte rendera markörer." };
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
            if (results.length > 0 && results[0].Situation) {
                const situationArray = results[0].Situation;
                let allDeviations = [];
                if (Array.isArray(situationArray)) { situationArray.forEach(s => { if (s?.Deviation) allDeviations = allDeviations.concat(s.Deviation); }); }
                totalDeviationsFromApi = allDeviations.length;

                allDeviations.forEach(deviation => {
                    const devId = deviation.Id || `UnknownDev_${Math.random()}`;
                    if (displayedDeviationIds.has(devId)) return;

                    const isAccident = deviation.MessageTypeValue === 'Accident';
                    const isRoadwork = roadworkTypeValues.includes(deviation.MessageTypeValue);

                    if (isAccident) totalAccidentsFromApi++;
                    if (isRoadwork) totalRoadworksFromApi++;

                    if (!((isAccident && showAccidents) || (isRoadwork && showRoadworks))) return; 

                    let preciseCoords = parseWktPoint(deviation.Geometry?.WGS84, devId);
                    let displayCoords = preciseCoords;
                    let isImprecise = false;
                    let markerIcon = defaultIcon; 

                    if (!displayCoords) { 
                        if (deviation.CountyNo && deviation.CountyNo.length > 0) {
                            const firstCountyNo = deviation.CountyNo[0];
                            const countyForImpreciseMarker = countyList.find(c => c.number === firstCountyNo);
                            if (countyForImpreciseMarker && countyForImpreciseMarker.coords) {
                                let baseLat = countyForImpreciseMarker.coords[0];
                                let baseLon = countyForImpreciseMarker.coords[1];
                                isImprecise = true;

                                // Deterministisk offset baserat på LocationDescriptor eller Header
                                const descriptorForHash = deviation.LocationDescriptor || deviation.Header || devId;
                                const hash = simpleStringHash(descriptorForHash);
                                
                                // Skapa en liten, men unik, förskjutning från länets mittpunkt
                                // Max offset ca 0.01 grader (ca 1km), justera `deterministicOffsetScale` vid behov
                                const deterministicOffsetScale = 0.005; 
                                const offsetX = ((hash % 1000) / 1000 - 0.5) * 2 * deterministicOffsetScale; // -0.005 till +0.005
                                const offsetY = (((hash / 1000) % 1000) / 1000 - 0.5) * 2 * deterministicOffsetScale;
                                
                                baseLat += offsetY;
                                baseLon += offsetX;

                                // Slumpmässig jitter ovanpå den deterministiska offseten
                                const randomJitterAmount = 0.0005; // Ca 50 meter
                                displayCoords = [
                                    baseLat + (Math.random() - 0.5) * randomJitterAmount,
                                    baseLon + (Math.random() - 0.5) * randomJitterAmount
                                ];
                                
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
                    
                    // ... (resten av popup-logiken och markörskapandet är oförändrat)
                    const countyNumbers = deviation.CountyNo;
                    let countyNames = 'N/A';
                    if (Array.isArray(countyNumbers)) { countyNames = countyNumbers.map(num => countyNumberToName[num] || `Okänt län (${num})`).join(', '); }
                    else if (countyNumbers) { countyNames = countyNumberToName[countyNumbers] || `Okänt län (${countyNumbers})`; }

                    let devPopupContent = `<b>${deviation.Header || 'Händelse'}</b> (${deviation.MessageType || deviation.MessageTypeValue || 'Okänd typ'})<br>`;
                    if (isImprecise) { devPopupContent += `<span style="color: orange; font-weight: bold;">OBS! Positionen är ungefärlig (visar område i län).</span><br>`; }
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
                    
                    markerClusterGroup.addLayer(L.marker(displayCoords, { icon: markerIcon }).bindPopup(devPopupContent));
                    displayedDeviationIds.add(devId);

                    if (isAccident) {
                        if (isImprecise) impreciseAccidentMarkersOnMap++; else accidentMarkersOnMap++;
                    } else if (isRoadwork) {
                        if (isImprecise) impreciseRoadworkMarkersOnMap++; else roadworkMarkersOnMap++;
                    }
                });
            }

            // ... (Bearbetning av TrafficSafetyCamera är oförändrad) ...
            if (results.length > 1 && results[1].TrafficSafetyCamera) {
                const cameras = results[1].TrafficSafetyCamera;
                if (Array.isArray(cameras)) { 
                    totalSafetyCamerasFromApi = cameras.length;
                    if (showCameras) {
                        cameras.forEach(camera => {
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
        
        // ... (Logik för att bygga statusmeddelande är oförändrad) ...
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
            message = `Visar ${messageParts.join(' och ')} för ${countyDisplayName}.`;
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
            if (!showAccidents && totalAccidentsFromApi > 0) noDataReason += `${totalAccidentsFromApi} ${totalAccidentsFromApi === 1 ? "olycka dold" : "olyckor dolda"}. `;
            if (!showRoadworks && totalRoadworksFromApi > 0) noDataReason += `${totalRoadworksFromApi} ${totalRoadworksFromApi === 1 ? "vägarbete dolt" : "vägarbeten dolda"}. `;
            if (!showCameras && totalSafetyCamerasFromApi > 0) noDataReason += `${totalSafetyCamerasFromApi} ${totalSafetyCamerasFromApi === 1 ? "fartkamera dold" : "fartkameror dolda"}. `;
            if (noDataReason) { message = noDataReason.trim(); }
            else if (totalDeviationsFromApi > 0 || totalSafetyCamerasFromApi > 0) { message = `Inga händelser med positionsdata att visa på kartan för ${countyDisplayName} just nu (med aktiva filter).`; }
            else { message = `Inga trafikstörningar eller fartkameror rapporterade för ${countyDisplayName} just nu.`; }
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
