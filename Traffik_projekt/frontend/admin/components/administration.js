import AddResellerModal from "./addResellerModal.js";

//Enbart påbörjad! 
// Modal för att lägga till tidningar fungerar! 

export default {
  components: { AddResellerModal },
  data() {
    return {
      showAddReseller: false
    };
  },



  template: `
    <div class="container">
      <h2>Administration</h2>

      <!-- adminsida för superadmin, där statistik visas, funktion för att lägga till en ny tidning osv -->

      <button @click="showAddReseller = true" class="button-secondary">Lägg till ny tidning</button>

      <add-reseller-modal 
        :show="showAddReseller" 
        @close="showAddReseller = false">
      </add-reseller-modal>
    </div>
  `
};