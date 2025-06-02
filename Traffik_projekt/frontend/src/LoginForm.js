export default {
  name: "LoginForm",
  template: `
    <div>
      <div v-if="view === 'login'">
        <h2>Logga in</h2>
        <form @submit.prevent="login">
          <div>
            <label>E-post <span class="required">*</span></label>
            <input v-model="email" type="email" placeholder="E-post" class="form-field" required />
          </div>
          <div>
            <label>Lösenord <span class="required">*</span></label>
            <input v-model="password" type="password" placeholder="Lösenord" class="form-field" required />
          </div>
          <button type="submit" class="button-primary">Logga in</button>
        </form>

        <button @click="view = 'forgot'; message = ''" style="margin-top: 1rem;" class="button-tertiary">
          Glömt lösenord?
        </button>
      </div>

      <div v-else-if="view === 'forgot'">
        <h2>Återställ lösenord</h2>
        <form @submit.prevent="forgotPassword">
          <label>E-post</label>
          <input v-model="email" type="email" required class="form-field" />
          <button class="button-primary" type="submit">Skicka återställningslänk</button>
        </form>
        <button class="button-tertiary" @click="view = 'login'; message = ''">
          Tillbaka till inloggning
        </button>
      </div>

      <p v-if="message">{{ message }}</p>
    </div>
  `,
  data() {
    return {
      email: "",
      password: "",
      message: "",
      view: "login"
    };
  },
  methods: {
    async login() {
      this.message = "";
      try {
        const res = await fetch("http://127.0.0.1:5000/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: this.email,
            password: this.password
          })
        });

        const data = await res.json();

        if (res.ok) {
          console.log(" Inloggning lyckades:", data);
          this.message = "Inloggning lyckades!";
          this.$emit("login-success", {
            user_id: data.user_id,
            access_token: data.access_token
          });
        } else {
          console.error(" Inloggning misslyckades:", data.error);
          this.message = "Felaktig e-post eller lösenord.";
        }
      } catch (err) {
        console.error(" Fel vid inloggning:", err);
        this.message = "Ett tekniskt fel uppstod. Försök igen.";
      }
    },

    async forgotPassword() {
      this.message = "";
      try {
        const res = await fetch("http://127.0.0.1:5000/api/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: this.email })
        });

        const data = await res.json();

        if (res.ok) {
          console.log("📧 Återställningslänk skickad.");
          this.message = "En länk för att återställa lösenordet har skickats till din e-post.";
        } else {
          console.error(" Misslyckades att skicka länk:", data.error);
          this.message = "Fel: " + data.error;
        }
      } catch (err) {
        console.error(" Tekniskt fel:", err);
        this.message = "Något gick fel. Försök igen senare.";
      }
    }
  }
};
