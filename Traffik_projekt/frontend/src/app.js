const { createApp } = Vue;

createApp({
  data() {
    return {
      email: '',
      password: '',
      message: ''
    };
  },
  methods: {
    async signup() {
      try {
        const response = await fetch('http://localhost:5000/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: this.email,
            password: this.password
          })
        });

        const data = await response.json();
        this.message = data.message || data.error;
      } catch (error) {
        this.message = 'Ett fel uppstod vid registrering.';
        console.error(error);
      }
    }
  }
}).mount('#app');
