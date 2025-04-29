export default {
    template: `
      <div>
        <h2>Skapa prenumeration</h2>
        <form @submit.prevent="signup">
          <input v-model="name" type="text" placeholder="Namn" required />
          <input v-model="email" type="email" placeholder="E-post" required />
          <input v-model="phone" type="text" placeholder="Telefonnummer" required />
          <input v-model="password" type="password" placeholder="Lösenord" required />
          <button type="submit">Skapa konto</button>
        </form>
        <p v-if="message">{{ message }}</p>
      </div>
    `,
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
  