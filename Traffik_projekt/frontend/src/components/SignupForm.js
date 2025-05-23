export default {
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
      message: "",
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
          password: this.password,
        };

        console.log(" Payload som skickas:", payload);

        const response = await fetch("http://127.0.0.1:5000/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
