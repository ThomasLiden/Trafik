
//EJ KLAR! - Behöver hämtas data på riktigt via blueprint och uppdatera api-anrop. 

export default {

    data() {
      return {
        statistik: {
          prenumeranter: 0,
          sms_antal: 0,
          pris_per_månad: 0
        },
        useMockData: true, // Sätt till false senare för riktig API-data
        loading: true
      };
    },
    created() {
      if (this.useMockData) {
        // MOCKAD DATA
        setTimeout(() => {
          this.statistik = {
            prenumeranter: 123,
            sms_antal: 87,
            pris_per_månad: 79
          };
          this.loading = false;
        }, 500); // Liten delay för att simulera laddning
      } else {
        // RIKTIG API-KOPPLING - ändras till att använda api.js som hjälpmetod!
        const token = localStorage.getItem("access_token") || "mock-tidning";
        
        fetch(`http://localhost:5000/api/stats?tidning=${token}`)
          .then(res => res.json())
          .then(data => {
            this.statistik = data;
            this.loading = false;
          })
          .catch(err => {
            console.error("Kunde inte hämta statistik", err);
            this.loading = false;
          });
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
            <p>{{ statistik.prenumeranter }} st</p>
          </div>
          <div class="card">
            <h3>Antal skickade SMS (senaste månaden)</h3>
            <p>{{ statistik.sms_antal }} st</p>
          </div>
          <div class="card">
            <h3>Nuvarande pris för tjänsten</h3>
            <p>{{ statistik.pris_per_månad }} kr/mån</p>
          </div>
        </div>
      </div>
    `
  };