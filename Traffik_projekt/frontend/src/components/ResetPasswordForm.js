
export default {
    template: `
       <div>
         <h2> Återställ lösenord </h2>
         <form @submit.prevent="resetPassword">
             <input v-model="newPassword" type="password" placeholder="Nytt lösenord" required /> 
             <button type="submit">Byt lösenord </button>
         </form>
         <p v-if="message">{{ message }} </p>
       </div>
    `,

    data() {
        return {
            newPassword: "",
            message: "", 
            accessToken: ""
        };
    },

    mounted() {
        // Hämta access_token från URL:en
        const params = new URLSearchParams(window.location.search);
        this.accessToken = params.get("access_token");
    },
    methods: {
        async resetPassword() {
          try {
            const response = await fetch("http://127.0.0.1:5000/api/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    access_token: this.accessToken,
                    new_password: this.newPassword
                })
          });

          const data = await response.json();
          this.message = data.message || data.error;
        } catch (error) {
            this.message = "Något gick fel vid återställning";
            console.error(error);
        }
    }
}
}; 