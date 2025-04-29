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
          <input v-model="firstName" type="text" required />
        </div>
        <div class="form-group">
          <label>Efternamn <span class="required">*</span></label>
          <input v-model="lastName" type="text" required />
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
        <div class="form-group">
          <label>Bekräfta lösenord <span class="required">*</span></label>
          <input v-model="confirmPassword" type="password" required />
        </div>
      </div>

      <div class="form-actions">
        <button class="button-primary" type="submit">Gå vidare</button>
      </div>
    </form>
  </div>
`
,
    data() {
      return {
        name: "",
        phone: "",
        email: "",
        password: "",
        message: ""
      };
    },
    methods: {
      async signup() {
        try {
          const response = await fetch("http://127.0.0.1:5000/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: this.name,
              phone: this.phone,
              email: this.email,
              password: this.password
            })
          });

          if (data.message) {
            this.$emit("signup-success", {
              email: this.email,
              phone: this.phone
            });
          }
          
  
          const data = await response.json();
          this.message = data.message || data.error;
        } catch (error) {
          this.message = "Fel vid registrering.";
          console.error(error);
        }
      }
    }
  };
  