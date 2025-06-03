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
          <p> Måndadskostnad: {{ price }} </p>
          <h3> Steg 1 av 5: Välj område och händelsetyp </h3>
          <select v-model="region" class="option" >
            <option disabled value="">Välj ett område</option>
            <option v-for="r in regions" :key="r.location_id" :value="r">{{ r.region }}</option>
          </select>
          <div class="incident-types">
            <label><input type="checkbox" v-model="incidentTypes" value="olycka"> Olycka</label>
            <label><input type="checkbox" v-model="incidentTypes" value="vägarbete"> Vägarbete</label>  
          </div>         
          <button class="button-primary" @click="nextStep">Nästa</button>
        </div>

        <div v-if="step === 2">
          <signup-form :region="region" @signup-success="handleSignupSuccess" />
        </div>

        <div v-if="step === 3">
          <h3>Steg 3 av 4: Verifiera mobilnummer</h3>
          <p>Vi har skickat en kod till {{ phone }}. Skriv in den nedan för att bekräfta ditt nummer:</p>
          <input v-model="smsCode" placeholder="6-siffrig kod" maxlength="6" class="option" />
          <div v-if="codeError" class="error-message">{{ codeError }}</div>
          <button @click="verifyCode" class="button-primary">Verifiera</button>
          <p><button @click="resendCode" class="button-secondary">Skicka koden igen</button></p>
          <p>Om du inte får koden, kontrollera att ditt nummer är korrekt.</p>
        </div>

        <div v-if="step === 4">
          <h3>Steg 4 av 4: Betalning</h3>
          <div class="payment-section">
            <div class="payment-amount"> Pris: {{ price }}</div>
            <div id="stripe-checkout-container"></div>
            <div v-if="error" class="error-message">{{ error }}</div>
            <button @click="handlePayment" class="button-primary" :disabled="loading">
              {{ loading ? 'Laddar...' : 'Fortsätt till betalning' }}
            </button>
          </div>
        </div>

        <div v-if="step === 5">
          <h3>Tack!</h3>
          <p>Du är nu prenumerant.</p>
          <h3>Bekräftelse</h3>
          <p>Område: {{ region.region }}</p>
          <p>Du kommer att få SMS om: {{ incidentTypes.join(', ') }} i {{ region }}</p>
          <p>Till: {{ phone }} ({{ email }})</p>
          <p>Pris per månad: {{ price }} kr</p>
          <button @click="submit" class="button-primary">Bekräfta</button>
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
      smsCode: '',
      codeError: '',
      incidentTypes: [],
      regions: [],
      userId: null,
      resellerId: null,
      stripe: null,
      loading: false,
      error: null
    };
  },
  
    mounted() {
      this.stripe = Stripe('pk_test_51RIsEVFPlu7UXDRDAlQtGOM9XRv0N27uADmwrhcb8f7PvRCZ1KDoViIn8QH3UuS38aBWsMYkhH9bcPJEH0DreFQX00tfP0ZdCF');
  
      fetch('https://trafik-q8va.onrender.com/api/regions')
        .then(res => res.json())
        .then(data => {
          this.regions = data;
          const domain = window.location.hostname;
          return fetch(`https://trafik-q8va.onrender.com/api/reseller-region?domain=${domain}`);
        })
        .then(res => res.json())
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
  
    watch: {
      step(newVal) {
        if (newVal === 3) {
          this.sendVerificationCode();
        }
      }
    },
  
    methods: {
      nextStep() {
        this.step++;
      },
  
      handleSignupSuccess(payload) {
        this.email = payload.email;
        this.phone = payload.phone;
        this.userId = payload.user_id;
        localStorage.setItem("user_id", this.userId);
        this.step = 3;
      },
  
      async sendVerificationCode() {
        this.codeError = '';
        try {
          const response = await fetch('https://trafik-q8va.onrender.com/api/send-sms-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: this.phone })
          });
  
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || 'Misslyckades att skicka verifieringskoden.');
          }
  
          console.log("✅ Verifieringskod skickad till", this.phone);
        } catch (error) {
          console.error("❌ Kunde inte skicka verifieringskod:", error);
          this.codeError = "Kunde inte skicka verifieringskod: " + error.message;
        }
      },
  
      async verifyCode() {
        this.codeError = '';
        if (!this.smsCode || this.smsCode.length !== 6) {
          this.codeError = "Koden måste vara 6 siffror.";
          return;
        }
  
        try {
          const res = await fetch("https://trafik-q8va.onrender.com/api/verify-sms-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: this.phone,
              code: this.smsCode
            })
          });
  
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Ogiltig kod.");
          }
  
          this.nextStep();
        } catch (err) {
          console.error("❌ Verifieringsfel:", err);
          this.codeError = err.message || "Kunde inte verifiera koden.";
        }
      },
  
      async resendCode() {
        try {
          const response = await fetch('https://trafik-q8va.onrender.com/api/resend-sms-code', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone: this.phone })
          });
  
          const result = await response.json();
  
          if (!response.ok) {
            throw new Error(result.error || 'Misslyckades att skicka om koden');
          }
  
          alert("En ny verifieringskod har skickats via SMS.");
        } catch (error) {
          console.error("❌ Kunde inte skicka om SMS:", error);
          this.codeError = error.message;
        }
      },
  
      async handlePayment() {
        this.loading = true;
        this.error = null;
  
        try {
          const userIdToSend = this.userId || localStorage.getItem("user_id");
          if (!userIdToSend) {
            throw new Error("Ingen giltig user_id tillgänglig för betalning");
          }
  
          const response = await fetch('https://trafik-q8va.onrender.com/api/create-checkout-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ user_id: userIdToSend })
          });
  
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Något gick fel vid kommunikation med servern');
          }
  
          const data = await response.json();
          if (!data.clientSecret) {
            throw new Error('Inget client secret mottaget från servern');
          }
  
          if (!this.stripe) {
            throw new Error('Stripe är inte initialiserad');
          }
  
          const checkout = await this.stripe.initEmbeddedCheckout({
            clientSecret: data.clientSecret
          });
  
          checkout.mount('#stripe-checkout-container');
          this.step = 5;
  
        } catch (error) {
          console.error('Error in payment process:', error);
          this.error = error.message || 'Ett fel uppstod vid betalningsprocessen';
        } finally {
          this.loading = false;
        }
      },
  
      closeModal() {
        this.$emit('close');
      }
    }
  };
