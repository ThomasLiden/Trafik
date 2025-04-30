
//Här finns även forgot password, kanske ska flyttas sen när man börjar hålla på med routes?
export default {
    template: `
    <div>
      <h2> Logga in </h2>
      <form @submit.prevent="login">
        <div>
        <label>E-post <span class="required">*</span></label>
         <input v-model="email" type="email" placeholder="E-post"  class="form-field" required />
         </div>
         <div>
         <label>Lösenord<span class="required">*</span></label>
         <input v-model="password" type="password" placeholder="Lösenord" class="form-field" required />
         </div>
         <button type="submit" class="button-primary"> Logga in </button>
      </form>
      <button @click="forgotPassword" style="margin-top: 1rem;" class="button-tertiary">Glömt lösenord?</button>
      <p v-if="message">{{ message }}</p>
    </div>
    `,
    data() {
        return {
            email: "",
            password: "",
            message: ""
        };
    },
    methods: {
        async login() {
            try {
                const response = await fetch("http://127.0.0.1:5000/api/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json"},
                    body: JSON.stringify({
                        email: this.email,
                        password: this.password
                    })
            });

            const data = await response.json();

         

            if (response.ok) {
                //Token och user_id sparas i localStorage
                
                localStorage.setItem("access_token", data.access_token);
                localStorage.setItem("user_id", data.user_id);


                this.message = "Inloggning lyckades!";
                console.log("Inloggad:", data); 

                this.$emit("login-success", { user_id: data.user_id });

                
            } else {
                this.message = data.error || "Fel vid inloggning";
            }
           } catch (error) {
             this.message = "Något gick fel vid inloggningen";
             console.error(error);
    
            }
        },

//forgot password
        async forgotPassword() {
            this.message = "";
          try {
            const response = await fetch("http://127.0.0.1:5000/api/forgot-password", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ email: this.email })
          });

          const data = await response.json();
          this.message = data.message || data.error;
        } catch (error) {
            this.message = "hittar ej"
            console.error(error);
        }
        }
    }       
};