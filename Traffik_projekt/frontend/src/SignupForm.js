export default {
    props: ['region'], 
    template: `
  <div class="signup-modal-content">
    <div class="form-header">
      <h2>Steg 2/4: Registrera dig</h2>
      <p>Vänligen fyll i alla obligatoriska fält innan du går vidare.</p>
    </div>

    <form class="signup-form" @submit.prevent="signup">
      <div class="form-row">
        <div class="form-group">
          <label>Förnamn <span class="required">*</span></label>
          <input v-model="first_name" type="text" required />
        </div>
        <div class="form-group">
          <label>Efternamn <span class="required">*</span></label>
          <input v-model="last_name" type="text" required />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Mobilnummer <span class="required">*</span></label>
          <input v-model="phone" type="text" required />
        </div>
        <div class="form-group">
          <label>E-post <span class="required">*</span></label>
          <input v-model="email" type="email" required />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Lösenord <span class="required">*</span></label>
          <input v-model="password" type="password" required />
          <small>Minst 8 tecken, varav en versal och en siffra.</small>
        </div>

      </div>
      <p v-if="message" class="error-message">{{ message }}</p>

      <div class="form-actions">
        <button class="button-primary" type="submit">Gå vidare</button>
      </div>
    </form>
  </div>
`
,
mounted() {
  // Hämta query‐parameters från window.location.search
  console.log("Mounted SignupForm, söksträng =", window.location.search);
  const urlParams = new URLSearchParams(window.location.search);
  const resellerKey = urlParams.get('resellerKey');

  if (!resellerKey) {
    this.message = "Reseller‐nyckel saknas i URL.";
    return;
  }

  // Spara i komponentens data, så ni kan använda det senare
  this.resellerKey = resellerKey;

  // 3) Hämta reseller‐info baserat på publisher‐nyckeln
  this.fetchResellerData(resellerKey);
},
    data() {
      return {
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        password: "",
        message: "", 
        resellerKey: null, 
        resellerId: null,
        price: null, 
        resellerName: ""
      };
    },
    methods: {
      async fetchResellerData(resellerKey) {
    try {
      const res = await fetch(
        `https://trafik-q8va.onrender.com/api/reseller-region?resellerKey=${encodeURIComponent(resellerKey)}`
      );
      const data = await res.json();
      if (!res.ok) {
        this.message = data.error || "Kunde inte hämta reseller‐data.";
        return;
      }
      // mappar namn med rätt dats
      this.resellerId = data.reseller_id;
      this.price = data.price;
      this.resellerName = data.name;
    } catch (err) {
      console.error(err);
      this.message = "Tekniskt fel vid hämtning av reseller.";
    }
  },

      async signup() {
        this.message = ""; 
        try {
          const payload = {
            first_name: this.first_name,
            last_name: this.last_name,
            phone: this.phone,
            email: this.email,
            location_id: this.region.location_id,
            password: this.password,
            //domain: window.location.hostname
            reseller_id: this.resellerId
          };
      
          console.log(" Payload som skickas:", payload);
      
          const response = await fetch("https://trafik-q8va.onrender.com/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
      
          const data = await response.json();

        if (!response.ok) {
          this.message = data.error || data.message || "Något gick fel.";
          return;
        }

        if (data.message) {
          this.$emit("signup-success", {
            email: this.email,
            phone: this.phone,
          });
        }

        this.message = data.message || data.error;
      } catch (error) {
        this.message = "Fel vid registrering.";
        console.error(error);
      }
    },
  },
};
