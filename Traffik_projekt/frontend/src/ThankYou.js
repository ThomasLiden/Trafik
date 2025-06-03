export default {
    template: `
      <section class="thank-you">
        <h1>Tack för din beställning! 🎉</h1>
        <p>Din betalning är registrerad. Du har nu tillgång till tjänsten.</p>
        <router-link to="/dashboard">
          <button class="go-dashboard">Gå till Min Sida</button>
        </router-link>
      </section>
    `,
    mounted() {
      const sessionId = this.$route.query.session_id;
      if (sessionId) {
        console.log("✅ Stripe session ID:", sessionId);
        // Här kan du lägga till en validering mot backend om du vill
      }
    }
  };
  