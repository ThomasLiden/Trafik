export default {
  data() {
    return {
      reseller_id: "",
      name: "",
      lan: "",
      phone: "",
      email: "",
      message: ""
    };
  },
  created() {
    const resellerId = localStorage.getItem("reseller_id");
  
    fetch(`http://localhost:5000/api/admin/account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reseller_id: resellerId })
    })
      .then(async res => {
        if (!res.ok) {
          const err = await res.text();
          console.error("Fel vid hämtning:", err);
          return;
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
  
        this.name = data.name || "";
        this.lan = data.region || "";
        this.phone = data.phone || "";
        this.email = data.email || "";
        this.reseller_id = data.reseller_id;
      });
  },
  methods: {
    saveProfile() {
      fetch("http://localhost:5000/api/admin/account/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reseller_id: this.reseller_id,
          name: this.name,
          region: this.lan,
          phone: this.phone,
          email: this.email
        })
      })
      .then(async res => {
        if (!res.ok) {
          const err = await res.text();
          console.error("Fel vid uppdatering:", err);
          this.message = "Kunde inte spara ändringar.";
          return;
        }
        const data = await res.json();
        this.message = data.message || "Uppdaterat!";
      })
      .catch(err => {
        console.error("Nätverksfel:", err);
        this.message = "Ett nätverksfel uppstod.";
      });
    }
  },
  template: `
    <div class="container">
      <h1>Kontoinställningar</h1>
      <p>Här kan du ändra dina kontaktuppgifter.</p>
    
    <form class="form-grid">
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
        <button class="button-primary" @click="saveProfile">Spara</button>
      </div>
      <p v-if="message">{{ message }}</p>
    </form>
  </div>
  `
};