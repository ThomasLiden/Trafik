import adminNavbar from "./components/adminNavbar.js";
import router from "./router.js";

const { createApp } = Vue;

const app = createApp({
  components: { adminNavbar },

  data() {
    return {
      isLoggedIn: !!localStorage.getItem("access_token"),
      userRole: localStorage.getItem("user_role") || null
    };
  },

  methods: {
    handleLoginSuccess(data) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_role", data.role);
      localStorage.setItem("reseller_id", data.reseller_id);

      this.isLoggedIn = true;
      this.userRole = data.role;

      this.$router.push("/admin");
    },

    handleLogout() {
      localStorage.clear();
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


