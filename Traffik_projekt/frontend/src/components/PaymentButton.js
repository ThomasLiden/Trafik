export default {
    // Tar emot props för att konfigurera knappen
    props: {
      type: String,      // 'payment' för engångsbetalning eller 'subscription' för prenumeration
      amount: {          // Belopp i öre (9900 = 99 kr)
        type: Number,
        default: 9900
      }
    },
    
    // Lokal state för att hantera laddningstillstånd
    data() {
      return {
        isLoading: false
      }
    },
  
    methods: {
      // Hanterar betalningsprocessen när knappen klickas
      async handlePayment() {
        this.isLoading = true;
        try {
          // Väljer rätt endpoint baserat på betalningstyp
          const endpoint = this.type === 'subscription' 
            ? '/api/stripe/create-subscription'
            : '/api/stripe/create-checkout-session';
  
          // Gör API-anrop till backend
          const response = await fetch('http://localhost:5000' + endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount: this.amount }),
          });
  
          if (!response.ok) {
            throw new Error('Något gick fel med betalningen');
          }
  
          // Hämtar checkout-URL:en från svaret
          const { url } = await response.json();
          // Omdirigerar till Stripe's betalningssida
          window.location.href = url;
        } catch (error) {
          console.error('Betalningsfel:', error);
          alert('Något gick fel med betalningen. Försök igen.');
        } finally {
          this.isLoading = false;
        }
      }
    },
  
    // Knappens utseende och beteende
    template: `
      <button 
        @click="handlePayment"
        :disabled="isLoading"
      >
        {{ isLoading ? 'Bearbetar...' : 'Betala' }}
      </button>
    `
  }