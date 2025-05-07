export default {
    name: 'ResetPasswordForm',
    props: ['accessToken'],
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
        localAccessToken: ""
      };
    },
    created() {
      console.log("Prop Access Token:", this.accessToken);
      this.localAccessToken = this.accessToken || this.getAccessTokenFromURL();
      console.log("Final Access Token:", this.localAccessToken);
    },
    methods: {
      getAccessTokenFromURL() {
        const hash = window.location.hash.slice(1); // Ta bort #
        const params = new URLSearchParams(hash);
        const token = params.get('access_token') || '';
        console.log("Access Token from URL:", token);
        return token;
      },
      async resetPassword() {
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
            this.$emit('close');
          }
        } catch (error) {
          this.message = "Något gick fel vid återställning";
          console.error(error);
        }
      }
    }
  };
  