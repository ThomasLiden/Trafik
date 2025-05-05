export function useTrafficMap(apiUrl, countyList, countyNumberToName) {
    // apiUrl förväntas vara "http://<host>:<port>/api/traffic-info"
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
    // Grön (fallback för allmänna/väglagskameror)
    const defaultGeneralCameraIcon = L.icon({ // Omdöpt från roadConditionCameraIcon
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-green.png',
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
        params.append('messageTypeValue', 'Accident,Roadwork'); // Hämta alltid dessa typer
        const queryString = params.toString();
        if (queryString) { url += (apiUrl.includes('?') ? '&' : '?') + queryString; }
        console.log(`${logPrefix} Fetching from constructed URL: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) { /* felhantering */ throw new Error(`HTTP error! status: ${response.status}`); }
            const backendResponse = await response.json();
            // console.log("Full Response:", JSON.stringify(backendResponse, null, 2));

            trafficMarkersLayer.clearLayers();
            let addedMarkers = [];
            console.log(`${logPrefix} Cleared previous markers.`);

            const results = backendResponse?.RESPONSE?.RESULT;

            if (results && Array.isArray(results)) {
                console.log(`${logPrefix} Processing ${results.length} result sets.`);

                let deviationCount = 0;
                let trafficSafetyCameraCount = 0;
                let generalCameraCount = 0;
                let addedActiveGeneralCameras = 0;
                let skippedInactiveGeneralCameras = 0;

                // --- 1. Bearbeta Situationer/Deviations ---
                if (results.length > 0 && results[0].Situation) {
                    console.log("API Response Section for Situations (Accidents/Roadworks):", JSON.stringify(results[0].Situation, null, 2));
                    const situationArray = results[0].Situation; let allDeviations = [];
                    if (Array.isArray(situationArray)) { situationArray.forEach(s => { if (s?.Deviation) allDeviations = allDeviations.concat(s.Deviation); }); }
                    deviationCount = allDeviations.length;
                    allDeviations.forEach(deviation => {
                        const devId = deviation.Id || 'Unknown Dev'; const coords = parseWktPoint(deviation.Geometry?.WGS84, devId);
                        if (!coords) return;
                        let icon = defaultIcon; if (deviation.IconId) { try { icon = L.icon({ iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${deviation.IconId}?type=png32x32`, iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }); } catch(e) {console.error("Icon error Dev:", e)} }
                        const countyNumbers = deviation.CountyNo; let countyNames = 'N/A'; if (Array.isArray(countyNumbers)) countyNames = countyNumbers.map(num => countyNumberToName[num] || `?(${num})`).join(', '); else if (countyNumbers) countyNames = countyNumberToName[countyNumbers] || `?(${countyNumbers})`;
                        const popup = `<b>${deviation.Header || 'Händelse'}</b><br>...<br>Län: ${countyNames}`;
                        trafficMarkersLayer.addLayer(L.marker(coords, { icon: icon }).bindPopup(popup)); addedMarkers.push(1); // Räkna markör
                    });
                }

                // --- 2. Bearbeta Fartkameror (TrafficSafetyCamera) ---
                if (results.length > 1 && results[1].TrafficSafetyCamera) {
                    const cameras = results[1].TrafficSafetyCamera;
                    if (Array.isArray(cameras)) {
                        trafficSafetyCameraCount = cameras.length;
                        cameras.forEach(camera => {
                            const camId = camera.Id || 'Unknown SafetyCam'; const coords = parseWktPoint(camera.Geometry?.WGS84, camId);
                            if (!coords) return;
                            let icon = defaultTrafficSafetyCameraIcon; // Röd fallback
                            if (camera.IconId) { try { icon = L.icon({ iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${camera.IconId}?type=png32x32`, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] }); } catch(e) {console.error("Icon error SafetyCam:", e)} }
                            const countyNum = camera.CountyNo; const countyName = countyNum ? (countyNumberToName[countyNum] || `?(${countyNum})`) : 'Okänt';
                            const popup = `<b>Fartkamera</b><br>Namn: ${camera.Name || camId}<br>Län: ${countyName}<br>Riktning: ${camera.Bearing ?? '?'}°`;
                            trafficMarkersLayer.addLayer(L.marker(coords, { icon: icon }).bindPopup(popup)); addedMarkers.push(1); // Räkna markör
                        });
                    }
                }

                // --- *** ÄNDRAD: 3. Bearbeta Allmänna Kameror ('Camera') *** ---
                if (results.length > 2 && results[2].Camera) { // Letar efter 'Camera' nu
                    const cameras = results[2].Camera;
                    if (Array.isArray(cameras)) {
                        generalCameraCount = cameras.length;
                        cameras.forEach(camera => {
                            const camName = camera.Name || 'Unknown GeneralCamera';

                            // *** Filtrera på Active ***
                            if (camera.Active !== true) {
                                skippedInactiveGeneralCameras++;
                                return; // Hoppa över inaktiva
                            }

                            const wktString = camera.Geometry?.WGS84;
                            const coords = parseWktPoint(wktString, camName);
                            if (!coords) return; // Hoppa över om inga koordinater

                            // Börja med GRÖN fallback-ikon
                            let markerIcon = defaultGeneralCameraIcon;
                            const iconId = camera.IconId;
                            // Försök använda API:ets ikon
                            if (iconId) {
                                try {
                                    const iconUrl = `${TRAFIKVERKET_ICON_BASE_URL}${iconId}?type=png32x32`;
                                    markerIcon = L.icon({ iconUrl: iconUrl, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
                                } catch (iconError) {
                                    console.error(`Error creating icon for General Camera IconId ${iconId}:`, iconError);
                                     // Faller tillbaka till defaultGeneralCameraIcon
                                }
                            }

                            // Popup med info
                            const countyNumbers = camera.CountyNo; // Kan vara array
                            let countyNames = 'Okänt';
                            if (Array.isArray(countyNumbers)) countyNames = countyNumbers.map(num => countyNumberToName[num] || `?(${num})`).join(', ');
                            else if (countyNumbers) countyNames = countyNumberToName[countyNumbers] || `?(${countyNumbers})`;
                            let popupContent = `<b>${camera.Type || 'Kamera'}</b><br>`;
                            popupContent += `Namn: ${camName}<br>`;
                            popupContent += `Status: ${camera.Status || '-'}<br>`;
                            popupContent += `Beskrivning: ${camera.Description || '-'}<br>`;
                            popupContent += `Län: ${countyNames}<br>`;
                            popupContent += `Riktning: ${camera.Direction !== undefined ? camera.Direction + '°' : 'Okänd'}<br>`;
                            if (camera.PhotoUrl) {
                                const photoTime = camera.PhotoTime ? new Date(camera.PhotoTime).toLocaleString('sv-SE') : 'N/A';
                                popupContent += `<a href="${camera.PhotoUrl}" target="_blank">Se bild</a> (${photoTime})`;
                            }

                            const marker = L.marker(coords, { icon: markerIcon }).bindPopup(popupContent);
                            trafficMarkersLayer.addLayer(marker);
                            addedMarkers.push(marker); // Räkna markör
                            addedActiveGeneralCameras++;
                        });
                    }
                }

                // Sammanfattande loggning
                console.log(`${logPrefix} Processing summary: Events: ${deviationCount}. Speed Cameras: ${trafficSafetyCameraCount}. General Cameras Found: ${generalCameraCount} (Skipped ${skippedInactiveGeneralCameras} inactive, Added ${addedActiveGeneralCameras} active with coords).`);

            } else {
                console.log(`${logPrefix} No RESPONSE.RESULT array found or it was empty.`);
            }

            // Anpassa kartans vy (använder FeatureGroup)
            if (addedMarkers.length > 0) {
                console.log(`${logPrefix} Added ${addedMarkers.length} total markers to the map.`);
                try {
                    mapInstance.fitBounds(trafficMarkersLayer.getBounds(), { padding: [50, 50], maxZoom: 16 });
                    console.log(`${logPrefix} Successfully called fitBounds.`);
                } catch (boundsError) {
                     console.error(`${logPrefix} Could not fit map bounds:`, boundsError);
                     if (selectedCountyValue) centerMapOnCounty(selectedCountyValue); else mapInstance.setView([62.0, 15.0], 5);
                }
            } else {
                console.log(`${logPrefix} No markers with valid coordinates were added.`);
                if (selectedCountyValue) centerMapOnCounty(selectedCountyValue); else mapInstance.setView([62.0, 15.0], 5);
            }

        } catch (error) {
            console.error(`${logPrefix} Error fetching or displaying traffic info:`, error);
             if (mapInstance) { if (selectedCountyValue) centerMapOnCounty(selectedCountyValue); else mapInstance.setView([62.0, 15.0], 5); }
        }
    };

    // Funktion för att centrera kartan
    const centerMapOnCounty = (selectedCountyValue) => {
         if (!mapInstance) return;
         const countyInfo = countyList.find(c => c.value === selectedCountyValue);
         if (countyInfo && countyInfo.coords && typeof countyInfo.zoom === 'number') {
             console.log(`Centering map on ${countyInfo.text || selectedCountyValue} (${countyInfo.coords}, zoom: ${countyInfo.zoom})`);
             mapInstance.setView(countyInfo.coords, countyInfo.zoom);
         } else {
             console.log(`Centering map on default view (Sweden). Reason: County "${selectedCountyValue}" not found or missing coords/zoom.`);
             mapInstance.setView([62.0, 15.0], 5);
         }
    };

    // Returnera funktionerna
    return {
        initMap,
        updateMapWithTrafficData,
        centerMapOnCounty
    };
}