export default {
    props: ["show", "onClose"],
    data() {
      return {
        name: "",
        email: "",
        password: "",
        phone: "",
        domain: "",
        region: "",
        price: "",
        message: ""
      };
    },
    template: `
      <div v-if="show" class="modal">
        <div class="modal-content">
          <span class="close-button" @click="onClose">&times;</span>  
          <h3>Lägg till ny tidning</h3>
          <p v-if="message" style="color:red;">{{ message }}</p>
  
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
              <input v-model="region" type="text">
            </div>
            <div class="form-row">
              <label>Pris:</label>
              <input v-model="price" type="number">
            </div>
            <div class="form-row">
              <button type="submit" class="button-primary" >Lägg till tidning</button>
              <button type="button" @click="onClose" class="button-secondary">Stäng</button>
            </div>
          </form>
        </div>
      </div>
    `,
    methods: {
      async addReseller() {
        this.message = "";
  
         if (!this.name || !this.email || !this.password || !this.domain || !this.region || !this.price) {
          this.message = "Fyll i alla fält (telefon valfritt)";
          return;
        }
        const creator_id = localStorage.getItem("reseller_id");
  
        try {
          const response = await fetch("http://localhost:5000/api/admin/create_reseller", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("access_token")}`
            },
            body: JSON.stringify({
              creator_id: creator_id,
              name: this.name,
              email: this.email,
              password: this.password,
              phone: this.phone || null, 
              domain: this.domain,
              region: this.region,
              price: this.price !== "" ? parseFloat(this.price) : null
            })
          });
  
          const data = await response.json();
  
          if (!response.ok) {
            this.message = data.error || "Fel vid skapande.";
            return;
          }
  
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
    
  };