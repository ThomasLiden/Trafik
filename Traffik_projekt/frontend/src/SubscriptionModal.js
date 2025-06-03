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
            <p> Måndadskostnad: {{ price }} SEK </p>
            <h3> Steg 1 av 4: Välj område och händelsetyp </h3>
            <select v-model="region" class="option" >
              <option disabled :value="null" selected>Välj ett område</option>
              <option v-for="r in regions" :key="r.location_id" :value="r">{{ r.region }}</option>
            </select>        
            <button class="button-primary" @click="nextStep">Nästa</button>
          </div>
  
          <div v-if="step === 2">
          <signup-form :region="region" :reseller-id="resellerId" @signup-success="handleSignupSuccess" />
          </div>
    
          <div v-if="step === 3">
            <h3>Steg 3 av 4: Betalning</h3>
            <div class="payment-section">
              <div class="payment-amount"> Pris: {{ price }}</div>
              <div id="stripe-checkout-container"></div>
              <div v-if="error" class="error-message">{{ error }}</div>
              <button @click="handlePayment" class="button-primary" :disabled="loading">
                {{ loading ? 'Laddar...' : 'Fortsätt till betalning' }}
              </button>
            </div>
          </div>
  
          <div v-if="step === 4">
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
        region: null,
        email: '',
        phone: '',
        incidentTypes: [],
        regions: [],
        userId: null,
        resellerId: null,
        resellerName: null,
        price: null, //lagt till
        stripe: null,
        loading: false,
        error: null
      };
    },

    async mounted() {
        // initziera stripe när componenten är mounted
      this.stripe = Stripe('pk_test_51RIsEVFPlu7UXDRDAlQtGOM9XRv0N27uADmwrhcb8f7PvRCZ1KDoViIn8QH3UuS38aBWsMYkhH9bcPJEH0DreFQX00tfP0ZdCF');

      console.log("SubscriptionModal mounted, $route.query =", this.$route.query);
      
          try {
      const regionsRes = await fetch("https://trafik-q8va.onrender.com/api/regions");
      
      if (!regionsRes.ok) throw new Error("Kunde inte hämta regioner");
      this.regions = await regionsRes.json();
      
    } catch (err) {
      console.error("Kunde inte hämta regioner:", err);
      this.error = "Kunde inte hämta regioner";
      return;
    }


      const resellerKey = this.$route.query.resellerKey;
    if (!resellerKey) {
      this.error = "Ingen resellerKey i URL.";
      return;
    }
    this.resellerId = resellerKey;
  
  console.log("→ Hittade resellerKey:", resellerKey);

    // LAGT TILL - pris och namn från reseller 
  try {
    const response = await fetch(`https://trafik-q8va.onrender.com/api/reseller-info?reseller_id=${resellerKey}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Fel vid hämtning");

    this.resellerName = data.name;
    this.price = data.price;
    console.log("Återförsäljare:", this.resellerName, "| Pris:", this.price);
  } catch (err) {
    console.error("Kunde inte hämta återförsäljarinfo:", err);
    this.error = "Kunde inte hämta återförsäljarinfo.";
    return;
  }

    },
  
  
    methods: {
      nextStep() {
            if (!this.resellerId) {
      alert("Vänta tills priset laddats innan du går vidare.");
      return;
    }
    // 2) Kolla att region är valt (objekt med location_id)
    if (!this.region || !this.region.location_id) {
      alert("Välj ett område innan du går vidare.");
      return;
    }
        this.step++;
      },
  
      handleSignupSuccess(payload) {
        this.email = payload.email;
        this.phone = payload.phone;
        this.userId = payload.user_id;
        localStorage.setItem("user_id", this.userId);
        this.step = 3;
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
      
          // Gå till steg 3 först (så att DOM-elementet finns)
          this.step = 3;
      
          // Vänta tills DOM har uppdaterats innan vi mountar
          this.$nextTick(async () => {
            const checkout = await this.stripe.initEmbeddedCheckout({
              clientSecret: data.clientSecret
            });
      
            checkout.mount('#stripe-checkout-container');
          });
      
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
