import UpdateProfileForm from "./UpdateProfileForm.js";


export default {
    name: "LoggedInUser",
    props: ["userId"],
    components: {
        UpdateProfileForm},
    data() {
      return {
        profile: {
            first_name: '',
            email: '',
            phone: ''
          },
        subscriptions: [],
        price: null,
        resellerName: null,
        message: "",
        editing: false,
      };
    },
    async mounted() {
      await this.reloadProfile();
      /* const token = localStorage.getItem("access_token"); */
      try {
        if (!this.userId) return;     // ingen userId → inget fetch
        const token = localStorage.getItem("access_token");
        // Hämta profil
        let res = //await fetch(`https://trafik-q8va.onrender.com/api/user-profile?user_id=${this.userId}`, {
                    await fetch(`http://127.0.0.1:5000/api/user-profile?user_id=${this.userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        this.profile = await res.json();
  
        // Hämta abonnemang
        res = //await fetch(`https://trafik-q8va.onrender.com/api/subscriptions?user_id=${this.userId}`, {
              await fetch(`http://127.0.0.1:5000/api/subscriptions?user_id=${this.userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        this.subscriptions = await res.json();

        // Hämta pris från reseller
        const resellerId = this.profile.reseller_id;
        if (resellerId) {
          const resellerRes = await fetch(`http://127.0.0.1:5000/api/reseller-info?reseller_id=${resellerId}`); //await fetch(`https://trafik-q8va.onrender.com/api/reseller-info?reseller_id=${resellerId}`);
          const resellerData = await resellerRes.json();
          this.price = resellerData.price;
          this.resellerName = resellerData.name;
        } else {
          this.resellerName = "Ej angiven";
          this.price = null;
        }
      } catch (err) {
        console.error(err);
        this.message = "Kunde inte hämta data.";
      }
    },
    methods: {
      async reloadProfile() {
        const token = localStorage.getItem("access_token");
        try {
            if (!this.userId) return;
            // Hämta profil
            let res = await fetch(`https://trafik-q8va.onrender.com/api/user-profile?user_id=${this.userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            this.profile = await res.json();

            // Hämta abonnemang
            res = await fetch(`https://trafik-q8va.onrender.com/api/subscriptions?user_id=${this.userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            this.subscriptions = await res.json();
            console.log("Hämtade prenumerationer:", this.subscriptions); 
        } catch (err) {
            console.error(err);
            this.message = "Kunde inte hämta data.";
        }
    },
      async logout() {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_id");
        this.$emit("logout");
      },
      backToMap() {
        // Skicka event uppåt
        this.$emit("back-to-map");
      },
      async removeSubscription(subscriptionId) {
        if (!confirm("Är du säker på att du vill avsluta denna prenumeration?")) return;

        try {
            const res = await fetch("https://trafik-q8va.onrender.com/api/cancel-subscription", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ subscription_id: subscriptionId })
            });

            if (res.ok) {
                this.subscriptions = this.subscriptions.map(sub => {
                    if (sub.subscription_id === subscriptionId) {
                        sub.active = false;
                    }
                    return sub;
                });
                this.message = "Prenumerationen har avslutats.";
            } else {
                const data = await res.json();
                this.message = data.error || "Kunde inte avsluta prenumerationen.";
            }
        } catch (err) {
            console.error(err);
            this.message = "Tekniskt fel vid avslut av prenumeration.";
        }
    }

    },
    template: `
        <div v-if="profile" class="logged-in-user">
        <button class="button-tertiary" @click="$emit('back-to-map')">
        Till kartan
        </button>

      <h2>Välkommen, {{ profile.first_name }}!</h2>
      <p><strong>E-post:</strong> {{ profile.email }}</p>
      <p><strong>Telefon:</strong> {{ profile.phone }}</p>

      <div class="subscription-info">
        <h3>Dina prenumerationer</h3>
        <p v-if="resellerName">Tidning: {{ resellerName }}</p>
        <p><strong>Pris per månad: </strong> {{ price }} kr</p>

        <ul v-if="subscriptions.length > 0">
          <li v-for="sub in subscriptions" :key="sub.subscription_id">
          {{ sub.period }} 
           <span :class="{ active: sub.active, inactive: !sub.active }">
            {{ sub.active ? 'Aktiv' : 'Inaktiv' }}
           </span>
        </li>   
          <button @click="removeSubscription(sub.subscription_id)">Avsluta</button>
        
      </ul>
      <p v-else>Inga prenumerationer hittades.</p>
      </div>

      <button class="button-secondary" @click="logout">Logga ut</button>
      <button class="button-secondary" @click="editing = true">Ändra uppgifter</button>
      <update-profile-form v-if="editing"
         @profile-updated="reloadProfile(); editing = false"
         @cancel="editing = false"
            />

    </div>
    <p v-else>Laddar profil…</p>
    `
  };
  