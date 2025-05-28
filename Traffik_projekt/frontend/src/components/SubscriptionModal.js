// detta är modalen för prenumerationer, det innehåller flera steg med info och att bli prenumerat
//steg 3 är komponenten signupform

import SignupForm from "./SignupForm.js";

export default {
    name: 'subscription-modal',
    components: {
        SignupForm
      },
    template: `
      <div class="modal">
        <div class="modal-content">
           <button class="close" @click="closeModal">X</button>
  
          <div v-if="step === 1">
            <h2>Prenumerera på trafikinfo</h2>
            <p>Du kommer få info om olyckor, hinder och vägarbete via SMS.</p>
            <button class="button-primary" @click="nextStep">Nästa</button>
          </div>
  
          <div v-if="step === 2">
            <h3>Steg 1 av 4: Välj område</h3>
            <select v-model="region" class="option" >
              <option disabled value="">Välj ett område</option>
              <option v-for="r in regions" :key="r.location_id" :value="r">{{ r.region }}</option>
            </select>
            <button @click="nextStep" class="button-primary">Nästa</button>
          </div>
  
          <div v-if="step === 3">
          <signup-form :region="region" @signup-success="handleSignupSuccess" />
          </div>
  
          <div v-if="step === 4">
            <h3>Steg 2 av 4: Välj händelsetyp</h3>
            <label><input type="checkbox" v-model="incidentTypes" value="olycka"> Olycka</label>
            <label><input type="checkbox" v-model="incidentTypes" value="vägarbete"> Vägarbete</label>
            <button @click="nextStep" class="button-primary">Nästa</button>
          </div>
  
          <div v-if="step === 5">
            <h3>Bekräftelse</h3>
            <p>Du kommer att få SMS om: {{ incidentTypes.join(', ') }} i {{ region }}</p>
            <p>Till: {{ phone }} ({{ email }})</p>
            <p>Pris = {{ price }}</p>
            <button @click="submit" class="button-primary">Bekräfta</button>
          </div>
  
          <div v-if="step === 6">
            <h3>Tack!</h3>
            <p>Du är nu prenumerant.</p>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        step: 1,
        region: '',
        price: null,
        email: '',
        phone: '',
        incidentTypes: [],
        regions: []
      };
    },
    mounted() {
      fetch('http://127.0.0.1:5000/api/regions')
        .then(res => res.json())
        .then(data => {
          this.regions = data; 

          const domain = window.location.hostname;
          return fetch(`http://127.0.0.1:5000/api/reseller-region?domain=${domain}`);
          
        })
        .then(res => res.json ())
        .then(data => {

          this.price = data.price;

          const resellerRegionName = data.region;

          const defaultRegion = this.regions.find(r => r.region === resellerRegionName);
          if (defaultRegion) {
            this.region = defaultRegion;
          }
          console.log("Pris satt till:", this.price);
        })
        .catch(err => {
          console.error('Kunde inte hämta regioner', err);
        });
    },
    methods: {
      nextStep() {
        this.step++;
      },
      handleSignupSuccess(payload) {
        this.email = payload.email;
        this.phone = payload.phone;
        this.nextStep();
      },
      submit() {
        
        this.step++;
      },
      closeModal() {
        this.$emit('close');
      }
    }
  };
  