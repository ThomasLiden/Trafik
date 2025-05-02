import 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; // Importera Leaflet library

export function useTrafficMap(apiUrl, countyList, countyNumberToName) {
    let mapInstance = null; 
    let trafficMarkers = [];

    const initMap = (mapElementId) => {
        console.log("Initializing Leaflet map...");
        if (!mapInstance) {
            mapInstance = L.map(mapElementId).setView([62.0, 15.0], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(mapInstance);
            console.log("Map initialized.");
        } else {
            console.log("Map already initialized.");
        }
    };

    const updateMapWithTrafficData = async (selectedCountyValue) => {
        console.log(`Attempting to fetch traffic data for county: ${selectedCountyValue}`);

        let url = apiUrl;
        const params = new URLSearchParams();

        const selectedCountyInfo = countyList.find(c => c.value === selectedCountyValue);
        if (selectedCountyInfo && selectedCountyInfo.value) {
             params.append('county', selectedCountyInfo.value); // Pass the county name/value to the backend
        }
        params.append('messageTypeValue', 'Accident,Roadwork');

        url += params.toString(); 

        console.log("Fetching from URL:", url);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const situations = await response.json();
            console.log("Received data:", situations);

            // --- Map Marker Logic ---
            trafficMarkers.forEach(marker => marker.remove());
            trafficMarkers = []; // Reset the array

            if (mapInstance && situations && situations.length > 0) {
                situations.forEach(deviation => {
                    // Använd det nya fältet WGS84Coordinates som vi lägger till i backend
                    const coords = deviation.WGS84Coordinates; // Detta fält finns nu garanterat om deviation är i listan
           
                    // Hämta länsnamn från det nya fältet CountyName som vi lägger till i backend
                    const countyNames = deviation.CountyName || 'N/A'; // Backend skickar nu ett ensamt länsnamn eller 'N/A'
           
                    if (coords) { // Kollar igen ifall något oväntat hänt, men borde alltid vara sant
                         // Skapa popup-innehåll
                         const popupContent = `
                             <h3>${deviation.Header || 'Ingen rubrik'}</h3>
                             <p>Väg: ${deviation.RoadNumber || 'N/A'}</p>
                             <p>Typ: ${deviation.MessageType || 'N/A'} (${deviation.MessageTypeValue || 'N/A'})</p>
                             <p>Län: ${countyNames}</p> <p>Tid: ${deviation.CreationTime ? new Date(deviation.CreationTime).toLocaleString() : 'N/A'}</p>
                         `;
           
                         // Skapa markör vid koordinaterna
                         const marker = L.marker(coords)
                             .addTo(mapInstance)
                             .bindPopup(popupContent);
                         trafficMarkers.push(marker);
           
                     } else {
                         console.warn("Received a deviation without coordinates unexpectedly:", deviation.Header);
                     }
                });
                console.log(`La till ${trafficMarkers.value.length} markörer på kartan.`);
           
                // Centrera kartan om markörer lades till
                if (trafficMarkers.value.length > 0) {
                     const group = new L.featureGroup(trafficMarkers.value);
                     mapInstance.fitBounds(group.getBounds(), { padding: [20, 20] });
                } else if (selectedCounty.value) { // Om inga markörer men ett län är valt, centrera på det länet
                     const countyInfo = countyList.find(c => c.value === selectedCounty.value);
                     if (countyInfo && mapInstance) {
                         mapInstance.setView(countyInfo.coords, countyInfo.zoom);
                     }
                }
           
           
            } else {
                console.log("Ingen trafikdata att visa för valt län/typ.");
                 // Om inget län är valt, centrera på standardvyn
                const countyInfo = countyList.find(c => c.value === selectedCounty.value);
                if (countyInfo && mapInstance) {
                     mapInstance.setView(countyInfo.coords, countyInfo.zoom);
                } else if (mapInstance) {
                     // Centrera på Sverige om inget län är valt och inga markörer finns
                     mapInstance.setView([62.0, 15.0], 5);
                }
            }

        } catch (error) {
            console.error("Error fetching or displaying traffic data:", error);
             // Also handle map view if an error occurs during fetch
             const countyInfo = countyList.find(c => c.value === selectedCountyValue);
             if (countyInfo && countyInfo.value && mapInstance) {
                 mapInstance.setView(countyInfo.coords, countyInfo.zoom);
             } else if (mapInstance) {
                  mapInstance.setView([62.0, 15.0], 5);
             }
        }
    };

    // Function att centrera kartan via county
    const centerMapOnCounty = (selectedCountyValue) => {
        if (!mapInstance) {
            console.warn("Map not initialized yet, cannot center.");
            return;
        }

        const countyInfo = countyList.find(c => c.value === selectedCountyValue);
        if (countyInfo) {
            console.log(`Centering map on ${countyInfo.name} (${countyInfo.coords}, zoom: ${countyInfo.zoom})`);
            mapInstance.setView(countyInfo.coords, countyInfo.zoom);
        } else {
            console.log("Centering map on default view (Sweden).");
            mapInstance.setView([62.0, 15.0], 5); 
        }
    };

    return {
        initMap, 
        updateMapWithTrafficData, 
        centerMapOnCounty 
    };
}