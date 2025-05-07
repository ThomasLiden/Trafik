// map.js
export function useTrafficMap(apiUrl, countyList, countyNumberToName) {
    console.log("useTrafficMap initialized with apiUrl:", apiUrl);

    let mapInstance = null;
    let trafficMarkersLayer = L.featureGroup();

    const TRAFIKVERKET_ICON_BASE_URL = "https://api.trafikinfo.trafikverket.se/v1/icons/";

    // --- Ikoner ---
    // Blå standard (fallback för händelser etc.)
    const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    // Röd (fallback för fartkameror)
    const defaultTrafficSafetyCameraIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    // Funktion för att initiera kartan 
    const initMap = (mapElementId) => {
         console.log("Initializing Leaflet map...");
         if (!mapInstance && document.getElementById(mapElementId)) {
             mapInstance = L.map(mapElementId).setView([62.0, 15.0], 5);
             L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                 maxZoom: 19,
                 attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
             }).addTo(mapInstance);
             trafficMarkersLayer.addTo(mapInstance);
             console.log("Map initialized.");
         } else if (mapInstance) { console.log("Map already initialized."); }
         else { console.error(`Map element with ID '${mapElementId}' not found.`); }
    };

    // Helper-funktion för att parsa WKT POINT 
    const parseWktPoint = (wktString, objectIdForLog = 'Unknown') => {
         if (!wktString || typeof wktString !== 'string') { if (wktString) console.warn(`Invalid WKT input type for ID ${objectIdForLog}:`, typeof wktString); return null; }
         const match = wktString.match(/POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/i);
         if (match && match[1] && match[2]) { try { const lon = parseFloat(match[1]); const lat = parseFloat(match[2]); if (isNaN(lon) || isNaN(lat) || lat < -90 || lat > 90 || lon < -180 || lon > 180) { console.warn("Invalid coordinates parsed from WKT:", wktString, `(Lat: ${lat}, Lon: ${lon}) for ID ${objectIdForLog}`); return null; } return [lat, lon]; } catch (e) { console.error("Could not parse coordinates from WKT:", wktString, `for ID ${objectIdForLog}`, e); return null; } }
         else { if (wktString.trim()) console.warn("WGS84 WKT string format not recognized:", wktString, `for ID ${objectIdForLog}`); return null; }
    };

    // Funktion för att hämta och visa trafikdata 
    const updateMapWithTrafficData = async (selectedCountyValue) => {
        const logPrefix = `[County: ${selectedCountyValue || 'All'}]`;
        console.log(`${logPrefix} Attempting to fetch traffic info...`);
        if (!mapInstance) { console.warn(`${logPrefix} Map not initialized.`); return; }

        // Bygg URL 
        let url = apiUrl; const params = new URLSearchParams();
        if (selectedCountyValue) { params.append('county', selectedCountyValue); }
        params.append('messageTypeValue', 'Accident,Roadwork');
        const queryString = params.toString();
        if (queryString) { url += (apiUrl.includes('?') ? '&' : '?') + queryString; }
        console.log(`${logPrefix} Fetching from constructed URL: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            const backendResponse = await response.json();

            trafficMarkersLayer.clearLayers();
            let addedMarkers = [];
            console.log(`${logPrefix} Cleared previous markers.`);

            const results = backendResponse?.RESPONSE?.RESULT;

            if (results && Array.isArray(results)) {
                console.log(`${logPrefix} Processing ${results.length} result sets.`);
                let deviationCount = 0;
                let trafficSafetyCameraCount = 0;

                // --- 1. Bearbeta Situationer/Deviations (Olyckor, Vägarbeten etc.) ---
                if (results.length > 0 && results[0].Situation) {
                    const situationArray = results[0].Situation;
                    let allDeviations = [];
                    if (Array.isArray(situationArray)) {
                        situationArray.forEach(s => {
                            if (s?.Deviation) allDeviations = allDeviations.concat(s.Deviation);
                        });
                    }
                    deviationCount = allDeviations.length;

                    allDeviations.forEach(deviation => {
                        const devId = deviation.Id || 'Unknown Dev';
                        const coords = parseWktPoint(deviation.Geometry?.WGS84, devId);
                        if (!coords) return;

                        let icon = defaultIcon;
                        if (deviation.IconId) {
                            try {
                                icon = L.icon({
                                    iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${deviation.IconId}?type=png32x32`,
                                    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
                                });
                            } catch(e) { console.error(`Icon error for Deviation ${devId}:`, e); }
                        }

                        const countyNumbers = deviation.CountyNo;
                        let countyNames = 'N/A';
                        if (Array.isArray(countyNumbers)) {
                            countyNames = countyNumbers.map(num => countyNumberToName[num] || `Okänt län (${num})`).join(', ');
                        } else if (countyNumbers) {
                            countyNames = countyNumberToName[countyNumbers] || `Okänt län (${countyNumbers})`;
                        }

                        // UTÖKAD POPUP FÖR DEVIATION
                        let devPopupContent = `<b>${deviation.Header || 'Händelse'}</b> (${deviation.MessageTypeValue || 'Okänd typ'})<br>`;
                        if (deviation.Message) devPopupContent += `Meddelande: ${deviation.Message}<br>`;
                        if (deviation.SeverityText) devPopupContent += `Allvarlighetsgrad: ${deviation.SeverityText}<br>`;

                        let roadInfo = '';
                        if (deviation.RoadNumber) roadInfo += deviation.RoadNumber;
                        if (deviation.RoadName) roadInfo += (roadInfo ? ` (${deviation.RoadName})` : deviation.RoadName);
                        if (roadInfo) devPopupContent += `Väg: ${roadInfo}<br>`;

                        if (deviation.LocationDescriptor) devPopupContent += `Plats: ${deviation.LocationDescriptor}<br>`;
                        if (deviation.PositionalDescription) devPopupContent += `Beskrivning: ${deviation.PositionalDescription}<br>`;
                        
                        if (deviation.AffectedDirection) {
                            if (deviation.AffectedDirection.Description) {
                                devPopupContent += `Riktning: ${deviation.AffectedDirection.Description}<br>`;
                            } else if (deviation.AffectedDirection.Value) {
                                devPopupContent += `Riktning: ${deviation.AffectedDirection.Value}<br>`;
                            }
                        }

                        if (deviation.TrafficRestrictionType) devPopupContent += `Restriktion: ${deviation.TrafficRestrictionType}<br>`;
                        if (deviation.NumberOfLanesRestricted !== undefined) devPopupContent += `Påverkade körfält: ${deviation.NumberOfLanesRestricted}<br>`;
                        if (deviation.TemporaryLimit) devPopupContent += `Tillfällig begränsning: ${deviation.TemporaryLimit}<br>`;

                        if (deviation.StartTime) devPopupContent += `Starttid: ${new Date(deviation.StartTime).toLocaleString('sv-SE')}<br>`;
                        if (deviation.EndTime) {
                            devPopupContent += `Beräknad sluttid: ${new Date(deviation.EndTime).toLocaleString('sv-SE')}<br>`;
                        } else if (deviation.ValidUntilFurtherNotice) {
                            devPopupContent += `Gäller tills vidare<br>`;
                        }

                        if (deviation.WebLink) devPopupContent += `<a href="${deviation.WebLink}" target="_blank">Mer information</a><br>`;
                        devPopupContent += `Län: ${countyNames}<br>`;
                        if (deviation.VersionTime) devPopupContent += `Senast uppdaterad: ${new Date(deviation.VersionTime).toLocaleString('sv-SE')}<br>`;

                        trafficMarkersLayer.addLayer(L.marker(coords, { icon: icon }).bindPopup(devPopupContent));
                        addedMarkers.push(1);
                    });
                }

                // --- 2. Bearbeta Fartkameror (TrafficSafetyCamera) ---
                if (results.length > 1 && results[1].TrafficSafetyCamera) {
                    const cameras = results[1].TrafficSafetyCamera;
                    if (Array.isArray(cameras)) {
                        trafficSafetyCameraCount = cameras.length;
                        cameras.forEach(camera => {
                            const camId = camera.Id || 'Unknown SafetyCam';
                            const coords = parseWktPoint(camera.Geometry?.WGS84, camId);
                            if (!coords) return;

                            let icon = defaultTrafficSafetyCameraIcon;
                            if (camera.IconId) {
                                try {
                                    icon = L.icon({
                                        iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${camera.IconId}?type=png32x32`,
                                        iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16]
                                    });
                                } catch(e) { console.error(`Icon error for SafetyCamera ${camId}:`, e); }
                            }

                            const countyNum = camera.CountyNo;
                            const countyName = countyNum ? (countyNumberToName[countyNum] || `Okänt län (${countyNum})`) : 'Okänt län';

                            // ENKEL POPUP FÖR TRAFFICSAFETYCAMERA (ej utökad)
                            let camPopupContent = `<b>Fartkamera</b><br>`;
                            if (camera.Name) camPopupContent += `Namn: ${camera.Name}<br>`;
                            else if (camId !== 'Unknown SafetyCam') camPopupContent += `ID: ${camId}<br>`;
                            // Bearing är ett av de grundläggande fälten
                            if (camera.Bearing !== undefined && camera.Bearing !== null) {
                                camPopupContent += `Riktning (grader): ${camera.Bearing}°<br>`;
                            }
                            camPopupContent += `Län: ${countyName}`;

                            trafficMarkersLayer.addLayer(L.marker(coords, { icon: icon }).bindPopup(camPopupContent));
                            addedMarkers.push(1);
                        });
                    }
                }

                console.log(`${logPrefix} Processing summary: Deviations processed: ${deviationCount}. Speed Cameras processed: ${trafficSafetyCameraCount}.`);
            } else {
                console.log(`${logPrefix} No RESPONSE.RESULT array found or it was empty.`);
            }

            if (addedMarkers.length > 0) {
                console.log(`${logPrefix} Added ${addedMarkers.length} total markers with coordinates to the map.`);
                try {
                    mapInstance.fitBounds(trafficMarkersLayer.getBounds(), { padding: [50, 50], maxZoom: 16 });
                } catch (boundsError) {
                     console.error(`${logPrefix} Could not fit map bounds:`, boundsError);
                     if (selectedCountyValue) centerMapOnCounty(selectedCountyValue);
                     else mapInstance.setView([62.0, 15.0], 5);
                }
            } else {
                console.log(`${logPrefix} No markers with valid coordinates were added. Centering on selected county or default.`);
                if (selectedCountyValue) centerMapOnCounty(selectedCountyValue);
                else mapInstance.setView([62.0, 15.0], 5);
            }
        } catch (error) {
            console.error(`${logPrefix} Error fetching or displaying traffic info:`, error);
             if (mapInstance) {
                 if (selectedCountyValue) centerMapOnCounty(selectedCountyValue);
                 else mapInstance.setView([62.0, 15.0], 5);
             }
        }
    };

    const centerMapOnCounty = (selectedCountyValue) => {
         if (!mapInstance) return;
         const countyInfo = countyList.find(c => c.value === selectedCountyValue);
         if (countyInfo && countyInfo.coords && typeof countyInfo.zoom === 'number') {
             const displayName = countyInfo.name || countyInfo.text || selectedCountyValue;
             mapInstance.setView(countyInfo.coords, countyInfo.zoom);
         } else {
             mapInstance.setView([62.0, 15.0], 5);
         }
    };

    return {
        initMap,
        updateMapWithTrafficData,
        centerMapOnCounty
    };
}