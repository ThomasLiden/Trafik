

export default {
    template: `
      <div class="signup-form">
        <h2>Ändra kontaktuppgifter</h2>
        <form @submit.prevent="updateProfile">
          <div class="form-row">
            <div class="form-group">
              <label>Förnamn<span class="required">*</span></label>
              <input v-model="first_name" type="text" class="form-field" placeholder="Förnamn" />
            </div>
           <div class="form-group">
            <label>Efternamn<span class="required">*</span></label>
            <input v-model="last_name" type="text" class="form-field" placeholder="Efternamn" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email<span class="required">*</span></label>
              <input v-model="email" type="email" class="form-field" placeholder="E-post" />
              </div>
              <div class="form-group">
            <label>Telefonnummer<span class="required">*</span></label>
            <input v-model="phone" type="text" class="form-field" placeholder="Telefonnummer" />
            </div>
          </div>
          <button type="submit" class="button-primary">Spara</button>
          <button class="button-secondary" type="button" @click="cancelEdit">
            Avbryt
          </button>
        </form>
        <p v-if="message">{{ message }}</p>
      </div>
    `,
    data() {
      return {
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        message: ""
      };
    },
    async mounted() {
      try {
        const userId = localStorage.getItem("user_id");
        const token  = localStorage.getItem("access_token");
        const res    = await fetch(`https://trafik-q8va.onrender.com/api/user-profile?user_id=${userId}`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        });
        const data   = await res.json();
  
        // Sätt in värdena i formuläret
        this.first_name = data.first_name;
        this.last_name  = data.last_name;
        this.email      = data.email;
        this.phone      = data.phone;
      } catch (err) {
        console.error(err);
        this.message = "Kunde inte läsa profil.";
      }
    },
    methods: {
      async updateProfile() {
        const user_id = localStorage.getItem("user_id");
        const res = await fetch("https://trafik-q8va.onrender.com/api/update-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id,
            first_name: this.first_name,
            last_name:  this.last_name,
            email: this.email,
            phone: this.phone
          })
        });
        const data = await res.json();
        this.message = data.message || data.error;
        this.$emit("profile-updated");
      }, 
      cancelEdit() {
        this.$emit("cancel");
      }

    }
  };
  