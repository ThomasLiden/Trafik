export default {
    template: `
      <div>
        <h2>Bli medlem</h2>
        <form @submit.prevent="signup">
          <input v-model="email" type="email" placeholder="E-post" required />
          <input v-model="password" type="password" placeholder="Lösenord" required />
          <button type="submit">Skapa konto</button>
        </form>
        <p v-if="message">{{ message }}</p>
      </div>
    `,
    data() {
      return {
        email: "",
        password: "",
        message: ""
      };
    },
    methods: {
      async signup() {
        try {
          const response = await fetch("http://localhost:5000/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: this.email,
              password: this.password
            })
          });
  
          const data = await response.json();
          this.message = data.message || data.error;
        } catch (error) {
          this.message = "Fel vid registrering.";
          console.error(error);
        }
      }
    }
  };
  