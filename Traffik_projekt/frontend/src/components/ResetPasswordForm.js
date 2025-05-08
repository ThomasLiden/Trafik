export default {
    name: 'ResetPasswordForm',
   /*  props: ['access_token'], */
    template: `
      <div>
        <h2> Återställ lösenord </h2>
        <form @submit.prevent="resetPassword">
          <input v-model="newPassword" type="password" placeholder="Nytt lösenord" class="form-field" required /> 
          <button type="submit" class="button-primary">Byt lösenord </button>
        </form>
        <p v-if="message">{{ message }} </p>
      </div>
    `,
    data() {
      return {
        newPassword: "",
        message: "",
       /*  localAccessToken: "" // Används för att hantera token lokalt */
       success: false,
       accessToken: this.$route.query.token
      };
    },
  /*   mounted() {
      this.initializeAccessToken();
    }, */
    methods: {
      async resetPassword() {
        if (!this.newPassword) {
          this.message = "Ange ett nytt lösenord.";
          return;
        }
  
        try {
          const response = await fetch('http://127.0.0.1:5000/api/reset-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: this.accessToken,
              new_password: this.newPassword,
            }),
          });
  
          const data = await response.json();
          this.message = data.message || data.error;
  
          if (response.ok) {
            this.success = true;
            setTimeout(() => {
              this.$router.push('/login'); // Om direkt till inloggningssidan efter lyckad återställning
            }, 2000);
          }
        } catch (error) {
          this.message = "Ett fel uppstod. Försök igen.";
        }
      },
    },

/*       initializeAccessToken() {
        // Försök använda prop (access_token)
        if (this.access_token) {
          this.localAccessToken = this.access_token;
          console.log("Access Token from Prop:", this.localAccessToken);
        } else {
          // Om prop inte finns, försök läsa från URL
          const hash = window.location.hash.slice(1);
          const params = new URLSearchParams(hash);
          this.localAccessToken = params.get('access_token') || '';
          console.log("Access Token from URL:", this.localAccessToken);
        }
  
        if (!this.localAccessToken) {
          console.error("Ingen giltig token hittades.");
        }
      }, */
/*   
      async resetPassword() {
        console.log("Access Token:", this.localAccessToken);
        console.log("Nytt lösenord:", this.newPassword);
        
        if (!this.localAccessToken) {
          this.message = "Ingen giltig återställningstoken.";
          return;
        }
  
        try {
          const response = await fetch("http://127.0.0.1:5000/api/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: this.localAccessToken,
              new_password: this.newPassword
            })
          });
  
          const data = await response.json();
          this.message = data.message || data.error;
  
          if (response.ok) {
            this.message = "Lösenordet har ändrats!";
            setTimeout(() => {
              this.$emit('close');
            }, 1500);
          }
        } catch (error) {
          this.message = "Något gick fel vid återställning";
          console.error(error);
        }
      } */
    
  };
  