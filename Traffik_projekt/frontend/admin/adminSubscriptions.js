import { apiFetch } from "./api.js";

const BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://admin-lqz8.onrender.com/api";

export default {
  name: "ResellerStatsComponent",

  // Komponentens tillstånd/data
  data() {
    return {
      subscriptions: {
        activeSubscribers: 0, // Antal aktiva prenumeranter
      },
      users: [],             // Lista över användare kopplade till tidningen
      smsCount30: 0,         // Antal SMS senaste 30 dagar
      smsCount365: 0,        // Antal SMS senaste 12 månader
      loading: true,         // Visar om data fortfarande laddas
    };
  },

  // När komponenten skapas – hämta statistik och användare
  async created() {
    try {
      // Hämtar statistik för inloggad återförsäljare (tidning)
      const stats = await apiFetch(`${BASE_URL}/admin/reseller/stats`);

      // Sparar data från API-anropet
      this.subscriptions.activeSubscribers = stats.subscription_count || 0;
      this.smsCount30 = stats.sms_30_days || 0;
      this.smsCount365 = stats.sms_12_months || 0;
    } catch (err) {
      console.error("Kunde inte hämta statistik", err);
    }

    try {
      // Hämtar lista med användare kopplade till tidningen
      const usersData = await apiFetch(`${BASE_URL}/admin/reseller/users`);
      this.users = usersData.users || [];
    } catch (err) {
      console.error("Kunde inte hämta användare", err);
    }

    // Avsluta laddning
    this.loading = false;
  },

  // HTML-mallen med statistik och användartabell
  template: `
    <div class="admin-subscriptions container">
      <h2>Prenumerationer</h2>

      <!-- Visa laddningsindikator tills all data är hämtad -->
      <div v-if="loading" class="loading">
        Laddar prenumerationsdata...
      </div>

      <!-- Visa statistikruta och användartabell -->
      <div v-else>
        <div class="statistik-box"
             style="margin-bottom: 2rem; padding: 1rem; background: #eee; border-radius: 8px; max-width: 400px;">
          <div><b>Aktiva prenumeranter:</b> {{ subscriptions.activeSubscribers }}</div>

          <div style="margin-top: 1rem;">
            <b>SMS-utskick:</b>
            <div><strong>{{ smsCount30 }}</strong> <small>(senaste 30 dagar)</small></div>
            <div><strong>{{ smsCount365 }}</strong> <small>(senaste 12 månader)</small></div>
          </div>
        </div>

        <!-- Användartabell med scrollbar -->
        <div>
          <h3>Användare</h3>
          <div class="user-table-container"
               style="max-height: 250px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; background: #fafafa;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="padding: 8px; border-bottom: 1px solid #eee;">Namn</th>
                  <th style="padding: 8px; border-bottom: 1px solid #eee;">E-post</th>
                  <th style="padding: 8px; border-bottom: 1px solid #eee;">Aktiv</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.email">
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">{{ user.first_name + ' ' + user.last_name }}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">{{ user.email }}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">{{ user.active ? 'JA' : 'NEJ' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
};