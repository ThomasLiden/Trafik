// frontend/src/components/MapView.js
import { useTrafficMap } from "./map.js"; // Importera din kartlogik

export default {
    name: 'MapView',
    props: ['isLoggedIn'], // Behålls från main
    emits: ['open-login', 'open-signup', 'open-account'], // Behålls från main
    setup(props, { emit }) { // emit behövs för att skicka events
        const { ref, onMounted, watch, computed } = Vue;

        const selectedCounty = ref('');
        const trafficStatusMessage = ref('Laddar karta...');
        const filterShowAccidents = ref(true);
        const filterShowRoadworks = ref(true);
        const filterShowCameras = ref(true);
        const lastBackendResponse = ref(null);

        const counties = ref([ // Från KartaTrafiks app.js
            { name: 'Alla län', value: '', number: null, coords: [62.0, 15.0], zoom: 4 }, // Justerad zoom för "Alla län"
            { name: 'Blekinge län', value: 'Blekinge', number: 10, coords: [56.16, 15.0], zoom: 9 },
            { name: 'Dalarnas län', value: 'Dalarna', number: 20, coords: [60.8, 14.6], zoom: 7 },
            { name: 'Gotlands län', value: 'Gotland', number: 9, coords: [57.5, 18.55], zoom: 8 },
            { name: 'Gävleborgs län', value: 'Gävleborg', number: 21, coords: [61.0, 16.5], zoom: 7 },
            { name: 'Hallands län', value: 'Halland', number: 13, coords: [56.9, 13.0], zoom: 8 },
            { name: 'Jämtlands län', value: 'Jämtland', number: 23, coords: [63.3, 14.5], zoom: 6 },
            { name: 'Jönköpings län', value: 'Jönköping', number: 6, coords: [57.6, 14.3], zoom: 8 },
            { name: 'Kalmar län', value: 'Kalmar', number: 8, coords: [57.0, 16.2], zoom: 7 },
            { name: 'Kronobergs län', value: 'Kronoberg', number: 7, coords: [56.8, 14.55], zoom: 8 },
            { name: 'Norrbottens län', value: 'Norrbotten', number: 25, coords: [67.0, 20.0], zoom: 5 }, // Norrbotten, inte bara Norrbotten
            { name: 'Skåne län', value: 'Skåne', number: 12, coords: [55.85, 13.5], zoom: 8 },
            { name: 'Stockholms län', value: 'Stockholm', number: 1, coords: [59.33, 18.07], zoom: 8 },
            { name: 'Södermanlands län', value: 'Södermanland', number: 4, coords: [59.1, 16.8], zoom: 8 },
            { name: 'Uppsala län', value: 'Uppsala', number: 3, coords: [59.9, 17.7], zoom: 8 },
            { name: 'Värmlands län', value: 'Värmland', number: 17, coords: [59.7, 13.2], zoom: 7 },
            { name: 'Västerbottens län', value: 'Västerbotten', number: 24, coords: [64.8, 18.0], zoom: 6 }, // Västerbottens län
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
            renderMarkersOnMap
        } = useTrafficMap(
            "http://127.0.0.1:5000/api/traffic-info", // Backend URL
            counties.value, // Skicka reaktiv counties-lista
            countyNumberToName.value // Skicka computed countyNumberToName
        );

        const fetchAndRenderNewData = async (countyValue) => {
            trafficStatusMessage.value = "Hämtar trafikinformation...";
            const { success, data, message: fetchMessage } = await fetchTrafficDataFromServer(countyValue);
            if (success && data) {
                lastBackendResponse.value = data; // Spara senaste svaret
                // Uppdatera countyNumberToName här om counties.value är reaktiv och kan ändras externt
                const renderStatus = renderMarkersOnMap(
                    data,
                    filterShowAccidents.value,
                    filterShowRoadworks.value,
                    filterShowCameras.value,
                    countyNumberToName.value // Skicka med den aktuella mappningen
                );
                trafficStatusMessage.value = renderStatus.message;
            } else {
                lastBackendResponse.value = null;
                trafficStatusMessage.value = fetchMessage || "Kunde inte hämta trafikinformation.";
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
                // Om inget tidigare svar finns, hämta nytt (kan hända om filter ändras innan första hämtningen)
                fetchAndRenderNewData(selectedCounty.value);
            }
        };

        watch(selectedCounty, (newValue) => {
            centerMapOnCounty(newValue);
            fetchAndRenderNewData(newValue);
        });

        watch([filterShowAccidents, filterShowRoadworks, filterShowCameras], () => {
            applyFiltersAndReRender();
        });

        onMounted(() => {
            initMap('map'); // Kart-elementets ID
            fetchAndRenderNewData(selectedCounty.value); // Hämta data för "Alla län" initialt

            // Automatisk uppdatering (valfritt)
            setInterval(() => {
                console.log("Automatisk uppdatering av trafikdata...");
                fetchAndRenderNewData(selectedCounty.value);
            }, 5 * 60 * 1000); // Var 5:e minut
        });

        // Metoder för att emittera events till föräldern (app.js)
        const handleOpenLogin = () => emit('open-login');
        const handleOpenSignup = () => emit('open-signup');
        const handleOpenAccount = () => emit('open-account');

        return {
            selectedCounty,
            counties,
            trafficStatusMessage,
            filterShowAccidents,
            filterShowRoadworks,
            filterShowCameras,
            // Exponera metoderna till templaten
            handleOpenLogin,
            handleOpenSignup,
            handleOpenAccount,
            isLoggedIn: computed(() => props.isLoggedIn) // Gör isLoggedIn tillgänglig i template
        };
    },
    template: `
      <div class="map-section">
        <div id="map"></div> <div class="controls">
          <div>
            <label for="county-select">Välj län:</label>
            <select id="county-select" v-model="selectedCounty">
              <option v-for="county in counties" :key="county.value" :value="county.value">{{ county.name }}</option>
            </select>
          </div>
          <div class="filter-controls">
            <label>
              <input type="checkbox" v-model="filterShowAccidents" /> Visa olyckor
            </label>
            <label>
              <input type="checkbox" v-model="filterShowRoadworks" /> Visa vägarbeten
            </label>
            <label>
              <input type="checkbox" v-model="filterShowCameras" /> Visa fartkameror
            </label>
          </div>
          <div class="traffic-status-message" v-if="trafficStatusMessage">{{ trafficStatusMessage }}</div>
        </div>
        <div class="buttons">
          <button @click="isLoggedIn ? handleOpenAccount() : handleOpenLogin()" class="button-secondary">
            {{ isLoggedIn ? 'Till min sida' : 'Logga in' }}
          </button>
          <button @click="handleOpenSignup()" class="button-primary">
            Prenumerera
          </button>
        </div>
      </div>
    `
};