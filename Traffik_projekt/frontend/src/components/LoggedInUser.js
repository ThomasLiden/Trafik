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
        let res = await fetch(`http://127.0.0.1:5000/api/user-profile?user_id=${this.userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        this.profile = await res.json();
  
        // Hämta abonnemang
        res = await fetch(`http://127.0.0.1:5000/api/subscriptions?user_id=${this.userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        this.subscriptions = await res.json();
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
            let res = await fetch(`http://127.0.0.1:5000/api/user-profile?user_id=${this.userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            this.profile = await res.json();

            // Hämta abonnemang
            res = await fetch(`http://127.0.0.1:5000/api/subscriptions?user_id=${this.userId}`, {
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
            const res = await fetch("http://127.0.0.1:5000/api/cancel-subscription", {
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
      <p>E-post: {{ profile.email }}</p>
      <p>Telefon: {{ profile.phone }}</p>

      <h3>Dina prenumerationer</h3>
      <ul v-if="subscriptions.length > 0" style="list-style-type: none;">
        <li v-for="sub in subscriptions" :key="sub.subscription_id">
          <strong>Status:</strong> {{ sub.active ? 'Aktiv' : 'Inaktiv' }} <br />
          <strong>Plats:</strong> {{ sub.location || 'Ingen plats' }} <br />
          <strong>Skapad:</strong> {{ new Date(sub.created_at).toLocaleString() }} <br />
          <strong>Pris: 49</strong>
          <button v-if="sub.active" @click="removeSubscription(sub.subscription_id)">Avsluta</button>
        </li>
      </ul>
      <p v-else>Inga prenumerationer hittades.</p>

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
  