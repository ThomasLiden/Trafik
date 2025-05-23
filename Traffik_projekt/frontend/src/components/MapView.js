// frontend/src/components/MapView.js
import { useTrafficMap } from "./map.js";

export default {
    name: 'MapView',
    props: ['isLoggedIn'],
    emits: ['open-login', 'open-signup', 'open-account'],
    setup(props, { emit }) {
        const { ref, onMounted, watch, computed, onUnmounted } = Vue;

        const selectedCounty = ref('');
        const trafficStatusMessage = ref('Laddar karta...');
        const filterShowAccidents = ref(true);
        const filterShowRoadworks = ref(true);
        const filterShowCameras = ref(true);
        const lastBackendResponse = ref(null);
        const currentIframeMode = ref('banner');

        // NYTT: Ref för att styra synligheten av filter-dropdown
        const showFilterDropdown = ref(false);

        const counties = ref([
            // ... (din counties-lista oförändrad) ...
            { name: 'Alla län', value: '', number: null, coords: [62.0, 15.0], zoom: 4 },
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

        const countyNumberToName = computed(() => { /* ... (oförändrad) ... */
            return counties.value.reduce((map, county) => {
                if (county.number !== null) {
                    map[county.number] = county.name.replace(' län', '');
                }
                return map;
            }, {});
        });

        const {
            // ... (useTrafficMap oförändrad) ...
            initMap,
            centerMapOnCounty,
            fetchTrafficDataFromServer,
            renderMarkersOnMap,
            getMapInstance
        } = useTrafficMap(
            "http://127.0.0.1:5000/api/traffic-info",
            counties.value,
            countyNumberToName.value,
            currentIframeMode
        );

        const fetchAndRenderNewData = async (countyValue) => { /* ... (oförändrad) ... */
            trafficStatusMessage.value = "Hämtar trafikinformation...";
            const { success, data, message: fetchMessage } = await fetchTrafficDataFromServer(countyValue);
            if (success && data) {
                lastBackendResponse.value = data;
                const renderStatus = renderMarkersOnMap(
                    data,
                    filterShowAccidents.value,
                    filterShowRoadworks.value,
                    filterShowCameras.value,
                    countyNumberToName.value
                );
                trafficStatusMessage.value = renderStatus.message;
            } else {
                lastBackendResponse.value = null;
                trafficStatusMessage.value = fetchMessage || "Kunde inte hämta trafikinformation.";
            }
        };
        const applyFiltersAndReRender = () => { /* ... (oförändrad) ... */
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
        const handleHostMessage = (event) => { /* ... (oförändrad) ... */
            if (event.data && event.data.action === 'setViewMode') {
                if (currentIframeMode.value !== event.data.mode) {
                    currentIframeMode.value = event.data.mode;
                    const map = getMapInstance();
                    if (map) map.invalidateSize();
                }
            }
        };

        watch(selectedCounty, (newValue) => { /* ... (oförändrad) ... */
            centerMapOnCounty(newValue);
            fetchAndRenderNewData(newValue);
        });
        watch([filterShowAccidents, filterShowRoadworks, filterShowCameras], () => { /* ... (oförändrad) ... */
            applyFiltersAndReRender();
        });

        onMounted(() => { /* ... (oförändrad) ... */
            initMap('map');
            fetchAndRenderNewData(selectedCounty.value);
            window.addEventListener('message', handleHostMessage);
            // NYTT: Lägg till eventlyssnare för att stänga filter-dropdown vid klick utanför
            document.addEventListener('click', handleClickOutsideFilterDropdown);
            setInterval(() => fetchAndRenderNewData(selectedCounty.value), 5 * 60 * 1000);
        });
        onUnmounted(() => { /* ... (oförändrad) ... */
            window.removeEventListener('message', handleHostMessage);
            // NYTT: Ta bort eventlyssnare
            document.removeEventListener('click', handleClickOutsideFilterDropdown);
        });

        const requestExpansionIfNeeded = () => { /* ... (oförändrad) ... */
            if (currentIframeMode.value === 'banner') {
                window.parent.postMessage({ action: 'requestExpandFromIframe' }, '*');
            }
        };
        const handleOpenLogin = () => { /* ... (oförändrad) ... */
            requestExpansionIfNeeded();
            emit('open-login');
        };
        const handleOpenSignup = () => { /* ... (oförändrad) ... */
            requestExpansionIfNeeded();
            emit('open-signup');
        };
        const handleOpenAccount = () => emit('open-account');

        // NYTT: Metod för att växla filter-dropdown
        const toggleFilterDropdown = () => {
            showFilterDropdown.value = !showFilterDropdown.value;
        };

        // NYTT: Metod för att stänga dropdown om man klickar utanför
        const handleClickOutsideFilterDropdown = (event) => {
            const filterContainer = document.querySelector('.filter-dropdown-container');
            if (showFilterDropdown.value && filterContainer && !filterContainer.contains(event.target)) {
                showFilterDropdown.value = false;
            }
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
            // NYTT: Exponera för template
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