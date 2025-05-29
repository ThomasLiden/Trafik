
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
    try {
      // Hämta statistik för inloggad tidning
      const data = await apiFetch("http://localhost:5000/api/admin/reseller/stats");

      this.statistics = {
        subscriptions: data.subscription_count || 0,
        sms_30days: data.sms_30_days || 0,
        price: 79, // Du kan justera detta om det ska hämtas från API
      };

    } catch (err) {
      console.error("Kunde inte hämta statistik", err);
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
          <h3>Skickade SMS (senaste 30 dagar)</h3>
          <p>{{ statistics.sms_30days }} st</p>
        </div>
        <div class="card">
          <h3>Pris för tjänsten</h3>
          <p>{{ statistics.price }} kr/mån</p>
        </div>
      </div>
    </div>
  `,
};