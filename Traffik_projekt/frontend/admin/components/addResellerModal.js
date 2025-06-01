import regions from "../regions.js"
import { apiFetch } from "../api.js";

const BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://trafik-q8va.onrender.com/api";

export default {
    props: ["show"],
    emits: ["close"],
    data() {
      return {
        name: "",
        email: "",
        password: "",
        phone: "",
        domain: "",
        region: "",
        price: "",
        message: "",
        regions,

      };
    },
    methods: {
      //Skicka data till backend för att lägga till en ny reseller. 
      async addReseller() {
        this.message = ""; //Nollställ eventuella tidigare felmeddelanden. 
       
        //Kontrollera så att fälten är ifyllda.
        if (!this.name || !this.email || !this.password || !this.domain || !this.region || !this.price) {
          this.message = "Fyll i alla fält (telefon valfritt)";
          return;
        }
        
        try {
          //Skicka post-anrop till backend via apiFetch-funktionen. 
          const data = await apiFetch(`${BASE_URL}/admin/create_reseller`, {
            method: "POST",
            body: JSON.stringify({
              name: this.name,
              email: this.email,
              password: this.password,
              phone: this.phone || null, 
              domain: this.domain,
              region: this.region,
              price: this.price !== "" ? parseFloat(this.price) : null
            })
          });
          //Om lyckat, visa meddelande. 
          this.message = "Tidning skapad!";
          
          // Rensa fälten
          this.name = "";
          this.email = "";
          this.password = "";
          this.phone = "";
          this.domain = "";
          this.region = ""; 
          this.price = "";
  
        } catch (error) {
          this.message = "Ett fel uppstod.";
          console.error(error);
        }
      }
    },
    template: `
      <div v-if="show" class="modal">
        <div class="modal-content">
          <span class="close-button" @click="$emit('close')"> x </span>  
          <h3>Lägg till ny tidning</h3>
          <p v-if="message">{{ message }}</p>
  
          <form @submit.prevent="addReseller" class="form-grid">
  
            <div class="form-row">
              <label>Namn:</label>
              <input v-model="name" type="text">
            </div>
            <div class="form-row">
             <label>E-post:</label>
             <input v-model="email" type="email">
            </div>
            <div class="form-row">
              <label>Lösenord <span class="required">*</span></label>
              <input v-model="password" type="password"/>
              <small>Minst 8 tecken, varav en versal och en siffra.</small>
            </div>
            <div class="form-row">
              <label>Telefon (valfritt):</label>
              <input v-model="phone" type="text">
            </div>
            <div class="form-row">
              <label>Domän:</label>
              <input v-model="domain" type="text">
            </div>
            <div class="form-row">
             <label>Region (län):</label>
             <select v-model="region">
                <option value="" disabled selected>Välj län</option>
                <option v-for="län in regions" :key="län" :value="län">
                {{ län }} 
                </option>
             </select>
            </div>
            <div class="form-row">
              <label>Pris:</label>
              <input v-model="price" type="number">
            </div>
            <div class="form-row form-actions">
              <button type="submit" class="button-primary" >Lägg till tidning</button>
              <button type="button" @click="$emit ('close')" class="button-secondary">Stäng</button>
            </div>
          </form>
        </div>
      </div>
    `,    
  };