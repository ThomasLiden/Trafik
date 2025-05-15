//Ej påbörjad - enbart htmlstruktur finns! 


export default {
  data() {
    return {
      currentPrice: 39,
      newPrice: "",
      message: ""
    };
  },
  template: `
    <div class="grid-container">
      <h1>Prissättning</h1>

      <div class="container-small">

        <h3>Nuvarande prissättning</h3>
        <p>{{ currentPrice }} kr/ månad</p>

        <div class="">
          <h3>Redigera prissättning</h3>
          <p class="subtext">SMS-notiser skickas endast vid större trafikpåverkan. Detta är alltid inkluderat.</p>
        
        <div class="form-row">
          <label>Pris per månad:</label>
          <input v-model="newPrice" type="number" placeholder="Ange nytt pris..." />
        </div>

        <div class="button-group">
          <button class="button-secondary" @click="cancel">Avbryt</button>
          <button class="button-primary" @click="save">Spara</button>
        </div>

        <p v-if="message">{{ message }}</p>
      </div>
    </div>
  `,
  methods: {
    cancel() {
      this.newPrice = "";
      this.message = "";
    },
    save() {
      if (!this.newPrice) {
        this.message = "Ange ett pris först.";
        return;
      }
      this.currentPrice = this.newPrice;
      this.message = "Priset har uppdaterats.";
      this.newPrice = "";
    }
  }
};