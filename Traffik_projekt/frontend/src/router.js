const { createRouter, createWebHashHistory } = VueRouter;

import SubscriptionModal from "./SubscriptionModal.js";
import MapView from "./MapView.js";
import LoginForm from "./LoginForm.js";
import ResetPasswordForm from "./ResetPasswordForm.js";

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
    !to.path.includes("/reset-password")
  ) {
    console.log(" Upptäckte token i hash – navigerar till /reset-password");
    next({ path: "/reset-password" });
  } else {
    next();
  }
});

export default router;
