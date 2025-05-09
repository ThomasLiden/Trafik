
//Enbart nu för att testa. 
//localStorage.setItem("user_role", "superadmin");


import adminNavbar from "./components/adminNavbar.js";
import router from "./router.js";

const { createApp } = Vue;

const app = createApp({
    components: { adminNavbar },
    template: `
    <div>
        <adminNavbar></adminNavbar>
          <router-view></router-view>
    </div>
    `
});
app.use(router)
app.mount("#app");



