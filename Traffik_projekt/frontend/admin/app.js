import adminNavbar from "./components/adminNavbar.js";
import router from "./router.js";

const { createApp } = Vue;

//Skapa Vue-appen. 
const app = createApp({
  components: { adminNavbar },

  //Global data i appen. 
  data() {
    return {
      //Kolla om det finns en token. 
      isLoggedIn: !!localStorage.getItem("access_token"),
      //Hämta roll.
      userRole: localStorage.getItem("user_role") || null
    };
  },

  //Metoder som används globalt i appen. 
  methods: {
    //körs när login lyckats. 
    handleLoginSuccess(data) {
      //Spara token och användardata i localstorage. 
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_role", data.role);
      localStorage.setItem("reseller_id", data.reseller_id);
      
      //Uppdatera appens tillstånd.
      this.isLoggedIn = true;
      this.userRole = data.role;
      
      //Navigera till översiktssidan. 
      this.$router.push("/admin");
    },
    //Hantera utloggning. 
    handleLogout() {
      //Rensa all sparad data.
      localStorage.clear();
      //Återställ inloggningsstatus och skicka tillbaka till inloggningssidan.
      this.isLoggedIn = false;
      this.userRole = null;
      this.$router.push("/admin/login");
    }
  },

  template: `
    <div>
      <adminNavbar
        :is-logged-in="isLoggedIn"
        :role="userRole"
        @logout="handleLogout"
      />
      <router-view @login-success="handleLoginSuccess"></router-view>
    </div>
  `
});

app.use(router);
app.mount("#app");
