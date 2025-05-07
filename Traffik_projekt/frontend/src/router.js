/* import { createRouter, createWebHashHistory } from 'vue-router' */

const { createRouter, createWebHashHistory } = VueRouter;

import SubscriptionModal from "./components/SubscriptionModal.js";
import MapView from "./components/MapView.js";
import LoginForm from "./components/LoginForm.js";
import ResetPasswordForm from './components/ResetPasswordForm.js';

const EmptyModal = { template: "" };

const routes = [
  /*      { path: '/',               name: 'map',      component: MapView }, */
  /*     { path: '/overview',       name: 'overview', component: OverviewView },  */
  {
    path: "/",
    name: "home",
    components: { default: MapView },
  },

  {
    path: "/signup",
    name: "signup",
    components: {
      modal: SubscriptionModal,
    },
  },

  {
    path: "/login",
    name: "login",
    components: {
      default: MapView,
      modal: LoginForm,
    },
    
  },

  {
    path: '/reset-password',
    name: 'reset-password',
    components: {
      default: MapView,
      modal: ResetPasswordForm
    },
    props: {
      modal: (route) => {
        console.log("Router Access Token:", route.query.access_token);
        return { accessToken: route.query.access_token || "" };
      }
    },
    beforeEnter: (to, from, next) => {
        console.log("Navigerar till ResetPasswordForm");
        next();
      },
      beforeEnter: (to, from, next) => {
        console.log("Navigerar till ResetPasswordForm");
        next();
      }

  }

 

  /*     { path: '/password-reset', name: 'reset',    component: ResetPasswordForm }, */
  // { path: '/verify/:token', name: 'verify', component: VerifyEmailForm, props: true },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

/*   router.beforeEach((to, from, next) => {
    console.log('NAVIGERA →', to.name, to.path, to.matched);
    next();
  }); */

console.log("SubscriptionModal", SubscriptionModal);

export default router;
