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
            <h3>Steg 1 av 5: Välj område</h3>
            <select v-model="region" class="option" >
              <option class="option-text">Östergötland</option>
              <option class="option-text">Stockholm</option>
            </select>
            <button @click="nextStep" class="button-primary">Nästa</button>
          </div>
  
          <div v-if="step === 3">
            <signup-form @signup-success="handleSignupSuccess" />
          </div>
  
          <div v-if="step === 4">
            <h3>Steg 2 av 5: Välj händelsetyp</h3>
            <label><input type="checkbox" v-model="incidentTypes" value="olycka"> Olycka</label>
            <label><input type="checkbox" v-model="incidentTypes" value="vägarbete"> Vägarbete</label>
            <button @click="nextStep" class="button-primary">Nästa</button>
          </div>

          <div v-if="step === 5">
            <h3>Steg 3 av 5: Betalning</h3>
            <div class="payment-section">
              <div class="payment-amount">Månadskostnad: 99 kr</div>
              <div id="stripe-checkout-container"></div>
              <button @click="handlePayment" class="button-primary">Fortsätt till betalning</button>
            </div>
          </div>
  
          <div v-if="step === 6">
            <h3>Bekräftelse</h3>
            <p>Du kommer att få SMS om: {{ incidentTypes.join(', ') }} i {{ region }}</p>
            <p>Till: {{ phone }} ({{ email }})</p>
          </div>
  
          <div v-if="step === 7">
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
        email: '',
        phone: '',
        incidentTypes: []
      };
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
      async handlePayment() {
        try {
          const response = await fetch('http://localhost:5000/create-checkout-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          const data = await response.json();
          
          if (!data.clientSecret) {
            throw new Error('No client secret received');
          }
          
          const stripe = Stripe('pk_test_51RIsEVFPlu7UXDRDAlQtGOM9XRv0N27uADmwrhcb8f7PvRCZ1KDoViIn8QH3UuS38aBWsMYkhH9bcPJEH0DreFQX00tfP0ZdCF');
          const checkout = await stripe.initEmbeddedCheckout({
            clientSecret: data.clientSecret,
          });
          
          checkout.mount('#stripe-checkout-container');
          
        } catch (error) {
          console.error('Error in payment process:', error);
        }
      },
      closeModal() {
        this.$emit('close');
      }
    },
    mounted() {
    }
  };
  