// frontend/src/router.js
const { createRouter, createWebHashHistory } = VueRouter;

// Importera dina sidkomponenter och modalkomponenter
import MapView from "./components/MapView.js";
import SubscriptionModal from "./components/SubscriptionModal.js";
import LoginForm from "./components/LoginForm.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";

const routes = [
  {
    path: "/",
    name: "home",
    component: MapView, // MapView är nu huvudkomponenten för kartan
  },
  {
    path: "/signup",
    name: "signup",
    // Komponent som visas i <router-view name="modal">
    components: { default: MapView, modal: SubscriptionModal }, 
    meta: { isModal: true } // För att veta att vi ska navigera hem vid close
  },
  {
    path: "/login",
    name: "login",
    components: { default: MapView, modal: LoginForm },
    meta: { isModal: true }
  },
  {
    path: "/reset-password", // Denna route matchar länken från Supabase
    name: "reset-password",
    components: { default: MapView, modal: ResetPasswordForm },
    meta: { isModal: true }
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

//  Om access_token finns i hash men vi inte redan är på rätt route
router.beforeEach((to, from, next) => {
  if (
    window.location.hash.includes("access_token") &&
    (window.location.hash.includes("type=recovery") || !to.path.includes("/reset-password")) && // och type=recovery eller om vi inte är där
    to.name !== "reset-password"
  ) {

    console.log("Upptäckte lösenordsåterställningstoken i URL, navigerar till /reset-password");
    next({ name: "reset-password", hash: window.location.hash }); // Skicka med hashen
  } else {
    next();
  }
});

export default router;