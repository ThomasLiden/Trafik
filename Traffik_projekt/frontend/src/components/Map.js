// map.js
// This file exports a function (a Vue Composition API "composable")
// that manages the Leaflet map instance and logic.

import 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; // Import Leaflet library

// This function is the composable. It takes configuration data and returns methods
// that a Vue component can call to interact with the map.
export function useTrafficMap(apiUrl, countyList, countyNumberToName) {
    let mapInstance = null; // Internal state for the Leaflet map object
    let trafficMarkers = []; // Internal state for the Leaflet marker objects

    // Function to initialize the map on a specific DOM element
    const initMap = (mapElementId) => {
        console.log("Initializing Leaflet map...");
        if (!mapInstance) {
            // Create the map instance
            mapInstance = L.map(mapElementId).setView([62.0, 15.0], 5); // Default view (Sweden)
            // Add the tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(mapInstance);
            console.log("Map initialized.");
        } else {
            console.log("Map already initialized.");
        }
    };

    // Function to fetch traffic data and update markers on the map
    const updateMapWithTrafficData = async (selectedCountyValue) => {
        console.log(`Attempting to fetch traffic data for county: ${selectedCountyValue}`);

        // Build the API URL with parameters for county and message type
        let url = apiUrl;
        const params = new URLSearchParams();

        // Find county info from the provided list based on the selected value
        const selectedCountyInfo = countyList.find(c => c.value === selectedCountyValue);
        if (selectedCountyInfo && selectedCountyInfo.value) {
             params.append('county', selectedCountyInfo.value); // Pass the county name/value to the backend
        }
        // Always filter for 'Accident' message type
        params.append('messageTypeValue', 'Accident');

        url += params.toString(); // Append parameters to the URL

        console.log("Fetching from URL:", url);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const situations = await response.json(); // Parse the JSON response
            console.log("Received data:", situations);

            // --- Map Marker Logic ---
            // Clear existing markers from the map before adding new ones
            trafficMarkers.forEach(marker => marker.remove());
            trafficMarkers = []; // Reset the array

            if (mapInstance && situations && situations.length > 0) {
                situations.forEach(situation => {
                    // Process each situation, specifically looking at its Deviations
                    if (situation.Deviation && Array.isArray(situation.Deviation)) {
                        situation.Deviation.forEach(deviation => {
                            // Use the WGS84Coordinates field provided by the backend
                            const coords = deviation.WGS84Coordinates;

                            if (coords) {
                                 // Get county name(s) from the county numbers in Deviation.County list
                                 const countyNames = (deviation.County || [])
                                     .map(num => countyNumberToName[num] || `Okänt län (${num})`)
                                     .join(', '); // Join multiple county names if present


                                // Create popup content using the deviation data
                                const popupContent = `
                                    <h3>${deviation.Header || 'Ingen rubrik'}</h3>
                                    <p>Väg: ${deviation.RoadNumber || 'N/A'}</p>
                                    <p>Typ: ${deviation.MessageType || 'N/A'} (${deviation.MessageTypeValue || 'N/A'})</p>
                                    <p>Län: ${countyNames || 'N/A'}</p>
                                    <p>Tid: ${deviation.CreationTime ? new Date(deviation.CreationTime).toLocaleString() : 'N/A'}</p>
                                `;

                                // Create a Leaflet marker at the coordinates and bind the popup
                                const marker = L.marker(coords)
                                    .addTo(mapInstance) // Add marker to the map
                                    .bindPopup(popupContent); // Attach the popup content
                                trafficMarkers.push(marker); // Store the marker instance
                            } else {
                                console.warn("Could not place event on map (missing WGS84Coordinates):", deviation.Header);
                            }
                        });
                    } else {
                        console.warn("Situation missing Deviation or Deviation is not an array:", situation);
                    }
                });
                console.log(`Added ${trafficMarkers.length} markers to the map.`);

                // --- Map Centering/Zooming Logic ---
                // If markers were added, fit the map bounds to include all markers
                if (trafficMarkers.length > 0) {
                     const group = new L.featureGroup(trafficMarkers);
                     mapInstance.fitBounds(group.getBounds(), { padding: [20, 20] }); // Add some padding around the markers
                }

            } else {
                // If no data or no markers, handle map view based on selected county
                console.log("No traffic data to display for selected county/type.");
                 const countyInfo = countyList.find(c => c.value === selectedCountyValue);
                 if (countyInfo && countyInfo.value && mapInstance) {
                     // If a county is selected but no markers, center on the county's default view
                     mapInstance.setView(countyInfo.coords, countyInfo.zoom);
                 } else if (mapInstance) {
                     // If no county is selected and no markers, revert to the default Sweden view
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

    // Function to simply center the map on a specific county's default view
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
            mapInstance.setView([62.0, 15.0], 5); // Default view (Sweden)
        }
    };

    // Return the public methods that the Vue component will use
    return {
        initMap, // Call this once in onMounted
        updateMapWithTrafficData, // Call this to fetch and display data
        centerMapOnCounty // Call this to just change the map view
    };
}