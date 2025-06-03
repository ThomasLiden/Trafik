export default {
  name: "ResellerTable",

  //props som  skickas in från föräldrakomponenten. 
  props: {
    //Lista med alla tidningar. 
    resellers: {
      type: Array,
      required: true,
    },
    //Eventuella valda filter för län eller tidning.
    regionFilter: {
      type: String,
      default: "",
    },
    resellerIdFilter: {
      type: String,
      default: "",
    },
  },
  data() {
    //Användarens fritextsökning i sökfältet. 
    return {
      searchQuery: "",
    };
  },
  computed: {
    //Listan som visas i tabellen. 
    displayedResellers() {
      let list = this.resellers;

      // Filtrera först på tidning om satt
      if (this.resellerIdFilter) {
        list = list.filter((r) => r.reseller_id === this.resellerIdFilter);
      }
      // Annars filtrera på region
      else if (this.regionFilter) {
        list = list.filter((r) => r.region === this.regionFilter);
      }

      // Filtrera på sökord i sökrutan. 
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        list = list.filter((r) =>
          [r.name, r.email, r.region].some((field) =>
            (field || "").toLowerCase().includes(query)
          )
        );
      }

      return list;
    },
  },
  template: `
    <div class="reseller-table">
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Sök tidning, e-post eller län..."
        class="table-search"
      />
      
      <!-- Tabell med tidningar. -->
      <table>
        <thead>
          <tr>
            <th>Tidningsutgivare</th>
            <th>E-post</th>
            <th>Län</th>
            <th>Reseller ID</th>
          </tr>
        </thead>
        <tbody>
        <!-- Om inga rader matchar filtreringen.  -->
          <tr v-if="!displayedResellers.length">
            <td colspan="4" class="empty-row">
              Inga återförsäljare hittades.
            </td>
          </tr>
          <!-- Lista ut alla återförsäljare. -->
          <tr v-for="r in displayedResellers" :key="r.reseller_id">
            <td>{{ r.name }}</td>
            <td>{{ r.email }}</td>
            <td>{{ r.region }}</td>
            <td>{{ r.reseller_id }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
};