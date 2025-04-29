import SignupForm from "./components/SignupForm.js";
import LoginForm from "./components/LoginForm.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";
import SubscriptionModal from "./components/SubscriptionModal.js";
const { createApp, ref, onMounted, watch } = Vue; // Importera 'watch'

createApp({
    components: {
        SignupForm,
        LoginForm,
        ResetPasswordForm,
        SubscriptionModal
    },
    setup() {
        const modalView = ref(null);
        const showSubscriptionModal = ref(false);
        const map = ref(null);
        const trafficMarkers = ref([]);
        const selectedCounty = ref(''); // Lägg till state för valt län (lagrar länsnamn/värde)

        // Lista över svenska län med värde (för dropdown), nummer (för API), ungefärliga koordinater och zoom
        const counties = ref([
            { name: 'Välj län', value: '', number: null, coords: [62.0, 15.0], zoom: 5 }, // Standardvy
            { name: 'Blekinge län', value: 'Blekinge', number: 10, coords: [56.2, 14.8], zoom: 9 },
            { name: 'Dalarnas län', value: 'Dalarna', number: 20, coords: [60.8, 15.6], zoom: 7 },
            { name: 'Gotlands län', value: 'Gotland', number: 9, coords: [57.5, 18.5], zoom: 8 },
            { name: 'Gävleborgs län', value: 'Gävleborg', number: 21, coords: [61.3, 16.5], zoom: 7 },
            { name: 'Hallands län', value: 'Halland', number: 13, coords: [56.8, 12.8], zoom: 9 },
            { name: 'Jämtlands län', value: 'Jämtland', number: 23, coords: [63.0, 14.5], zoom: 6 },
            { name: 'Jönköpings län', value: 'Jönköping', number: 6, coords: [57.8, 14.2], zoom: 8 },
            { name: 'Kalmar län', value: 'Kalmar', number: 8, coords: [56.8, 16.0], zoom: 8 },
            { name: 'Kronobergs län', value: 'Kronoberg', number: 7, coords: [56.8, 14.5], zoom: 8 },
            { name: 'Norrbotten', value: 'Norrbotten', number: 25, coords: [66.0, 20.0], zoom: 5 }, 
            { name: 'Skåne län', value: 'Skåne', number: 12, coords: [55.8, 13.4], zoom: 8 },
            { name: 'Stockholms län', value: 'Stockholm', number: 1, coords: [59.3, 18.1], zoom: 8 },
            { name: 'Södermanlands län', value: 'Södermanland', number: 4, coords: [59.2, 16.6], zoom: 8 },
            { name: 'Uppsala län', value: 'Uppsala', number: 3, coords: [59.8, 17.6], zoom: 8 },
            { name: 'Värmlands län', value: 'Värmland', number: 17, coords: [59.8, 13.5], zoom: 7 },
            { name: 'Västerbotten', value: 'Västerbotten', number: 24, coords: [64.5, 18.0], zoom: 6 }, 
            { name: 'Västernorrlands län', value: 'Västernorrland', number: 22, coords: [63.0, 17.5], zoom: 6 },
            { name: 'Västmanlands län', value: 'Västmanland', number: 19, coords: [59.6, 16.5], zoom: 8 },
            { name: 'Västra Götalands län', value: 'Västra Götaland', number: 14, coords: [58.3, 11.7], zoom: 8 },
            { name: 'Örebro län', value: 'Örebro', number: 18, coords: [59.4, 15.1], zoom: 8 },
            { name: 'Östergötlands län', value: 'Östergötland', number: 5, coords: [58.4, 15.6], zoom: 8 }
        ]);

         // Mappning från länsnummer till länsnamn för visning i popup
         const countyNumberToName = counties.value.reduce((map, county) => {
             if (county.number !== null) {
                 map[county.number] = county.name.replace(' län', ''); // Ta bort " län" för kortare visning
             }
             return map;
         }, {});


        const openModal = (view) => {
            modalView.value = view;
        };

        const closeModal = () => {
            modalView.value = null;
        };

        // Funktion för att hämta och visa trafikdata
        const fetchAndDisplayTrafficData = async () => {
            console.log("Försöker hämta trafikdata...");
            // Bygg URL med query-parametrar för län (nummer) och meddelandetyp (värde)
            let url = "http://127.0.0.1:5000/api/traffic-situations?";
            const params = new URLSearchParams();

            // Hitta länsnumret baserat på det valda länsnamnet
            const selectedCountyInfo = counties.value.find(c => c.value === selectedCounty.value);
            if (selectedCountyInfo && selectedCountyInfo.value) { // Skicka länsnamnet om ett län är valt
                params.append('county', selectedCountyInfo.value);
            }
            // Lägg till filter för meddelandetypvärde 'Accident'
            params.append('messageTypeValue', 'Accident');

            url += params.toString();

            console.log("Hämtar från URL:", url);

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const situations = await response.json();
                console.log("Mottagen data:", situations);

                // Rensa befintliga markörer från kartan
                trafficMarkers.value.forEach(marker => marker.remove());
                trafficMarkers.value = [];

                if (map.value && situations && situations.length > 0) {
                    situations.forEach(situation => {
                        // Kontrollera om situation.Deviation existerar och är en array
                        if (situation.Deviation && Array.isArray(situation.Deviation)) {
                            situation.Deviation.forEach(deviation => {
                                // Använd det nya fältet WGS84Coordinates som vi lägger till i backend
                                const coords = deviation.WGS84Coordinates;

                                if (coords) {
                                     // Hämta länsnamn från länsnummer i Deviation.County (som är en lista)
                                     const countyNames = (deviation.County || [])
                                         .map(num => countyNumberToName[num] || `Okänt län (${num})`)
                                         .join(', ');


                                    // Skapa popup-innehåll
                                    const popupContent = `
                                        <h3>${deviation.Header || 'Ingen rubrik'}</h3>
                                        <p>Väg: ${deviation.RoadNumber || 'N/A'}</p>
                                        <p>Typ: ${deviation.MessageType || 'N/A'} (${deviation.MessageTypeValue || 'N/A'})</p>
                                        <p>Län: ${countyNames || 'N/A'}</p>
                                        <p>Tid: ${deviation.CreationTime ? new Date(deviation.CreationTime).toLocaleString() : 'N/A'}</p>
                                    `;

                                    // Skapa markör vid koordinaterna
                                    const marker = L.marker(coords)
                                        .addTo(map.value)
                                        .bindPopup(popupContent);
                                    trafficMarkers.value.push(marker);

                                } else {
                                    console.warn("Kunde inte placera händelse på kartan (saknar WGS84Coordinates):", deviation.Header);
                                }
                            });
                        } else {
                            console.warn("Situation saknar Deviation eller Deviation är inte en array:", situation);
                        }
                    });
                    console.log(`La till ${trafficMarkers.value.length} markörer på kartan.`);

                    // Centrera kartan om markörer lades till
                    if (trafficMarkers.value.length > 0) {
                         const group = new L.featureGroup(trafficMarkers.value);
                         map.value.fitBounds(group.getBounds(), { padding: [20, 20] }); // Lägg till lite padding
                    } else if (selectedCounty.value) {
                         // Om inga markörer lades till men ett län är valt, centrera på det länet
                         const countyInfo = counties.value.find(c => c.value === selectedCounty.value);
                         if (countyInfo && map.value) {
                             map.value.setView(countyInfo.coords, countyInfo.zoom);
                         }
                    }


                } else {
                    console.log("Ingen trafikdata att visa för valt län/typ.");
                     // Om inget län är valt, centrera på standardvyn
                    const countyInfo = counties.value.find(c => c.value === selectedCounty.value);
                    if (countyInfo && map.value) {
                         map.value.setView(countyInfo.coords, countyInfo.zoom);
                    } else if (map.value) {
                         // Centrera på Sverige om inget län är valt och inga markörer finns
                         map.value.setView([62.0, 15.0], 5);
                    }
                }

            } catch (error) {
                console.error("Fel vid hämtning eller visning av trafikdata:", error);
            }
        };

        // Watcher som reagerar när selectedCounty ändras
        watch(selectedCounty, (newValue, oldValue) => {
            console.log(`Valt län ändrat från ${oldValue} till ${newValue}`);
            // Hämta ny data och centrera kartan när länet ändras
            fetchAndDisplayTrafficData();
             const countyInfo = counties.value.find(c => c.value === newValue);
             if (map.value && countyInfo) {
                 map.value.setView(countyInfo.coords, countyInfo.zoom);
             } else if (map.value && !newValue) {
                  // Återgå till standardvy om "Välj län" väljs
                 map.value.setView([62.0, 15.0], 5);
             }
        });


        onMounted(() => {
            console.log("Vue app monterad, initierar Leaflet...");
            // Initiera kartan med standardvy (hela Sverige)
            map.value = L.map('map').setView([62.0, 15.0], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map.value);

            // Hämta initial data (visar olyckor i hela Sverige om inget län är förvalt)
            fetchAndDisplayTrafficData();
            // setInterval(fetchAndDisplayTrafficData, 5 * 60 * 1000); // Uppdatera var 5:e minut (valfritt)
        });

        return {
            modalView,
            showSubscriptionModal,
            openModal,
            closeModal,
            selectedCounty, // Exponera selectedCounty
            counties // Exponera counties
        };
    }
}).mount("#app");
