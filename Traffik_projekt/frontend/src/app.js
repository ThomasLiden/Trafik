// app.js
import SignupForm from "./components/SignupForm.js";
import LoginForm from "./components/LoginForm.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";
import SubscriptionModal from "./components/SubscriptionModal.js";
import { useTrafficMap } from "./components/map.js"; 

const { createApp, ref, onMounted, watch } = Vue;

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
        const selectedCounty = ref(''); 

        
        const counties = ref([
            { name: 'Välj län', value: '', number: null, coords: [62.0, 15.0], zoom: 5 }, // Default view
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

         const countyNumberToName = counties.value.reduce((map, county) => {
             if (county.number !== null) {
                 map[county.number] = county.name.replace(' län', ''); 
             }
             return map;
         }, {});

        
        const { initMap, updateMapWithTrafficData, centerMapOnCounty } = useTrafficMap(
            "http://127.0.0.1:5000/api/traffic-situations?", // API URL config
            counties.value, // County list config
            countyNumberToName // County name mapping config
        );


        const openModal = (view) => {
            modalView.value = view;
        };

        const closeModal = () => {
            modalView.value = null;
        };

        
        watch(selectedCounty, (newValue, oldValue) => {
            console.log(`Selected county changed from ${oldValue} to ${newValue}`);
            centerMapOnCounty(newValue); 
            updateMapWithTrafficData(newValue); 
        });


        onMounted(() => {
            console.log("Vue app mounted, initializing Leaflet...");
            initMap('map');
            updateMapWithTrafficData(selectedCounty.value);
            // Optional: Set up interval for updates if needed
            // setInterval(() => updateMapWithTrafficData(selectedCounty.value), 5 * 60 * 1000); // Update every 5 minutes
        });

        return {
            modalView,
            showSubscriptionModal,
            openModal,
            closeModal,
            selectedCounty,
            counties
        };
    }
}).mount("#app");