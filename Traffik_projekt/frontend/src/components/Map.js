export function useTrafficMap(apiUrl, countyList, countyNumberToName) {
    let mapInstance = null;
    let trafficMarkersLayer = L.layerGroup(); // Lager för att hålla trafikmarkörer

    // Bas-URL för Trafikverkets ikoner
    const TRAFIKVERKET_ICON_BASE_URL = "https://api.trafikinfo.trafikverket.se/v1/icons/";

    // Standardikon om ingen specifik ikon finns eller kan laddas
    const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],    // storlek på ikonen
        iconAnchor: [12, 41],   // punkt på ikonen som motsvarar markörens position
        popupAnchor: [1, -34],  // punkt relativt iconAnchor där popupen ska öppnas
        shadowSize: [41, 41]    // storlek på skuggan
    });

    // Funktion för att initiera kartan
    const initMap = (mapElementId) => {
        console.log("Initializing Leaflet map...");
        if (!mapInstance) {
            // Skapa kartinstans och sätt vy över Sverige
            mapInstance = L.map(mapElementId).setView([62.0, 15.0], 5); // Centrera över Sverige initialt

            // Lägg till bakgrundskarta (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapInstance);

            // Lägg till lagret för trafikmarkörer till kartan
            trafficMarkersLayer.addTo(mapInstance);
            console.log("Map initialized.");
        } else {
            console.log("Map already initialized.");
        }
    };

    // Funktion för att hämta och visa trafikdata
    const updateMapWithTrafficData = async (selectedCountyValue) => {
        console.log(`Attempting to fetch traffic data for county: ${selectedCountyValue || 'All'}`);
        if (!mapInstance) {
            console.warn("Map not initialized, cannot fetch data.");
            return;
        }

        // Bygg URL för backend-API:et
        let url = apiUrl; // apiUrl är "http://127.0.0.1:5000/api/traffic-situations?"
        const params = new URLSearchParams();

        // Lägg till län om ett är valt
        const selectedCountyInfo = countyList.find(c => c.value === selectedCountyValue);
        if (selectedCountyInfo && selectedCountyInfo.value) {
             // Använd county 'value' (namnet) som skickas till backend
            params.append('county', selectedCountyInfo.value); 
        }

        // Lägg alltid till filter för meddelandetyper
        params.append('messageTypeValue', 'Accident,Roadwork'); 

        // Kombinera URL och parametrar
        url += params.toString();
        console.log("Fetching from URL:", url);

        try {
            // Hämta data från backend
            const response = await fetch(url);
            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    // Försök läsa felmeddelande från backend om det finns
                    const errorData = await response.json();
                    errorMsg += `, Message: ${errorData.error || 'No specific error message'}`;
                } catch (e) {
                    // Ignorera om det inte går att läsa JSON från felmeddelandet
                }
                throw new Error(errorMsg);
            }

            // Bearbeta JSON-svaret från backend
            const backendResponse = await response.json(); 
            console.log("Full Response from Backend:", JSON.stringify(backendResponse, null, 2)); // Logga hela svaret för felsökning

            // Rensa tidigare markörer
            trafficMarkersLayer.clearLayers();
            let addedMarkers = []; // Håller nya markörer för att anpassa kartvyn

             // --- Korrekt åtkomst till och bearbetning av datan ---
            const situationArray = backendResponse?.RESPONSE?.RESULT?.[0]?.Situation;
            let allDeviations = [];

            if (situationArray && Array.isArray(situationArray)) {
                situationArray.forEach(situation => {
                    if (situation?.Deviation && Array.isArray(situation.Deviation)) {
                        allDeviations = allDeviations.concat(situation.Deviation);
                    }
                });
                console.log(`Found a total of ${allDeviations.length} deviations.`);
            } else {
                console.log("Could not find Situation array in the expected structure or it was empty.");
            }

            if (allDeviations.length > 0) {
                allDeviations.forEach(deviation => {
                    
                    // Försök hämta och parsa WGS84-koordinater
                    const wktString = deviation.Geometry?.WGS84; 
                    let coords = null; 

                    if (wktString && typeof wktString === 'string') {
                        const match = wktString.match(/POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/i); 
                        if (match && match[1] && match[2]) {
                            try {
                                const lon = parseFloat(match[1]);
                                const lat = parseFloat(match[2]);
                                coords = [lat, lon]; // Leaflet använder [lat, lon]
                            } catch (e) {
                                console.error("Could not parse coordinates from WKT:", wktString, "for Deviation ID:", deviation.Id, e);
                            }
                        } else {
                            console.warn("WGS84 WKT string format not recognized:", wktString, "for Deviation ID:", deviation.Id);
                        }
                    } else {
                         // Logga tydligt om geometri saknas
                         if (!deviation.Geometry) {
                            console.warn(`Deviation ID: ${deviation.Id} (${deviation.Header || deviation.LocationDescriptor}) has NO Geometry field provided by the API.`);
                         } else if (!deviation.Geometry.WGS84) {
                             console.warn(`Deviation ID: ${deviation.Id} (${deviation.Header || deviation.LocationDescriptor}) has Geometry field but NO WGS84 data.`);
                         }
                    }

                    // Hämta ikon-ID
                    const iconId = deviation.IconId; 

                    // Hantera CountyNo (array)
                    const countyNumbers = deviation.CountyNo; 
                    let countyNames = 'N/A';
                    if (Array.isArray(countyNumbers) && countyNumbers.length > 0) {
                         // Använd countyNumberToName som skickades in till useTrafficMap
                        countyNames = countyNumbers.map(num => countyNumberToName[num] || `Okänt (${num})`).join(', ');
                    } else if (countyNumbers) { 
                        countyNames = countyNumberToName[countyNumbers] || `Okänt (${countyNumbers})`;
                    }

                    // Skapa markör BARA om vi har koordinater
                    if (coords) {
                        let markerIcon = defaultIcon; // Använd default som fallback
                        if (iconId) {
                            try {
                                const iconUrl = `${TRAFIKVERKET_ICON_BASE_URL}${iconId}?type=png32x32`;
                                markerIcon = L.icon({
                                    iconUrl: iconUrl,
                                    iconSize: [32, 32],
                                    iconAnchor: [16, 32], 
                                    popupAnchor: [0, -32] 
                                });
                            } catch (iconError) {
                                console.error(`Error creating icon for IconId ${iconId}:`, iconError);
                            }
                        }

                        // Skapa innehåll för popup-fönstret
                        const popupContent = `
                            <b>${deviation.Header || 'Ingen rubrik'}</b><br>
                            ${deviation.MessageType || 'Okänd typ'} (${deviation.MessageTypeValue || 'N/A'})<br>
                            Väg: ${deviation.RoadNumber || deviation.RoadName || 'N/A'}<br>
                            Plats: ${deviation.LocationDescriptor || deviation.PositionalDescription || 'Ingen beskrivning'}<br>
                            Län: ${countyNames}<br> 
                            Start: ${deviation.StartTime ? new Date(deviation.StartTime).toLocaleString() : 'N/A'}<br>
                            Skapad: ${deviation.CreationTime ? new Date(deviation.CreationTime).toLocaleString() : 'N/A'}<br>
                            ${deviation.Message ? `<hr><em>${deviation.Message}</em>` : ''}
                        `;

                        // Skapa markören och lägg till i lagret
                        const marker = L.marker(coords, { icon: markerIcon }).bindPopup(popupContent);
                        trafficMarkersLayer.addLayer(marker);
                        addedMarkers.push(marker); // Spara för att kunna anpassa vyn
                    } 
                    // Ingen else här - vi loggade redan om koordinater saknades
                }); // Slut på forEach(deviation)
            } // Slut på if (allDeviations.length > 0)

            // Anpassa kartans vy till markörerna om några lades till
            if (addedMarkers.length > 0) {
                console.log(`Added ${addedMarkers.length} markers to the map.`);
                try {
                     // Anpassa vyn till alla nya markörer med lite marginal
                    mapInstance.fitBounds(trafficMarkersLayer.getBounds(), { padding: [50, 50] }); 
                } catch (boundsError) {
                     console.error("Could not fit map bounds:", boundsError);
                     // Fallback om fitBounds misslyckas
                     if (selectedCountyValue) {
                         centerMapOnCounty(selectedCountyValue);
                     } else {
                         mapInstance.setView([62.0, 15.0], 5);
                     }
                }
            } else {
                console.log("No markers were added (likely due to missing coordinates in all deviations).");
                // Centrera kartan om inga markörer lades till
                if (selectedCountyValue) {
                    centerMapOnCounty(selectedCountyValue);
                } else {
                    mapInstance.setView([62.0, 15.0], 5); 
                }
            }

        } catch (error) {
            // Hantera fel vid hämtning eller bearbetning av data
            console.error("Error fetching or displaying traffic data:", error);
             // Försök centrera kartan även vid fel
            if (mapInstance) { // Kolla om kartan finns
                 if (selectedCountyValue) {
                    centerMapOnCounty(selectedCountyValue);
                 } else {
                    mapInstance.setView([62.0, 15.0], 5); // Centrera default
                 }
            }
        }
    }; // Slut på updateMapWithTrafficData

    // Funktion för att centrera kartan på ett valt län
    const centerMapOnCounty = (selectedCountyValue) => {
        if (!mapInstance) {
            console.warn("Map not initialized yet, cannot center.");
            return;
        }
        // Hitta länsinformationen (inklusive koordinater och zoomnivå)
        const countyInfo = countyList.find(c => c.value === selectedCountyValue);
        if (countyInfo && countyInfo.value) {
             // Om ett specifikt län är valt, centrera på det
            console.log(`Centering map on ${countyInfo.name} (${countyInfo.coords}, zoom: ${countyInfo.zoom})`);
            mapInstance.setView(countyInfo.coords, countyInfo.zoom);
        } else {
             // Om inget län är valt (eller 'Välj län'), visa hela Sverige
            console.log("Centering map on default view (Sweden).");
            mapInstance.setView([62.0, 15.0], 5); // Default vy
        }
    };

    // Returnera funktionerna som kan användas av Vue-komponenten
    return {
        initMap,
        updateMapWithTrafficData,
        centerMapOnCounty
    };
}