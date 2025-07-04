// frontend/src/components/map.js

// Denna fil innehåller all logik för att hantera kartan (Leaflet) och interagera med Trafikverkets API
// för att hämta och visa trafikinformation.

// Exporterar en funktion som fungerar som en "hook" för Vue-komponenter.
// Den returnerar funktioner och tillstånd som en komponent kan använda för att hantera kartan.
// NYTT: Tar emot currentIframeModeRef som en Vue Ref. Denna ref är reaktiv och uppdateras när iframe-läget ändras
// i föräldrakomponenten (MapView).
export function useTrafficMap(apiUrl, countyListSource, initialCountyNumberToName, currentIframeModeRef) {
    // Variabler för att hålla kartinstansen och markörklustergruppen. Dessa är null initialt.
    let mapInstance = null;
    let markerClusterGroup = null;

    // Bas-URL för Trafikverkets ikoner.
    const TRAFIKVERKET_ICON_BASE_URL = "https://api.trafikinfo.trafikverket.se/v2/icons/";

    // Standardikon för generiska markörer.
    const defaultIcon = L.icon({ /* ...din ikon ... */
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    // Standardikon för fartkameror (exempel: röd).
    const defaultTrafficSafetyCameraIcon = L.icon({  /* ...din ikon ... */
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-red.png', // Exempel: röd ikon
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    // Array med värden som identifierar olika typer av vägarbeten från Trafikverkets API.
    const roadworkTypeValues = ['Roadwork', 'MaintenanceWorks', 'ConstructionWork', 'RoadResurfacing'];

    // En enkel hash-funktion för att generera deterministiska (men slumpmässigt utspridda) offset-koordinater
    // när den exakta positionen för en händelse inte finns tillgänglig (t.ex. för länsvis position).
    function simpleStringHash(str) { /* ...din hashfunktion ... */
        let hash = 0;
        if (!str || str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash);
    }

    /**
     * Initierar Leaflet-kartan i det angivna HTML-elementet.
     * @param {string} mapElementId - ID:t för div-elementet där kartan ska renderas.
     */
    const initMap = (mapElementId) => { /* ...din initMap-logik ... */
         console.log("Initializing Leaflet map...");
         // Kontrollerar om kartan redan är initierad och om HTML-elementet finns.
         if (!mapInstance && document.getElementById(mapElementId)) {
             // Skapar en ny Leaflet-karta med en initial vy över Sverige.
             mapInstance = L.map(mapElementId).setView([62.0, 15.0], 5); // Startvy (lat, lon, zoom)
             // Lägger till ett OpenStreetMap-lager (kartbilderna).
             L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                 maxZoom: 19, // Maximal zoomnivå.
                 attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' // Obligatorisk attribuering.
             }).addTo(mapInstance);
             // Skapar en MarkerClusterGroup för att klustra markörer när det är många på samma område.
             markerClusterGroup = L.markerClusterGroup({
                spiderfyOnMaxZoom: true, // Markörer sprider ut sig vid maximal zoom.
                showCoverageOnHover: false, // Visar inte klustrets täckning vid hovring.
                zoomToBoundsOnClick: true, // Zoomar in till klustrets gränser vid klick.
             });
             // Lägger till klustergruppen till kartan.
             mapInstance.addLayer(markerClusterGroup);
             console.log("Map initialized with MarkerClusterGroup.");
         } else if (mapInstance) { console.log("Map already initialized."); }
         else { console.error(`Map element with ID '${mapElementId}' not found.`); }
    };

    /**
     * Parsar en WKT (Well-Known Text) POINT-sträng till Leaflet-kompatibla koordinater [lat, lon].
     * @param {string} wktString - WKT POINT-strängen (t.ex. "POINT (lon lat)").
     * @param {string} objectIdForLog - En identifierare för loggningssyften vid fel.
     * @returns {Array<number, number>|null} Array med [lat, lon] eller null om parsing misslyckas.
     */
    const parseWktPoint = (wktString, objectIdForLog = 'UnknownPoint') => { /* ...din parseWktPoint-logik ... */
         if (!wktString || typeof wktString !== 'string') { return null; }
         // Använder regex för att extrahera longitud och latitud.
         const match = wktString.match(/POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/i);
         if (match && match[1] && match[2]) {
             try {
                 const lon = parseFloat(match[1]); // Longitud är först i WKT Point.
                 const lat = parseFloat(match[2]); // Latitud är sedan.
                 // Validerar koordinaternas intervall.
                 if (isNaN(lon) || isNaN(lat) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                     console.warn(`[parseWktPoint] Invalid coordinates for ${objectIdForLog}: Lat ${lat}, Lon ${lon}. WKT: ${wktString}`);
                     return null;
                 }
                 return [lat, lon]; // Leaflet använder [lat, lon].
             } catch (e) {
                 console.error(`[parseWktPoint] Could not parse coordinates for ${objectIdForLog}: ${wktString}`, e);
                 return null;
             }
         } else {
             // Varnar om strängen inte är tom och inte ser ut som en POINT WKT.
             if (wktString.trim() && !wktString.toUpperCase().startsWith("POINT")) {
                console.warn(`[parseWktPoint] WKT string format not recognized for ${objectIdForLog}: ${wktString}`);
             }
             return null;
         }
    };

    /**
     * Parsar en WKT LINESTRING-sträng till en array av Leaflet-kompatibla koordinatpar.
     * @param {string} wktString - WKT LINESTRING-strängen (t.ex. "LINESTRING (lon1 lat1, lon2 lat2)").
     * @param {string} objectIdForLog - En identifierare för loggningssyften vid fel.
     * @returns {Array<Array<number, number>>|null} Array av [lat, lon] par eller null.
     */
    const parseWktLineString = (wktString, objectIdForLog = 'UnknownLine') => { /* ...din parseWktLineString-logik ... */
        if (!wktString || typeof wktString !== 'string') { return null; }
        const match = wktString.match(/LINESTRING\s*\((.*)\)/i);
        if (match && match[1]) {
            const coordPairsStr = match[1].split(','); // Delar upp strängen i individuella koordinatpar.
            const coordinates = [];
            for (const pairStr of coordPairsStr) {
                const coords = pairStr.trim().split(/\s+/); // Delar upp varje par i longitud och latitud.
                if (coords.length === 2) {
                    try {
                        const lon = parseFloat(coords[0]);
                        const lat = parseFloat(coords[1]);
                        // Validerar koordinaternas intervall.
                        if (isNaN(lon) || isNaN(lat) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                            console.warn(`[parseWktLineString] Invalid coordinate pair in LINESTRING for ${objectIdForLog}: Lon ${lon}, Lat ${lat}. Original pair: "${pairStr}"`);
                            continue; // Hoppar över detta par och fortsätter med nästa.
                        }
                        coordinates.push([lat, lon]); // Lägger till [lat, lon] till resultatet.
                    } catch (e) {
                        console.error(`[parseWktLineString] Could not parse coordinate pair "${pairStr}" in LINESTRING for ${objectIdForLog}`, e);
                        return null; // Vid fel i ett par, avbryt hela parsing.
                    }
                } else {
                    console.warn(`[parseWktLineString] Malformed coordinate pair "${pairStr}" in LINESTRING for ${objectIdForLog}`);
                    return null; // Vid felformat par, avbryt.
                }
            }
            return coordinates.length > 0 ? coordinates : null; // Returnerar arrayen om den innehåller koordinater.
        } else {
            // Varnar om strängen inte är tom och inte ser ut som en LINESTRING WKT.
            if (wktString.trim() && !wktString.toUpperCase().startsWith("LINESTRING")) {
                console.warn(`[parseWktLineString] WKT string format not recognized for ${objectIdForLog}: ${wktString}`);
            }
            return null;
        }
    };

    /**
     * Hämtar trafikdata från backend-servern.
     * @param {string} selectedCountyValue - Värdet för det valda länet (t.ex. 'Stockholm' eller tomt för alla).
     * @returns {Promise<object>} Ett objekt med status, data och ett meddelande.
     */
    const fetchTrafficDataFromServer = async (selectedCountyValue) => { /* ...din fetchTrafficDataFromServer-logik ... */
        const logPrefix = `[FetchData][County: ${selectedCountyValue || 'All'}]`;
        let url = apiUrl;
        const params = new URLSearchParams();
        if (selectedCountyValue) {
            params.append('county', selectedCountyValue); // Lägger till län som parameter om valt.
        }
        // Specificerar vilka meddelandetyper vi vill hämta.
        params.append('messageTypeValue', 'Accident,Roadwork,MaintenanceWorks,ConstructionWork,RoadResurfacing,TrafficSafetyCamera');

        const queryString = params.toString();
        if (queryString) {
            url += (apiUrl.includes('?') ? '&' : '?') + queryString; // Lägger till query-strängen till URL:en.
        }

        console.log(`${logPrefix} Fetching from URL: ${url}`);
        try {
            const response = await fetch(url); // Gör API-anropet.
            if (!response.ok) { // Om svaret inte är OK (t.ex. 404, 500).
                const errorText = await response.text();
                console.error(`${logPrefix} HTTP error! status: ${response.status}`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const backendResponse = await response.json(); // Parsar JSON-svaret.
            return { success: true, data: backendResponse, message: "Data hämtad." };
        } catch (error) {
            console.error(`${logPrefix} Error fetching traffic info:`, error);
            return { success: false, data: null, message: "Kunde inte hämta trafikinformation från servern." };
        }
    };

    // NYTT: Funktion för att generera popup-innehåll baserat på iframe-läget.
    // Detta tillåter att visa mer detaljerad information i "expanded"-läge.
    /**
     * Skapar HTML-innehållet för en popup för en trafikhändelse (olycka, vägarbete).
     * Innehållet anpassas beroende på om kartan är i "banner"- eller "expanded"-läge.
     * @param {object} deviation - Trafikhändelseobjektet från Trafikverket.
     * @param {string} countyNames - Län(en) som händelsen berör.
     * @param {boolean} isImprecise - True om positionen är ungefärlig (länscentrerad).
     * @returns {string} HTML-sträng för popupen.
     */
    const createDeviationPopupContent = (deviation, countyNames, isImprecise) => {
        let content = `<h3>${deviation.Header || 'Händelse'}</h3>`; // Händelsens rubrik.
        content += `<strong>Typ:</strong> ${deviation.MessageType || deviation.MessageTypeValue || 'Okänd'}<br>`; // Typ av händelse.
        if (isImprecise) { content += `<strong style="color: orange;">Position är ungefärlig (länsnivå)</strong><br>`; } // Varning för ungefärlig position.

        // Kolla currentIframeModeRef.value (det är en Vue ref) för att anpassa innehållet.
        if (currentIframeModeRef.value === 'banner') {
            // I banner-läge, visa en kortare version och en uppmaning att expandera.
            content += `<p style="font-style: italic; color: #333; margin-top: 5px;">Utöka Kartan (⬈) för att se specifik information om trafikhändelse.</p>`;
        } else { // 'expanded' mode (utökat läge)
            // I utökat läge, visa fullständiga detaljer.
            if (deviation.Message) content += `<strong>Info:</strong> ${deviation.Message}<br>`;
            if (deviation.SeverityText) content += `<strong>Allvarlighetsgrad:</strong> ${deviation.SeverityText}<br>`;

            let roadInfo = '';
            if (deviation.RoadNumber) roadInfo += deviation.RoadNumber;
            if (deviation.RoadName) roadInfo += (roadInfo ? ` (${deviation.RoadName})` : deviation.RoadName);
            if (roadInfo) content += `<strong>Väg:</strong> ${roadInfo}<br>`;

            if (deviation.LocationDescriptor) content += `<strong>Plats:</strong> ${deviation.LocationDescriptor}<br>`;
            if (deviation.AffectedDirection) {
                const dir = deviation.AffectedDirection.Description || deviation.AffectedDirection.Value || deviation.AffectedDirection;
                content += `<strong>Riktning:</strong> ${dir}<br>`;
            }
            if (deviation.StartTime) content += `<strong>Start:</strong> ${new Date(deviation.StartTime).toLocaleString('sv-SE')}<br>`;
            if (deviation.EndTime) { content += `<strong>Slut (beräknad):</strong> ${new Date(deviation.EndTime).toLocaleString('sv-SE')}<br>`; }
            else if (deviation.ValidUntilFurtherNotice) { content += `<strong>Gäller:</strong> Tills vidare<br>`; }
            if (deviation.WebLink) content += `<a href="${deviation.WebLink}" target="_blank" rel="noopener noreferrer">Mer information (Trafikverket)</a><br>`;
        }
        content += `<strong>Län:</strong> ${countyNames}<br>`;
        if (deviation.VersionTime && currentIframeModeRef.value === 'expanded') { // Visa bara versionstid i expanded
             content += `<small>Uppdaterad: ${new Date(deviation.VersionTime).toLocaleString('sv-SE')}</small><br>`;
        }
        return content;
    };

    /**
     * Skapar HTML-innehållet för en popup för en fartkamera.
     * Innehållet anpassas beroende på om kartan är i "banner"- eller "expanded"-läge.
     * @param {object} camera - Fartkameraobjektet från Trafikverket.
     * @param {string} countyName - Län(et) där kameran finns.
     * @returns {string} HTML-sträng för popupen.
     */
    const createCameraPopupContent = (camera, countyName) => {
        let content = `<h3>Fartkamera</h3>`;
        if (camera.Name) content += `<strong>Namn:</strong> ${camera.Name}<br>`;
        // Anpassar informationen baserat på iframe-läget.
        if (currentIframeModeRef.value === 'expanded') {
            if (camera.Bearing !== undefined) content += `<strong>Riktning:</strong> ${camera.Bearing}°<br>`;
            if (camera.SpeedLimit) content += `<strong>Hastighet:</strong> ${camera.SpeedLimit} km/h<br>`;
        } else {
             if (camera.SpeedLimit) content += `<strong>Hastighet:</strong> ${camera.SpeedLimit} km/h<br>`;
             content += `<p style="font-style: italic; color: #333; margin-top: 5px;">Utöka Kartan (⬈) för fler detaljer.</p>`;
        }
        content += `<strong>Län:</strong> ${countyName}`;
        return content;
    };


    /**
     * Renderar markörer på kartan baserat på hämtad data och aktuella filter.
     * @param {object} backendData - Den råa trafikdatan från backend.
     * @param {boolean} showAccidents - True om olyckor ska visas.
     * @param {boolean} showRoadworks - True om vägarbeten ska visas.
     * @param {boolean} showCameras - True om fartkameror ska visas.
     * @param {object} currentCountyNumberToName - En mappning från länsnummer till länsnamn.
     * @returns {object} Ett objekt med status och ett meddelande om renderingen.
     */
    const renderMarkersOnMap = (backendData, showAccidents, showRoadworks, showCameras, currentCountyNumberToName) => {
        const logPrefix = `[RenderMarkers]`;
        // Kontrollerar att karta och klustergrupp är initierade samt att data finns.
        if (!mapInstance || !markerClusterGroup || !backendData) {
            console.warn(`${logPrefix} Prerequisites not met for rendering.`);
            return { success: false, message: "Kunde inte rendera markörer (kartan inte redo)." };
        }
        markerClusterGroup.clearLayers(); // Rensa befintliga markörer från kartan.

        // Deklaration av variabler för statistik och spårning.
        let markersAdded = 0;
        let accidentMarkersOnMap = 0, roadworkMarkersOnMap = 0, safetyCameraMarkersOnMap = 0;
        let impreciseAccidentMarkersOnMap = 0, impreciseRoadworkMarkersOnMap = 0;
        let totalDeviationsFromApi = 0, totalAccidentsFromApi = 0, totalRoadworksFromApi = 0, totalSafetyCamerasFromApi = 0;
        const displayedDeviationIds = new Set(); // Håller reda på redan visade händelser för att undvika dubletter.
        const results = backendData?.RESPONSE?.RESULT; // Extraherar resultatsektionen från backend-svaret.
        const currentSelectedCountyValue = document.getElementById('county-select')?.value || ''; // Hämtar det aktuellt valda länet från DOM.


        if (results && Array.isArray(results)) {
            // Hittar trafikinformations-situationer i resultaten.
            const situationResult = results.find(r => r.Situation);
            if (situationResult?.Situation) {
                // Hanterar både enstaka Situation-objekt och arrayer av Situation-objekt.
                const situationArray = Array.isArray(situationResult.Situation) ? situationResult.Situation : [situationResult.Situation];
                let allDeviations = [];
                // Samlar alla avvikelser (olyckor, vägarbeten etc.) från situationerna.
                situationArray.forEach(s => {
                    if (s?.Deviation && Array.isArray(s.Deviation)) {
                         allDeviations = allDeviations.concat(s.Deviation);
                    } else if (s?.Deviation) {
                        allDeviations.push(s.Deviation);
                    }
                });
                totalDeviationsFromApi = allDeviations.length;

                // Loopar igenom alla avvikelser för att lägga till markörer.
                allDeviations.forEach(deviation => {
                    const devId = deviation.Id || `UnknownDev_${Math.random().toString(36).substring(2,9)}`;
                    if (displayedDeviationIds.has(devId)) return; // Skippa om redan visad.

                    const isAccident = deviation.MessageTypeValue === 'Accident';
                    const isRoadwork = roadworkTypeValues.includes(deviation.MessageTypeValue);

                    if (isAccident) totalAccidentsFromApi++;
                    if (isRoadwork) totalRoadworksFromApi++;

                    // Filtrera bort händelser baserat på användarens filterval.
                    if (!((isAccident && showAccidents) || (isRoadwork && showRoadworks))) return;

                    let displayCoords = null;
                    let isImprecise = false; // Flagga för att indikera om positionen är ungefärlig.
                    let markerIcon = defaultIcon; // Standardikon för deviationer.

                    // Försöker först parsa en exakt punkt-koordinat (WGS84 Point).
                    const pointWGS84 = deviation.Geometry?.Point?.WGS84;
                    if (pointWGS84) {
                        displayCoords = parseWktPoint(pointWGS84, devId);
                    }

                    // Om ingen exakt punkt, försök med den första punkten från en linjesträng (WGS84 Line).
                    if (!displayCoords) {
                        const lineWGS84 = deviation.Geometry?.Line?.WGS84;
                        if (lineWGS84) {
                            const lineCoordsArray = parseWktLineString(lineWGS84, devId);
                            if (lineCoordsArray && lineCoordsArray.length > 0) {
                                displayCoords = lineCoordsArray[0]; // Tar första punkten på linjen.
                            }
                        }
                    }

                    // Om ingen koordinat kunde extraheras, använd en ungefärlig länscentrerad position.
                    if (!displayCoords) {
                        isImprecise = true;
                        if (deviation.CountyNo && deviation.CountyNo.length > 0) {
                            const firstCountyNo = deviation.CountyNo[0];
                            const countyData = countyListSource.find(c => c.number === firstCountyNo);
                            if (countyData && countyData.coords) {
                                let baseLat = countyData.coords[0];
                                let baseLon = countyData.coords[1];
                                // Använder hash-funktion för att sprida ut markörer deterministiskt inom länet.
                                const descriptorForHash = deviation.LocationDescriptor || deviation.Header || devId;
                                const hash = simpleStringHash(descriptorForHash);
                                const deterministicOffsetScale = 0.025; // Skala för slumpmässig spridning.
                                const offsetX = ((hash % 1000) / 1000 - 0.5) * 2 * deterministicOffsetScale;
                                const offsetY = (((hash / 1000) % 1000) / 1000 - 0.5) * 2 * deterministicOffsetScale;
                                displayCoords = [baseLat + offsetY, baseLon + offsetX];
                            } else { return; } // Om länsdata saknas, skippa.
                        } else { return; } // Om län saknas, skippa.
                    }

                    // Anpassar ikon baserat på Trafikverkets IconId eller faller tillbaka till standard.
                    if (deviation.IconId) {
                       try {
                           markerIcon = L.icon({
                               iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${deviation.IconId}?type=svg`,
                               iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30],
                           });
                       } catch(e) { markerIcon = defaultIcon; } // Fallback vid fel i ikon-URL.
                    } else if (isAccident) {
                        markerIcon = defaultIcon; // Specifik ikon för olyckor om ingen IconId finns.
                    } else if (isRoadwork) {
                        markerIcon = defaultIcon; // Specifik ikon för vägarbeten om ingen IconId finns.
                    }

                    if (displayCoords) {
                        const marker = L.marker(displayCoords, { icon: markerIcon }); // Skapar markören.
                        // Hämtar länsnamnen för visning i popupen.
                        const countyNames = Array.isArray(deviation.CountyNo)
                            ? deviation.CountyNo.map(num => currentCountyNumberToName[num] || `Län ${num}`).join(', ')
                            : (currentCountyNumberToName[deviation.CountyNo] || `Län ${deviation.CountyNo}`);

                        // NYTT: Binder popupen till en funktion som genererar innehållet dynamiskt.
                        // Detta gör att popupens innehåll kan anpassas när iframe-läget ändras.
                        marker.bindPopup(() => createDeviationPopupContent(deviation, countyNames, isImprecise));

                        markerClusterGroup.addLayer(marker); // Lägger till markören i klustergruppen.
                        displayedDeviationIds.add(devId); // Markerar händelsen som visad.
                        markersAdded++;

                        // Uppdaterar statistik.
                        if (isAccident) {
                            if (isImprecise) impreciseAccidentMarkersOnMap++; else accidentMarkersOnMap++;
                        } else if (isRoadwork) {
                            if (isImprecise) impreciseRoadworkMarkersOnMap++; else roadworkMarkersOnMap++;
                        }
                    }
                });
            }

            // Hittar fartkameror i resultaten.
            const cameraResult = results.find(r => r.TrafficSafetyCamera);
            if (cameraResult?.TrafficSafetyCamera && Array.isArray(cameraResult.TrafficSafetyCamera)) {
                const cameras = cameraResult.TrafficSafetyCamera;
                totalSafetyCamerasFromApi = cameras.length;
                if (showCameras) { // Om filter för kameror är aktivt.
                    cameras.forEach(camera => {
                        const camId = camera.Id || `UnknownCam_${Math.random().toString(36).substring(2,9)}`;
                        const coords = parseWktPoint(camera.Geometry?.WGS84, camId); // Parsar kamerans koordinater.
                        if (!coords) return;

                        let icon = defaultTrafficSafetyCameraIcon;
                        if (camera.IconId) { // Anpassar ikon om specifik IconId finns.
                            try {
                                icon = L.icon({
                                    iconUrl: `${TRAFIKVERKET_ICON_BASE_URL}${camera.IconId}?type=svg`,
                                    iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30]
                                });
                            } catch(e) { /* fallback */ }
                        }
                        const countyName = currentCountyNumberToName[camera.CountyNo] || `Län ${camera.CountyNo}`;

                        // NYTT: Binder popupen till en funktion som genererar innehållet dynamiskt för kameror.
                        const cameraMarker = L.marker(coords, { icon: icon })
                            .bindPopup(() => createCameraPopupContent(camera, countyName));

                        markerClusterGroup.addLayer(cameraMarker);
                        safetyCameraMarkersOnMap++;
                        markersAdded++;
                    });
                }
            }
        }

        // ... (resten av din message-logik och fitBounds etc.) ...
        // Bygger ett statusmeddelande baserat på vad som visades.
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
            message = `Visar ${messageParts.join(' och ')} för ${countyDisplayName} län.`;
            // Anpassar kartvyn för att visa alla markörer om det finns några.
            if (markerClusterGroup.getLayers().length > 0 && mapInstance.getBounds().isValid()) {
                 try {
                    // Använder setTimeout för att säkerställa att markörer har renderats helt innan bounds beräknas.
                    setTimeout(() => {
                        if (mapInstance && markerClusterGroup.getLayers().length > 0) {
                            const bounds = markerClusterGroup.getBounds();
                            if (bounds.isValid()) {
                                // Passar kartvyn till markörernas gränser.
                                mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
                            } else if (currentSelectedCountyValue) {
                                centerMapOnCounty(currentSelectedCountyValue); // Centrera på län om bounds är ogiltiga.
                            } else {
                                mapInstance.setView([62.0, 15.0], 5); // Fallback till Sverigevy.
                            }
                        }
                    }, 150); // Liten fördröjning.
                } catch (boundsError) {
                     console.error(`${logPrefix} Could not fit map bounds:`, boundsError);
                     if (currentSelectedCountyValue) centerMapOnCounty(currentSelectedCountyValue);
                     else mapInstance.setView([62.0, 15.0], 5);
                }
            } else if (currentSelectedCountyValue) {
                centerMapOnCounty(currentSelectedCountyValue); // Om inga markörer, centrera på valt län.
            }

        } else {
            // Om inga markörer visades.
            if (currentSelectedCountyValue) centerMapOnCounty(currentSelectedCountyValue);
            else mapInstance.setView([62.0, 15.0], 5); // Centrera på Sverige om inga markörer och inget län valt.

            let noDataReason = "";
            // Lägger till information om filter dolde några händelser.
            if (!showAccidents && totalAccidentsFromApi > 0) noDataReason += `${totalAccidentsFromApi} olyckor dolda. `;
            if (!showRoadworks && totalRoadworksFromApi > 0) noDataReason += `${totalRoadworksFromApi} vägarbeten dolda. `;
            if (!showCameras && totalSafetyCamerasFromApi > 0) noDataReason += `${totalSafetyCamerasFromApi} fartkameror dolda. `;

            if (noDataReason) {
                message = noDataReason.trim(); // Visar anledning om filter dolde data.
            } else {
                message = `Inga aktiva händelser eller valda filter matchar i ${countyDisplayName} just nu.`; // Standardmeddelande.
            }
        }
        return { success: success, message: message };
    };

    /**
     * Centrerar kartan på ett specifikt län eller hela Sverige.
     * @param {string} selectedCountyValue - Värdet för det län att centrera på (t.ex. 'Stockholm' eller tomt för alla).
     */
    const centerMapOnCounty = (selectedCountyValue) => { /* ...din centerMapOnCounty-logik ... */
         if (!mapInstance) return; // Gör inget om kartan inte är initierad.
         // Letar upp informationen för det valda länet.
         const countyInfo = countyListSource.find(c => c.value === selectedCountyValue);
         if (countyInfo && countyInfo.coords && typeof countyInfo.zoom === 'number') {
             mapInstance.setView(countyInfo.coords, countyInfo.zoom); // Centrerar på länets koordinater och zoomnivå.
         } else {
             // Fallback till vyn för "Alla län" om det valda länet inte hittas eller saknar koordinater.
             const allCountiesInfo = countyListSource.find(c => c.value === '');
             if (allCountiesInfo) {
                 mapInstance.setView(allCountiesInfo.coords, allCountiesInfo.zoom);
             } else {
                 mapInstance.setView([62.0, 15.0], 5); // Generell fallback till Sverigevy.
             }
         }
    };

    // NYTT: Funktion för att MapView-komponenten ska kunna komma åt den interna Leaflet-kartinstansen.
    // Detta är användbart för t.ex. `invalidateSize()` när iframens storlek ändras.
    const getMapInstance = () => mapInstance;


    // Returnerar de funktioner som MapView-komponenten kan använda.
    return {
        initMap,
        centerMapOnCounty,
        fetchTrafficDataFromServer,
        renderMarkersOnMap,
        getMapInstance // NYTT: Exponerar getMapInstance.
    };
}