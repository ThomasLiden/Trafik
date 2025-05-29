import AddResellerModal from "./addResellerModal.js";
import ResellerTable from "./resellersTable.js";
import { apiFetch } from "../api.js";
import regions from "../regions.js";

export default {
  //Registrera komponenter som används. 
  components: { AddResellerModal, ResellerTable },
  data() {
    return {
      regions,
      selectedRegion: "",
      selectedReseller: "",
      selectedResellerName: "",
      stats: null,
      resellers: [],
      message: "",
      showAddReseller: false,
      hasSearched: false,
    };
  },
  computed: {
    //Returnerar resellers filtrerade på valt län (används för dropdown.)
    filteredResellers() {
      if (!this.selectedRegion) return this.resellers;
      return this.resellers.filter((r) => r.region === this.selectedRegion);
    },
  },
  mounted() {
    this.fetchResellers(); // Ladda alla tidningar direkt från api. 
  },
  methods: {
    //Hämta alla tidningar från backend. 
    async fetchResellers() {
      try {
        const data = await apiFetch("http://localhost:5000/api/admin/resellers");
        this.resellers = data.resellers || [];
        this.message = this.resellers.length
          ? ""
          : "Inga tidningar hittades.";
      } catch (err) {
        console.error("Fel vid hämtning:", err.message);
        this.message = "Kunde inte hämta tidningar.";
      }
    },
    //Hämta all statistik baserat på valt län eller tidning. 
    async fetchStats() {
      //Om inget val är gjort - visa inte statistikrutan. 
      if (!this.selectedRegion && !this.selectedReseller) {
        this.hasSearched = false;
        this.selectedResellerName= "";
        return;
      }

      this.hasSearched = true;
      this.message = "";
      this.stats = null;

      try {
        //Bygg upp URL med query-parametrar. 
        let url = `http://localhost:5000/api/admin/stats`;
        const params = [];

        if (this.selectedRegion) {
          params.push(`region=${encodeURIComponent(this.selectedRegion)}`);
        }
        if (this.selectedReseller) {
          params.push(`reseller_id=${this.selectedReseller}`);
        }
        if (params.length) {
          url += "?" + params.join("&");
        }

        const data = await apiFetch(url);
        this.stats = data;
        
        //Hämta och visa namnet på vald tidning i rubrik. 
        const found = this.resellers.find(
          (r) => r.reseller_id === this.selectedReseller
        );
        this.selectedResellerName = found ? found.name : "";

      } catch (err) {
        console.error("Fel vid hämtning:", err.message);
        this.message = "Kunde inte hämta statistik.";
      }
    },
    async handleRegionChange() {
    // När län ändras, nollställ vald tidning om den inte längre finns efter filter
      const stillExists = this.filteredResellers.some(
        (r) => r.reseller_id === this.selectedReseller
      );

      if (!stillExists) {
        this.selectedReseller = "";
        this.selectedResellerName = "";
      }

      // Rensa tidigare statistik
      this.stats = null;
      this.hasSearched = false;

      await this.fetchStats();  //Uppdatera statistik automatiskt när län ändras.
    },
  },

  template: `
    <div class="container">
      <h2>Administration</h2>
      <p>Filtrera på län eller tidning för att visa statistik.</p>
      <!-- Filtersektion -->
      <div class="search-grid">
        <div class="form-row">
          <label>Filtrera efter län:</label>
          <select v-model="selectedRegion" @change="handleRegionChange">
            <option value="">Alla län</option>
            <option v-for="region in regions" :key="region" :value="region">
              {{ region }}
            </option>
          </select>
        </div>

        <div class="form-row">
          <label>Välj tidning:</label>
          <select v-model="selectedReseller" @change="fetchStats">
            <option value="">Alla tidningar</option>
            <option
              v-for="r in filteredResellers"
              :key="r.reseller_id"
              :value="r.reseller_id"
            >
              {{ r.name }}
            </option>
          </select>
        </div>
        <div class="form-row btn-actions">
          <button @click="showAddReseller = true" class="button-secondary">Lägg till ny tidning</button>
        </div>

        <p v-if="message">{{ message }}</p>
      </div>
      
      <!-- Statistikruta -->
      <div class="stats-summary">
          <h4>Statistik för 
            <template v-if="selectedResellerName"> {{ selectedResellerName }} </template>
            <template v-else-if="selectedRegion"> {{ selectedRegion}} </template>
            <template v-else> Alla län </template>
          </h4>
          <template v-if="hasSearched && stats && (stats.sms_count > 0 || stats.subscription_count > 0)">
            <div class="stats-card">
              <p><strong>Aktiva prenumerationer:</strong> {{ stats.subscription_count }}</p>
              <p class="sms-line">
                <strong>{{ stats.sms_30_days ?? 0 }}</strong>
                <span class="sms-meta">SMS (30 dagar)</span>
              </p>
              <p class="sms-line">
                <strong>{{ stats.sms_12_months ?? 0 }}</strong>
                <span class="sms-meta">SMS (12 månader)</span>
              </p>
            </div>
          </template>
        <template v-else-if="hasSearched && stats && stats.sms_count === 0 && stats.subscription_count === 0">
          <div class="loading-placeholder">
            Ingen statistik hittades för det valda urvalet.
          </div>
        </template>
        <template v-else>
          <div class="loading-placeholder">
            Välj ett län eller en tidning för att visa antal prenumeranter och SMS.
          </div>
        </template>
      </div>
      
      <!-- Tabell med tidningsåterförsäljare. -->
      <reseller-table :resellers="resellers" :region-filter="selectedRegion" :reseller-id-filter="selectedReseller"
      />
      
      <!-- Modal för att lägga till en ny tidning -->
      <add-reseller-modal
        :show="showAddReseller"
        @close="showAddReseller = false"
      />
    </div>
  `,
};