// frontend/src/components/MapView.js
import { useTrafficMap } from "./map.js";

export default {
    name: 'MapView',
    props: ['isLoggedIn'],
    emits: ['open-login', 'open-signup', 'open-account'],
    setup(props, { emit }) {
        const { ref, onMounted, watch, computed, onUnmounted } = Vue;

        const selectedCounty = ref(''); // Startar tomt, kan uppdateras av geolokalisering
        const trafficStatusMessage = ref('Laddar karta...');
        const filterShowAccidents = ref(true);
        const filterShowRoadworks = ref(true);
        const filterShowCameras = ref(true);
        const lastBackendResponse = ref(null);
        const currentIframeMode = ref('banner'); // Startar i banner som per senaste ändring
        const showFilterDropdown = ref(false);

        const counties = ref([
            { name: 'Alla län', value: '', number: null, coords: [62.0, 15.0], zoom: 5 }, // Zoom 5 för "Alla län"
            { name: 'Blekinge län', value: 'Blekinge', number: 10, coords: [56.16, 15.0], zoom: 9 },
            { name: 'Dalarnas län', value: 'Dalarna', number: 20, coords: [60.8, 14.6], zoom: 7 },
            { name: 'Gotlands län', value: 'Gotland', number: 9, coords: [57.5, 18.55], zoom: 8 },
            { name: 'Gävleborgs län', value: 'Gävleborg', number: 21, coords: [61.0, 16.5], zoom: 7 },
            { name: 'Hallands län', value: 'Halland', number: 13, coords: [56.9, 13.0], zoom: 8 },
            { name: 'Jämtlands län', value: 'Jämtland', number: 23, coords: [63.3, 14.5], zoom: 6 },
            { name: 'Jönköpings län', value: 'Jönköping', number: 6, coords: [57.6, 14.3], zoom: 8 },
            { name: 'Kalmar län', value: 'Kalmar', number: 8, coords: [57.0, 16.2], zoom: 7 },
            { name: 'Kronobergs län', value: 'Kronoberg', number: 7, coords: [56.8, 14.55], zoom: 8 },
            { name: 'Norrbottens län', value: 'Norrbotten', number: 25, coords: [67.0, 20.0], zoom: 5 },
            { name: 'Skåne län', value: 'Skåne', number: 12, coords: [55.85, 13.5], zoom: 8 },
            { name: 'Stockholms län', value: 'Stockholm', number: 1, coords: [59.33, 18.07], zoom: 8 },
            { name: 'Södermanlands län', value: 'Södermanland', number: 4, coords: [59.1, 16.8], zoom: 8 },
            { name: 'Uppsala län', value: 'Uppsala', number: 3, coords: [59.9, 17.7], zoom: 8 },
            { name: 'Värmlands län', value: 'Värmland', number: 17, coords: [59.7, 13.2], zoom: 7 },
            { name: 'Västerbottens län', value: 'Västerbotten', number: 24, coords: [64.8, 18.0], zoom: 6 },
            { name: 'Västernorrlands län', value: 'Västernorrland', number: 22, coords: [63.0, 17.8], zoom: 7 },
            { name: 'Västmanlands län', value: 'Västmanland', number: 19, coords: [59.65, 16.4], zoom: 8 },
            { name: 'Västra Götalands län', value: 'Västra Götaland', number: 14, coords: [58.2, 12.0], zoom: 7 },
            { name: 'Örebro län', value: 'Örebro', number: 18, coords: [59.35, 15.2], zoom: 8 },
            { name: 'Östergötlands län', value: 'Östergötland', number: 5, coords: [58.4, 15.7], zoom: 8 }
        ]);

        const countyNumberToName = computed(() => {
            return counties.value.reduce((map, county) => {
                if (county.number !== null) {
                    map[county.number] = county.name.replace(' län', '');
                }
                return map;
            }, {});
        });

        const {
            initMap,
            centerMapOnCounty,
            fetchTrafficDataFromServer,
            renderMarkersOnMap,
            getMapInstance
        } = useTrafficMap(
            "http://127.0.0.1:5000/api/traffic-info", // Se till att detta är din korrekta backend URL
            counties.value,
            countyNumberToName.value, // Skickar den computeade mappen som den är
            currentIframeMode // Skickar ref:en direkt
        );

        const fetchAndRenderNewData = async (countyValue) => {
            trafficStatusMessage.value = "Hämtar trafikinformation...";
            const { success, data, message: fetchMessage } = await fetchTrafficDataFromServer(countyValue);
            if (success && data) {
                lastBackendResponse.value = data;
                const renderStatus = renderMarkersOnMap(
                    data,
                    filterShowAccidents.value,
                    filterShowRoadworks.value,
                    filterShowCameras.value,
                    countyNumberToName.value // Använder den computeade mappen
                );
                trafficStatusMessage.value = renderStatus.message;
            } else {
                lastBackendResponse.value = null;
                trafficStatusMessage.value = fetchMessage || "Kunde inte hämta trafikinformation.";
                 // Om data inte kunde hämtas, och ett län är valt, försök centrera på det länet ändå.
                // Om inget län är valt (t.ex. "Alla län"), centrera på "Alla län".
                centerMapOnCounty(countyValue || '');
            }
        };
        
        const applyFiltersAndReRender = () => {
            if (lastBackendResponse.value) {
                const renderStatus = renderMarkersOnMap(
                    lastBackendResponse.value,
                    filterShowAccidents.value,
                    filterShowRoadworks.value,
                    filterShowCameras.value,
                    countyNumberToName.value
                );
                trafficStatusMessage.value = renderStatus.message;
            } else {
                fetchAndRenderNewData(selectedCounty.value);
            }
        };

        // --- Start: Geolocation och Reverse Geocoding Logik ---
        const getCountyFromCoordinates = async (latitude, longitude) => {
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=sv&addressdetails=1`; // addressdetails=1 för mer detaljer
            
            try {
                console.log("Försöker reverse geocoding med URL:", nominatimUrl);
                const response = await fetch(nominatimUrl, {
                    headers: {
                        'User-Agent': 'TrafikkartanWebApp/1.0 (matilda.ryd@gmail.com)' // VIKTIGT: ERSÄTT MED DIN EMAIL
                    }
                });
                if (!response.ok) {
                    console.error("Nominatim API fel:", response.status, await response.text());
                    return null;
                }
                const data = await response.json();
                console.log("Nominatim svar:", data);

                if (data && data.address) {
                    // Försök först med 'state' (oftast bäst för län i Sverige från Nominatim)
                    // Sedan 'county' som kan vara kommunnamn eller ibland län.
                    // Fallback till region om inget annat finns.
                    let foundRegionName = data.address.state || data.address.county || data.address.region; 
                    
                    if (foundRegionName) {
                        console.log("Hittat regionnamn från Nominatim:", foundRegionName);

                        const matchedCounty = counties.value.find(c => {
                            const cNameNormalized = c.name.replace(' län', '').toLowerCase();
                            const foundNameNormalized = foundRegionName.replace(' län', '').toLowerCase();
                            // Ibland kan Nominatim returnera t.ex. "Stockholm" för Stockholms län,
                            // eller "Västra Götaland" för Västra Götalands län.
                            return cNameNormalized === foundNameNormalized || c.value.toLowerCase() === foundNameNormalized;
                        });

                        if (matchedCounty) {
                            console.log("Matchat mot lokalt län:", matchedCounty.value);
                            return matchedCounty.value; 
                        } else {
                            console.warn("Kunde inte matcha Nominatim region till lokal lista:", foundRegionName);
                        }
                    } else {
                        console.log("Ingen 'state', 'county' eller 'region' hittades i Nominatim-svar.");
                    }
                } else {
                     console.log("Ingen 'address' data i Nominatim-svar.");
                }
                return null;
            } catch (error) {
                console.error("Fel vid reverse geocoding:", error);
                return null;
            }
        };

        const trySetCountyByGeolocation = () => {
            if (navigator.geolocation) {
                console.log("Begär geolokalisering...");
                navigator.geolocation.getCurrentPosition(async (position) => {
                    console.log("Geolokalisering lyckades:", position.coords);
                    const userCountyValue = await getCountyFromCoordinates(position.coords.latitude, position.coords.longitude);
                    if (userCountyValue) {
                        if (selectedCounty.value === '' || selectedCounty.value !== userCountyValue) {
                             // Uppdatera bara om inget län var förvalt eller om det geolokaliserade är annorlunda
                            console.log("Sätter län baserat på geolokalisering:", userCountyValue);
                            selectedCounty.value = userCountyValue;
                            // Watchen på selectedCounty kommer att trigga fetchAndRenderNewData
                        } else {
                             console.log("Geolokaliserat län är samma som redan valt, ingen ändring.", selectedCounty.value);
                             // Om inget var valt och geolokalisering inte gav resultat, eller om det är samma,
                             // och vi inte redan har laddat data för det.
                             if (!lastBackendResponse.value && selectedCounty.value === userCountyValue) {
                                 fetchAndRenderNewData(selectedCounty.value);
                             }
                        }
                    } else {
                        console.log("Kunde inte bestämma län från geolokalisering, använder standard ('Alla län' om tomt).");
                        if (selectedCounty.value === '') { 
                           fetchAndRenderNewData(''); // Ladda "Alla län"
                        } else {
                           fetchAndRenderNewData(selectedCounty.value); // Ladda redan valt län om något
                        }
                    }
                }, (error) => {
                    console.warn("Geolokaliseringsfel:", error.message);
                    if (selectedCounty.value === '') { // Ladda "Alla län" om inget är förvalt
                        fetchAndRenderNewData('');
                    } else { // Ladda det som eventuellt var förvalt om geolokalisering misslyckades
                        fetchAndRenderNewData(selectedCounty.value);
                    }
                }, {
                    enableHighAccuracy: false, 
                    timeout: 10000,        
                    maximumAge: 300000 // Acceptera cachad position upp till 5 minuter
                });
            } else {
                console.warn("Geolokalisering stöds inte av denna webbläsare.");
                if (selectedCounty.value === '') {
                    fetchAndRenderNewData(''); // Ladda "Alla län"
                } else {
                    fetchAndRenderNewData(selectedCounty.value);
                }
            }
        };
        // --- Slut: Geolocation och Reverse Geocoding Logik ---

        const handleHostMessage = (event) => {
            if (event.data && event.data.action === 'setViewMode') {
                if (currentIframeMode.value !== event.data.mode) {
                    currentIframeMode.value = event.data.mode;
                    const map = getMapInstance();
                    if (map) map.invalidateSize(true); // true för att animera om möjligt
                }
            }
        };

        watch(selectedCounty, (newValue, oldValue) => {
            console.log(`selectedCounty ändrades från "${oldValue}" till "${newValue}"`);
            // Anropa inte centerMapOnCounty direkt här, låt fetchAndRenderNewData och renderMarkersOnMap hantera det
            fetchAndRenderNewData(newValue);
        });

        watch([filterShowAccidents, filterShowRoadworks, filterShowCameras], () => {
            applyFiltersAndReRender();
        });
        
        const handleClickOutsideFilterDropdown = (event) => {
            const filterContainer = document.querySelector('.filter-dropdown-container');
            const filterButton = document.getElementById('filter-button');
            // Stäng bara om klicket är utanför både panelen OCH knappen
            if (showFilterDropdown.value && 
                filterContainer && 
                !filterContainer.contains(event.target) && 
                filterButton && 
                !filterButton.contains(event.target)) {
                showFilterDropdown.value = false;
            }
        };

        onMounted(() => {
            initMap('map');
            trySetCountyByGeolocation(); // Försöker sätta län, som sedan kan trigga fetchAndRenderNewData via watch
            // Om selectedCounty inte sätts av geo, och är '', kommer "Alla län" att användas.
            // Om selectedCounty är tomt efter geoförsök, laddas "Alla län" från error/timeout callback i trySet...
            
            window.addEventListener('message', handleHostMessage);
            document.addEventListener('click', handleClickOutsideFilterDropdown);
            // setInterval(() => fetchAndRenderNewData(selectedCounty.value), 5 * 60 * 1000); // Kan återaktiveras senare
        });

        onUnmounted(() => {
            window.removeEventListener('message', handleHostMessage);
            document.removeEventListener('click', handleClickOutsideFilterDropdown);
        });

        const requestExpansionIfNeeded = () => {
            if (currentIframeMode.value === 'banner') {
                window.parent.postMessage({ action: 'requestExpandFromIframe' }, '*');
            }
        };

        const handleOpenLogin = () => {
            requestExpansionIfNeeded();
            emit('open-login');
        };
        const handleOpenSignup = () => {
            requestExpansionIfNeeded();
            emit('open-signup');
        };
        const handleOpenAccount = () => {
            emit('open-account');
        };

        const toggleFilterDropdown = () => {
            showFilterDropdown.value = !showFilterDropdown.value;
        };

        return {
            selectedCounty,
            counties,
            trafficStatusMessage,
            filterShowAccidents,
            filterShowRoadworks,
            filterShowCameras,
            handleOpenLogin,
            handleOpenSignup,
            handleOpenAccount,
            isLoggedIn: computed(() => props.isLoggedIn),
            showFilterDropdown,
            toggleFilterDropdown
        };
    },
    template: `
      <div class="map-section">
        <div id="map"></div>
        <div class="controls">
          <div class="control-item county-selector">
            <label for="county-select">Välj län:</label>
            <select id="county-select" v-model="selectedCounty">
              <option v-for="county in counties" :key="county.value" :value="county.value">{{ county.name }}</option>
            </select>
          </div>

          <div class="control-item filter-dropdown-container">
            <button @click="toggleFilterDropdown" id="filter-button" type="button" class="button-secondary filter-toggle-btn">
              Filter <span class="filter-arrow">{{ showFilterDropdown ? '&#9650;' : '&#9660;' }}</span>
            </button>
            <div v-if="showFilterDropdown" class="filter-dropdown-panel">
              <label class="filter-dropdown-item">
                <input type="checkbox" v-model="filterShowAccidents" /> Olyckor
              </label>
              <label class="filter-dropdown-item">
                <input type="checkbox" v-model="filterShowRoadworks" /> Vägarbeten
              </label>
              <label class="filter-dropdown-item">
                <input type="checkbox" v-model="filterShowCameras" /> Fartkameror
              </label>
            </div>
          </div>
          
          <div class="control-item traffic-status-message-container" v-if="trafficStatusMessage">
              <div class="traffic-status-message">{{ trafficStatusMessage }}</div>
          </div>
        </div>

        <div class="buttons user-actions-buttons">
        <button @click="isLoggedIn ? handleOpenAccount() : handleOpenLogin()" class="button-secondary">
          {{ isLoggedIn ? 'Min Sida' : 'Logga In' }}
        </button>
        <button @click="handleOpenSignup()" class="button-primary" v-if="!isLoggedIn">
          Prenumerera
        </button>
        </div>
     </div>
    `
};