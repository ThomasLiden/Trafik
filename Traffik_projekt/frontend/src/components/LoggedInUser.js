export default {
    name: "LoggedInUser",
    props: ["userId"],
    data() {
      return {
        profile: {
            first_name: '',
            email: '',
            phone: ''
          },
        subscriptions: [],
        message: ""
      };
    },
    async mounted() {
      const token = localStorage.getItem("access_token");
      try {
        // Hämta profil
        let res = await fetch(`http://127.0.0.1:5000/api/user-profile?user_id=${this.userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        this.profile = await res.json();
  
        // Hämta abonnemang (gör en ny route t.ex. /api/subscriptions?user_id=…)
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
      async logout() {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_id");
        this.$emit("logout");
      }
    },
    template: `
        <div v-if="profile">
      <h2>Välkommen, {{ profile.first_name }}!</h2>
      <p>E-post: {{ profile.email }}</p>
      <p>Telefon: {{ profile.phone }}</p>

      <h3>Dina prenumerationer</h3>
      <ul>
        <li v-for="sub in subscriptions" :key="sub.subscription_id">
          {{ sub.period }} – {{ sub.active ? 'Aktiv' : 'Inaktiv' }}
          <button @click="removeSubscription(sub.subscription_id)">Avsluta</button>
        </li>
      </ul>

      <button class="button-secondary" @click="logout">Logga ut</button>
    </div>
    <p v-else>Laddar profil…</p>
    `
  };
  