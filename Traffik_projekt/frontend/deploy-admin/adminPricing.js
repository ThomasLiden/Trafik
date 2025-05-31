//hämta återanvändbar hjälpmetod för att göra api-anrop. 
import {apiFetch} from "../api.js"


export default {
  data() {
    return {
      currentPrice: null,
      newPrice: "",
      message: "",
      loading: false //används för att visa laddningsstatus och disable knappar. 
    };
  },
  created() {
    //När komponenten skapas - anropa funktion för att hämta nuvarande pris. 
    this.fetchprice();

  },
  methods: {
    //Metod för att hämta aktuellt pris för tidningen. 
    async fetchprice() {
      this.loading = true; //Visa laddning
      try {
        const data = await apiFetch("https://trafik-frontend-hzww.onrender.com/api/admin/pricing");
        this.currentPrice = data.price;
      } catch (err) {
        console.error("Fel vid hämtning:", err.message);
        this.message = data.message || "Kunde inte hämta priset";
      } finally {
        this.loading = false;
      }
    },
    //rensar formuläret.
    cancel() {
      this.newPrice = "";
      this.message = "";
    },
    //Metod för att spara prisändring. 
    async save() {
      if (!this.newPrice) {
        this.message = "Ange ett pris först.";
        return;
      }

      try {
        //skickar nytt pris till backend med POST. 
        const data = await apiFetch("https://trafik-frontend-hzww.onrender.com/api/admin/pricing/update", {
          method: "POST",
          body: JSON.stringify({ price: parseFloat(this.newPrice)})
        });
        //Uppdaterar det aktuella priset och visar bekräftelse.
        this.currentPrice = this.newPrice;
        this.message = data.message || "Priset har uppdaterats.";
        this.newPrice = "";

      } catch (err) {
        console.error("Fel vid uppdatering: ", err.message);
        this.message = data.message || "Kunde inte uppdatera priset.";
      }
    }
  },
  //HTML-struktur för komponenten. 
  template: `
    <div class="grid-container">
      <h1>Prissättning</h1>
        
        <div class="">
          <h3>Nuvarande prissättning</h3>
          <p v-if="loading">Laddar pris...</p>
          <p v-else-if="currentPrice !== null">{{ currentPrice }} kr/ månad</p>
          <p v-else>Inget pris angivet. </p>
        </div>

        <div class="">
          <h3>Redigera prissättning</h3>
          <p class="subtext">SMS-notiser skickas endast vid större trafikpåverkan. Detta är alltid inkluderat.</p>
        
        <div class="form-row">
          <label>Pris per månad:</label>
          <input v-model="newPrice" type="number" :disabled="loading" placeholder="Ange nytt pris..." />
        </div>

        <div class="button-group">
          <button class="button-secondary" @click="cancel" :disabled="loading">Avbryt</button>
          <button class="button-primary" @click="save" :disabled="loading">Spara</button>
        </div>

        <p v-if="message">{{ message }}</p>
        <p v-if="loading">Vänligen vänta...</p>
      </div>
    </div>
  `
};