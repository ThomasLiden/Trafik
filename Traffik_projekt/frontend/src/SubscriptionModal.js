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
          <p>Måndadskostnad: {{ price }} SEK</p>
          <h3>Steg 1 av 5: Välj område och händelsetyp</h3>
          <select v-model="region" class="option">
            <option disabled :value="null" selected>Välj ett område</option>
            <option v-for="r in regions" :key="r.location_id" :value="r">{{ r.region }}</option>
          </select>        
          <button class="button-primary" @click="nextStep">Nästa</button>
        </div>
  
        <div v-if="step === 2">
          <h3>Steg 2 av 5: Ditt telefonnummer</h3>
          <signup-form :region="region" :reseller-id="resellerId" @signup-success="handleSignupSuccess" />
        </div>
  
        <div v-if="step === 3">
          <h3>Steg 3 av 5: Betalning</h3>
          <div class="payment-section">
            <div class="payment-amount">Pris: {{ price }}</div>
            <div id="stripe-checkout-container"></div>
            <div v-if="error" class="error-message">{{ error }}</div>
            <button @click="handlePayment" class="button-primary" :disabled="loading">
              {{ loading ? 'Laddar...' : 'Fortsätt till betalning' }}
            </button>
          </div>
        </div>
  
        <div v-if="step === 4">
          <h3>Steg 4 av 5: Bekräftelse</h3>
          <p> Du är nu prenumerant!</p>
          <p><strong>Område:</strong> {{ region.region }}</p>
          <p><strong>Månadspris:</strong> {{ price }} kr</p>
          <p><strong>SMS skickas till:</strong> {{ phone }}</p>
          <p><strong>Bekräftelsemail skickas till:</strong> {{ email }}</p>
          <p><strong>Notifierade händelser:</strong> {{ incidentTypes.join(', ') }}</p>
          <button @click="step = 5" class="button-primary">Fortsätt</button>
        </div>
  
        <div v-if="step === 5">
          <h3>Steg 5 av 5: Klart!</h3>
          <p>Tack för att du valt att prenumerera på trafikinfo </p>
          <p>Du kan nu stänga fönstret eller återgå till startsidan.</p>
          <button @click="closeModal" class="button-primary">Återgå till sidan</button>
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
        error: null,
        emailSent: false,
      };
    },

    async mounted() {
        // initziera stripe när componenten är mounted
      this.stripe = Stripe('pk_test_51RIsEVFPlu7UXDRDAlQtGOM9XRv0N27uADmwrhcb8f7PvRCZ1KDoViIn8QH3UuS38aBWsMYkhH9bcPJEH0DreFQX00tfP0ZdCF');

      console.log("SubscriptionModal mounted, $route.query =", this.$route.query);
      
      // Kontrollera om vi har en session_id från Stripe
      const sessionId = this.$route.query.session_id;
      if (sessionId) {
        console.log("Stripe session ID:", sessionId);
        // Hämta användarinformation från localStorage
        this.userId = localStorage.getItem("user_id");
        this.email = localStorage.getItem("user_email");
        this.phone = localStorage.getItem("user_phone");
        this.region = JSON.parse(localStorage.getItem("user_region"));
        this.step = 4; // Gå direkt till bekräftelsesidan
      }
      
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
          if (!userIdToSend) throw new Error("Ingen giltig user_id tillgänglig för betalning");
      
          const response = await fetch('https://trafik-q8va.onrender.com/api/create-checkout-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user_id: userIdToSend,
              location_id: this.region.location_id
            })
          });
      
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Fel vid skapande av betalningssession');
          }
      
          const data = await response.json();
          if (!data.clientSecret) throw new Error('Inget clientSecret mottaget från servern');
      
          if (!this.stripe) throw new Error('Stripe är inte initialiserad');
      
          // Spara användarinformation i localStorage innan checkout
          localStorage.setItem("user_region", JSON.stringify(this.region));
          localStorage.setItem("user_email", this.email);
          localStorage.setItem("user_phone", this.phone);
      
          this.$nextTick(async () => {
            const checkout = await this.stripe.initEmbeddedCheckout({
              clientSecret: data.clientSecret,
              onComplete: () => {
                // Förhindra att modalen stängs
                event?.preventDefault();
                event?.stopPropagation();
                
                // Uppdatera UI
                this.step = 4;
                const container = document.getElementById('stripe-checkout-container');
                if (container) {
                  container.innerHTML = '';
                }
              }
            });
      
            checkout.mount('#stripe-checkout-container');
          });
      
        } catch (error) {
          console.error('Fel i betalningsflöde:', error);
          this.error = error.message || 'Ett fel uppstod vid betalning';
        } finally {
          this.loading = false;
        }
      },

      handleCheckoutComplete() {
        this.$nextTick(() => {
          this.step = 4;
          const container = document.getElementById('stripe-checkout-container');
          if (container) {
            container.innerHTML = '';
          }
        });
      },
    
      async sendConfirmationEmail() {
        if (this.emailSent) return;
    
        this.emailSent = true;
    
        try {
          const response = await fetch("https://trafikwidget-projekt.onrender.com/send-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: this.email,
              subject: " Bekräftelse på trafikprenumeration",
              body: `
                <h2>Tack för din prenumeration!</h2>
                <p>Du kommer nu få SMS om trafikhändelser i <strong>${this.region.region}</strong>.</p>
                <p>Telefon: <strong>${this.phone}</strong></p>
                <p>Månadspris: <strong>${this.price} kr</strong></p>
                <p> Du kan när som helst avsluta prenumerationen via vår hemsida.</p>
              `
            })
          });
    
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Misslyckades skicka bekräftelsemail");
    
          console.log(" Bekräftelsemail skickat.");
        } catch (err) {
          console.error(" Kunde inte skicka bekräftelsemail:", err);
          alert("Ett fel uppstod vid utskick av bekräftelsemail.");
        }
      },
    
      closeModal() {
        this.$emit('close');
      }
    },
    
      watch: {
        step(newVal) {
          if (newVal === 4) {
            this.sendConfirmationEmail();
          }
        }
      }
    }
    