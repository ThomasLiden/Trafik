// Lägg till högst upp i filen:
const BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://admin-lqz8.onrender.com/api"; 

//Login-komponent som hanterar inloggning för tidningar och superadmin. 
export default {
    data() {
        return {
            email: "",
            password: "",
            message: ""
        };
    },
    template: `
    <div class="container">
      <h2> Logga in </h2>
      <form @submit.prevent="login" class="">
        <div class="form-row">
        <label>E-post <span class="required">*</span></label>
         <input v-model="email" type="email" placeholder="E-post"  class="form-field" required />
         </div>
         <div class="form-row">
         <label>Lösenord<span class="required">*</span></label>
         <input v-model="password" type="password" placeholder="Lösenord" class="form-field" required />
         </div>
         <div class="form-row">
         <button type="submit" class="button-primary"> Logga in </button>
         </div>
      </form>
      <p v-if="message">{{ message }}</p>
    </div>
    `,
    methods: {
      //Inloggning - skickar användarens epost och lösenord till backend via en post-request. 
        async login() {
            try {
                const response = await fetch(`${BASE_URL}/admin/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                   email: this.email,
                   password: this.password
                })
        });
        
        const data = await response.json();

        //Om inloggning misslyckas, skriv ut felmeddelande. 
        if (!response.ok) {
           this.message = data.error || "Fel vid inloggning";
           return;
        }

        // Skicka login-resultat till app.js via event
        this.$emit("login-success", {
          access_token: data.access_token,
          reseller_id: data.reseller_id,
          role: data.role
        });

        } catch (error) {
           this.message = "Ett fel uppstod vid inloggningen.";
           console.error(error);
        }
    },
}
    
}; 

