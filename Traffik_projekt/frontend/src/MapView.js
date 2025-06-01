// frontend/src/components/MapView.js
// Denna fil definierar Vue-komponenten MapView, som ansvarar för att visa trafikinformation på en karta.

// Importerar funktionen useTrafficMap från './map.js'.
// Denna funktion innehåller all logik för att interagera med kartan (Leaflet) och hämta trafikdata.
import { useTrafficMap } from "./Map.js";

// Exporterar Vue-komponentens definition.
export default {
    name: 'MapView', // Namnet på komponenten. Används för debugging och i Vue DevTools.
    props: ['isLoggedIn'], // Komponentens props (egenskaper). 'isLoggedIn' tas emot från föräldrakomponenten
                           // för att veta om användaren är inloggad.
    emits: ['open-login', 'open-signup', 'open-account'], // Deklarerar vilka händelser denna komponent kan "skicka ut" (emit).
                                                          // Föräldrakomponenter kan lyssna på dessa händelser.
    setup(props, { emit }) { // `setup` är Composition API:s inträdespunkt. All logik definieras här.
        // Importerar reaktiva funktioner från Vue för att hantera tillstånd och livscykelhändelser.
        const { ref, onMounted, watch, computed, onUnmounted } = Vue;

        // --- Reaktiva tillståndsvariabler ---
        // Dessa variabler är reaktiva, vilket innebär att Vue automatiskt uppdaterar DOM när deras värden ändras.

        const selectedCounty = ref(''); // Lagrar det aktuellt valda länet. Startar tomt (representerar "Alla län").
                                      // Kan uppdateras av geolokalisering.
        const trafficStatusMessage = ref('Laddar karta...'); // Visar meddelanden om kartans laddnings- och trafikstatus.
        const filterShowAccidents = ref(true); // Filter för att visa olyckor på kartan. Standard: true (visa).
        const filterShowRoadworks = ref(true); // Filter för att visa vägarbeten på kartan. Standard: true (visa).
        const filterShowCameras = ref(true); // Filter för att visa fartkameror på kartan. Standard: true (visa).
        const lastBackendResponse = ref(null); // Lagrar den senast hämtade trafikdatan från backend.
                                              // Används för att rendera om markörer när filter ändras.
        const currentIframeMode = ref('banner'); // Håller reda på iframe-läget ('banner' eller 'expanded').
                                                // Startar i 'banner' som per senaste ändring (värdsidan sätter initialt läge).
        const showFilterDropdown = ref(false); // Styr synligheten för filter-dropdown-menyn.

        // Definierar en lista över alla län i Sverige med deras nummer, koordinater och zoomnivå.
        // Dessa används för att centrera kartan och hämta länsspecifik data.
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

        // En computed property som skapar en mappning från länsnummer till länsnamn (utan " län").
        // Detta underlättar uppslagningar och visning av namn baserat på nummer.
        const countyNumberToName = computed(() => {
            return counties.value.reduce((map, county) => {
                if (county.number !== null) {
                    map[county.number] = county.name.replace(' län', '');
                }
                return map;
            }, {});
        });

        // Hämtar funktioner från `useTrafficMap` som hanterar kartans interaktioner och datahämtning.
        const {
            initMap, // Funktion för att initiera kartan.
            centerMapOnCounty, // Funktion för att centrera kartan på ett specifikt län.
            fetchTrafficDataFromServer, // Funktion för att hämta trafikdata från backend.
            renderMarkersOnMap, // Funktion för att rendera markörer på kartan.
            getMapInstance // Funktion för att få tillgång till Leaflet-kartinstansen.
        } = useTrafficMap(
            "http://127.0.0.1:5000/api/traffic-info", // Backend-URL för trafikdata. Viktigt att den är korrekt.
            counties.value, // Skickar med listan över län.
            countyNumberToName.value, // Skickar med den computeade mappningen.
            currentIframeMode // Skickar ref:en direkt så useTrafficMap kan reagera på lägesändringar.
        );

        /**
         * Hämtar ny trafikdata och renderar om markörerna på kartan.
         * @param {string} countyValue - Värdet för det valda länet (t.ex. 'Stockholm' eller tomt för 'Alla län').
         */
        const fetchAndRenderNewData = async (countyValue) => {
            trafficStatusMessage.value = "Hämtar trafikinformation..."; // Uppdaterar statusmeddelandet.
            const { success, data, message: fetchMessage } = await fetchTrafficDataFromServer(countyValue); // Anropar backend.
            if (success && data) { // Om hämtningen lyckades och data returnerades.
                lastBackendResponse.value = data; // Sparar den råa datan.
                const renderStatus = renderMarkersOnMap( // Renderar markörerna med de aktuella filtren.
                    data,
                    filterShowAccidents.value,
                    filterShowRoadworks.value,
                    filterShowCameras.value,
                    countyNumberToName.value // Använder den computeade mappen.
                );
                trafficStatusMessage.value = renderStatus.message; // Uppdaterar statusmeddelandet baserat på render-resultatet.
            } else { // Om hämtningen misslyckades.
                lastBackendResponse.value = null; // Nollställer den sparade datan.
                trafficStatusMessage.value = fetchMessage || "Kunde inte hämta trafikinformation."; // Visar felmeddelande.
                 // Om data inte kunde hämtas, och ett län är valt, försök centrera på det länet ändå.
                // Om inget län är valt (t.ex. "Alla län"), centrera på "Alla län".
                centerMapOnCounty(countyValue || ''); // Försöker centrera kartan även vid fel.
            }
        };
        
        /**
         * Tillämpar de aktuella filtren och renderar om markörerna med den senast hämtade datan.
         * Anropas när filter-checkboxar ändras.
         */
        const applyFiltersAndReRender = () => {
            if (lastBackendResponse.value) { // Om vi har data från en tidigare backend-anrop.
                const renderStatus = renderMarkersOnMap( // Renderar om markörerna.
                    lastBackendResponse.value,
                    filterShowAccidents.value,
                    filterShowRoadworks.value,
                    filterShowCameras.value,
                    countyNumberToName.value
                );
                trafficStatusMessage.value = renderStatus.message; // Uppdaterar status.
            } else {
                // Om ingen data finns sedan tidigare (t.ex. vid första laddning eller efter ett fel),
                // försök hämta och rendera ny data baserat på det aktuella länet.
                fetchAndRenderNewData(selectedCounty.value);
            }
        };

        // --- Start: Geolocation och Reverse Geocoding Logik ---
        /**
         * Använder Nominatim (OpenStreetMap) för att omvandla koordinater till ett länsnamn.
         * @param {number} latitude - Latitud för positionen.
         * @param {number} longitude - Longitud för positionen.
         * @returns {string|null} Länsvärdet (t.ex. 'Stockholm') om det hittas, annars null.
         */
        const getCountyFromCoordinates = async (latitude, longitude) => {
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=sv&addressdetails=1`; // URL för Nominatim API
            
            try {
                console.log("Försöker reverse geocoding med URL:", nominatimUrl);
                const response = await fetch(nominatimUrl, {
                    headers: {
                        'User-Agent': 'TrafikkartanWebApp/1.0 (matilda.ryd@gmail.com)' // VIKTIGT: Ange en unik User-Agent för Nominatim
                    }
                });
                if (!response.ok) { // Kontrollerar om API-anropet var framgångsrikt.
                    console.error("Nominatim API fel:", response.status, await response.text());
                    return null;
                }
                const data = await response.json(); // Parsar svaret som JSON.
                console.log("Nominatim svar:", data);

                if (data && data.address) { // Om svaret innehåller adressdetaljer.
                    // Försöker hitta län baserat på olika fält i Nominatim-svaret.
                    // 'state' är ofta bäst för län i Sverige, 'county' kan vara kommun.
                    let foundRegionName = data.address.state || data.address.county || data.address.region; 
                    
                    if (foundRegionName) {
                        console.log("Hittat regionnamn från Nominatim:", foundRegionName);

                        // Matchar det funna regionnamnet mot vår egen lista över län.
                        const matchedCounty = counties.value.find(c => {
                            const cNameNormalized = c.name.replace(' län', '').toLowerCase();
                            const foundNameNormalized = foundRegionName.replace(' län', '').toLowerCase();
                            // Jämför normaliserade namn för att hantera "Stockholm" vs "Stockholms län".
                            return cNameNormalized === foundNameNormalized || c.value.toLowerCase() === foundNameNormalized;
                        });

                        if (matchedCounty) {
                            console.log("Matchat mot lokalt län:", matchedCounty.value);
                            return matchedCounty.value; // Returnerar det matchande länsvärdet.
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

        /**
         * Försöker bestämma användarens län med hjälp av geolokalisering.
         * Om det lyckas, uppdateras `selectedCounty` och kartan laddas om.
         */
        const trySetCountyByGeolocation = () => {
            if (navigator.geolocation) { // Kontrollerar om webbläsaren stöder geolokalisering.
                console.log("Begär geolokalisering...");
                navigator.geolocation.getCurrentPosition(async (position) => { // Hämtar användarens position.
                    console.log("Geolokalisering lyckades:", position.coords);
                    // Använder Nominatim för att översätta koordinater till ett län.
                    const userCountyValue = await getCountyFromCoordinates(position.coords.latitude, position.coords.longitude);
                    if (userCountyValue) {
                        // Uppdatera endast om inget län var förvalt, eller om det geolokaliserade länet är annorlunda.
                        if (selectedCounty.value === '' || selectedCounty.value !== userCountyValue) {
                            console.log("Sätter län baserat på geolokalisering:", userCountyValue);
                            selectedCounty.value = userCountyValue;
                            // Watchen på selectedCounty kommer att trigga fetchAndRenderNewData.
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
                        if (selectedCounty.value === '') { // Ladda "Alla län" om inget är förvalt
                           fetchAndRenderNewData('');
                        } else {
                           fetchAndRenderNewData(selectedCounty.value); // Ladda redan valt län om något
                        }
                    }
                }, (error) => { // Hanterar fel vid geolokalisering (t.ex. användaren nekade åtkomst).
                    console.warn("Geolokaliseringsfel:", error.message);
                    if (selectedCounty.value === '') { // Ladda "Alla län" om inget är förvalt
                        fetchAndRenderNewData('');
                    } else { // Ladda det som eventuellt var förvalt om geolokalisering misslyckades
                        fetchAndRenderNewData(selectedCounty.value);
                    }
                }, {
                    enableHighAccuracy: false, // Försöker få en exakt position (kan ta längre tid)
                    timeout: 10000,         // Max tid för att hämta position (10 sekunder)
                    maximumAge: 300000 // Acceptera cachad position upp till 5 minuter
                });
            } else {
                console.warn("Geolokalisering stöds inte av denna webbläsare.");
                if (selectedCounty.value === '') {
                    fetchAndRenderNewData(''); // Ladda "Alla län" om geolokalisering inte stöds.
                } else {
                    fetchAndRenderNewData(selectedCounty.value);
                }
            }
        };
        // --- Slut: Geolocation och Reverse Geocoding Logik ---

        /**
         * Hanterar meddelanden som skickas från "värdsidan" (förälder-fönstret/iframen).
         * Detta används för att synkronisera iframe-läget.
         * @param {MessageEvent} event - Meddelandeobjektet.
         */
        const handleHostMessage = (event) => {
            if (event.data && event.data.action === 'setViewMode') {
                // Om det mottagna läget är annorlunda än det aktuella, uppdatera och invalidrea kartans storlek.
                if (currentIframeMode.value !== event.data.mode) {
                    currentIframeMode.value = event.data.mode;
                    const map = getMapInstance();
                    if (map) map.invalidateSize(true); // invalidateaSize tvingar Leaflet att rita om kartan korrekt
                                                      // efter en storleksändring av dess behållare.
                }
            }
        };

        // --- Watchers ---
        // Watchers är Vue-funktioner som reagerar på ändringar i reaktiva variabler.

        // När `selectedCounty` ändras, hämta och rendera ny data för det länet.
        watch(selectedCounty, (newValue, oldValue) => {
            console.log(`selectedCounty ändrades från "${oldValue}" till "${newValue}"`);
            // Anropa inte centerMapOnCounty direkt här, låt fetchAndRenderNewData och renderMarkersOnMap hantera det
            fetchAndRenderNewData(newValue);
        });

        // När något av filter-checkboxarna ändras, applicera filtren och rendera om markörerna.
        watch([filterShowAccidents, filterShowRoadworks, filterShowCameras], () => {
            applyFiltersAndReRender();
        });
        
        /**
         * Funktion för att hantera klick utanför filter-dropdown-menyn för att stänga den.
         * @param {MouseEvent} event - Klickhändelsen.
         */
        const handleClickOutsideFilterDropdown = (event) => {
            const filterContainer = document.querySelector('.filter-dropdown-container');
            const filterButton = document.getElementById('filter-button');
            // Stäng bara om dropdown är synlig OCH klicket är utanför både panelen OCH knappen.
            if (showFilterDropdown.value && 
                filterContainer && 
                !filterContainer.contains(event.target) && 
                filterButton && 
                !filterButton.contains(event.target)) {
                showFilterDropdown.value = false;
            }
        };

        // --- Livscykel-hooks ---
        // onMounted körs när komponenten har monterats i DOM (när den är synlig).
        onMounted(() => {
            initMap('map'); // Initierar kartan i div:en med id "map".
            trySetCountyByGeolocation(); // Försöker sätta län baserat på geolokalisering vid start.
            // Om selectedCounty inte sätts av geo, och är '', kommer "Alla län" att användas.
            // Om selectedCounty är tomt efter geoförsök, laddas "Alla län" från error/timeout callback i trySet...
            
            // Lägger till en lyssnare för meddelanden från förälder-fönstret (hosten).
            window.addEventListener('message', handleHostMessage);
            // Lägger till en global klicklyssnare för att stänga filter-dropdown.
            document.addEventListener('click', handleClickOutsideFilterDropdown);
            // setInterval(() => fetchAndRenderNewData(selectedCounty.value), 5 * 60 * 1000); // Kan återaktiveras senare för automatisk uppdatering.
        });

        // onUnmounted körs när komponenten avmonteras från DOM (när den tas bort från sidan).
        // Det är viktigt att städa upp event-lyssnare för att undvika minnesläckor.
        onUnmounted(() => {
            window.removeEventListener('message', handleHostMessage);
            document.removeEventListener('click', handleClickOutsideFilterDropdown);
        });

        /**
         * Begär expansion av iframen om den är i "banner"-läge.
         * Används innan navigeringsåtgärder som logga in/registrera sig.
         */
        const requestExpansionIfNeeded = () => {
            if (currentIframeMode.value === 'banner') {
                // Skickar ett meddelande till värdsidan (parent) att iframen vill expandera.
                window.parent.postMessage({ action: 'requestExpandFromIframe' }, '*');
            }
        };

        // Funktioner för att hantera klick på inloggnings-, registrerings- och min-sida-knappar.
        // Kallar `requestExpansionIfNeeded` först, och sedan "emittar" motsvarande händelse.
        const handleOpenLogin = () => {
            requestExpansionIfNeeded(); // Utöka iframen om nödvändigt.
            emit('open-login'); // Skickar 'open-login' händelsen till föräldrakomponenten.
        };
        const handleOpenSignup = () => {
            requestExpansionIfNeeded(); // Utöka iframen om nödvändigt.
            emit('open-signup'); // Skickar 'open-signup' händelsen till föräldrakomponenten.
        };
        const handleOpenAccount = () => {
            requestExpansionIfNeeded();
            emit('open-account');
        };

        // Växlar synligheten för filter-dropdown-menyn.
        const toggleFilterDropdown = () => {
            showFilterDropdown.value = !showFilterDropdown.value;
        };

        // Returnerar de variabler och funktioner som ska vara tillgängliga i mallen (template).
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
            isLoggedIn: computed(() => props.isLoggedIn), // Exponerar isLoggedIn som en computed property
            showFilterDropdown,
            toggleFilterDropdown
        };
    },
    // HTML-mallen för komponenten.
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