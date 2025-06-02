const BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://admin-lqz8.onrender.com/api";

import { apiFetch } from "../api.js";

export default {
  name: "AdminOverview",

  data() {
    return {
      statistics: {
        subscriptions: 0,
        sms_30days: 0,
        price: 0,
      },
      loading: true,
    };
  },

  async created() {
    //Hämta statistik för inloggad tidning. 
    try {
      const stats = await apiFetch(`${BASE_URL}/admin/reseller/stats`);
      this.statistics.subscriptions = stats.subscription_count || 0;
      this.statistics.sms_30days = stats.sms_30_days || 0;
    
    } catch (err) {
      console.error("Fel vid hämtning av statistik:", err);
    }
    
    //Hämtar pris för inloggad tidning.
    try {
      const priceData = await apiFetch(`${BASE_URL}/admin/pricing`);
      this.statistics.price = priceData.price || 0;
    } catch (err) {
      console.error("Fel vid hämtning av pris:", err);
    } finally {
      this.loading = false;
    }
},

  template: `
    <div class="admin-home container">
      <h2>Översikt</h2>

      <div v-if="loading" class="loading">
        Laddar statistik...
      </div>

      <div v-else class="card-row">
        <div class="card">
          <h3>Antal prenumeranter</h3>
          <p>{{ statistics.subscriptions }} st</p>
        </div>
        <div class="card">
          <h3>Skickade SMS </h3>
          <p>{{ statistics.sms_30days }} st</p>
          <p class="sms-meta" style="font-size: 1rem;">senaste 30 dagar</p>
        </div>
        <div class="card">
          <h3>Pris för tjänsten</h3>
          <p>{{ statistics.price ? statistics.price + ' kr/mån' : 'Ej angivet' }}</p>
        </div>
      </div>
    </div>
  `,
};