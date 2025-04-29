import PaymentButton from './PaymentButton.js';

export default {
  // Registrerar PaymentButton som en underkomponent
  components: {
    PaymentButton
  },

  // Sidans layout och innehåll
  template: `
    <div>
      <h2>Betalning</h2>
      
      <!-- Sektion för engångsbetalning -->
      <div>
        <h3>Engångsbetalning - 99 SEK</h3>
        <!-- Skickar med type="payment" för att indikera engångsbetalning -->
        <payment-button type="payment" :amount="9900" />
      </div>

      <!-- Sektion för prenumeration -->
      <div>
        <h3>Prenumeration - 49 SEK/månad</h3>
        <!-- Skickar med type="subscription" för att indikera prenumeration -->
        <payment-button type="subscription" />
      </div>
    </div>
  `
}