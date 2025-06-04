const { createRouter, createWebHashHistory } = VueRouter;

import SubscriptionModal from "./SubscriptionModal.js";
import MapView from "./MapView.js";
import LoginForm from "./LoginForm.js";
import ResetPasswordForm from "./ResetPasswordForm.js";
import LoggedInUser from "./LoggedInUser.js";
import ThankYou from "./ThankYou.js";

const routes = [
  {
    path: "/",
    name: "home",
    components: { default: MapView },
  },
  {
    path: "/signup",
    name: "signup",
    components: { modal: SubscriptionModal },
  },
  {
    path: "/login",
    name: "login",
    components: { default: MapView, modal: LoginForm },
  },
  {
    path: "/reset-password",
    name: "reset-password",
    components: { default: MapView, modal: ResetPasswordForm },
  },
  {
    path: "/dashboard",
    name: "dashboard",
    components: { default: LoggedInUser },
  },
  {
    path: "/thank-you",
    name: "thank-you",
    components: { default: ThankYou },
  },
  
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

//  Om access_token finns i hash men vi inte redan är på rätt route
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("access_token");

  // Specialfall för återställning
  if (
    window.location.hash.includes("access_token") &&
    !to.path.includes("/reset-password")
  ) {
    console.log("🔐 Upptäckte token i hash – navigerar till /reset-password");
    next({ path: "/reset-password" });

  // Skydda dashboard om användaren inte är inloggad
  } else if (to.path === "/dashboard" && !token) {
    console.log(" Försök att gå till /dashboard utan token – redirect till /login");
    next({ path: "/login" });

  } else {
    next(); // Allt annat tillåts
  }
});


export default router;
