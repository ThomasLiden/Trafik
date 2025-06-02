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
  `,
  data() {
    return {
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      password: "",
      message: ""
    };
  },
  methods: {
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
          domain: window.location.hostname  // ⬅️ FIX: Skickar domän
        };

        console.log("📤 Payload som skickas:", JSON.stringify(payload));

        const response = await fetch("https://trafik-q8va.onrender.com/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include"
        });

        const data = await response.json();
        console.log("📥 Svar från server:", data);

        if (!response.ok) {
          this.message = data.error || data.message || "Något gick fel.";
          return;
        }

        if (data.message && data.user_id) {
          this.$emit("signup-success", {
            email: this.email,
            phone: this.phone,
            user_id: data.user_id
          });
        } else {
          console.error("❌ user_id saknas i backend-svar:", data);
        }

        this.message = data.message || data.error;

      } catch (error) {
        this.message = "Fel vid registrering.";
        console.error("❌ Fel vid fetch:", error);
      }
    }
  }
};
