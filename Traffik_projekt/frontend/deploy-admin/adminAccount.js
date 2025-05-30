//importerar fetch-funktion.
import { apiFetch } from "../api.js";

export default {
  data() {
    return {
      name: "",
      lan: "",
      phone: "",
      email: "",
      message: ""
    };
  },
  //När komponenten skapas - hämta aktuell kontoinformation. 
  async created() {
    try {
      //Gör ett get-anrop till backend för att hämta uppgifter.
      const data = await apiFetch("https://trafik-frontend-hzww.onrender.com/api/admin/account");
      
      //fyll i formuläret med data.
      this.name = data.name || "";
      this.lan = data.region || "";
      this.phone = data.phone || "";
      this.email = data.email || "";

    } catch (err) {
      console.error("Fel vid hämtning:", err.message);
      this.message = "Kunde inte ladda kontouppgifter.";
    }
  },
  methods: {
    //Metod för att spara uppdaterad information.
    async saveProfile() {
      //skicka uppdaterade uppgifter till backend via ett Post.
      try {
        const data = await apiFetch("https://trafik-frontend-hzww.onrender.com/api/admin/account/update", {
          method: "POST",
          body: JSON.stringify({
            name: this.name,
            region: this.lan,
            phone: this.phone,
            email: this.email
          })
        });
        //Skriv ut meddelande. 
        this.message = data.message || "Uppdaterat!";
        
        //skriv ut vid fel och logga till konsolen. 
      } catch (err) {
        console.error("Fel vid uppdatering:", err.message);
        this.message = "Kunde inte spara ändringar.";
      }
    }
  },
  template: `
    <div class="container">
      <h1>Kontoinställningar</h1>
      <p>Här kan du ändra dina kontaktuppgifter.</p>
    
    <form class="form-grid" @submit.prevent="saveProfile">
      <div class="form-row">
        <label>Tidningsnamn</label>
        <input v-model="name" type="text" placeholder="Tidningsnamn" />
      </div>

      <div class="form-row">
        <label>Län</label>
        <input v-model="lan" type="text" placeholder="Län" />
      </div>

      <div class="form-row">
        <label>Telefonnummer</label>
        <input v-model="phone" type="text" placeholder="Telefonnummer" />
      </div>

      <div class="form-row">
        <label>E-post</label>
        <input v-model="email" type="email" placeholder="E-post" />
      </div>

      <div class="form-row">
        <button type="submit" class="button-primary">Spara</button>
      </div>
      <p v-if="message">{{ message }}</p>
    </form>
  </div>
  `
};