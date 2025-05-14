

const { createRouter, createWebHashHistory } = VueRouter;

import SubscriptionModal from "./components/SubscriptionModal.js";
import MapView from "./components/MapView.js";
import LoginForm from "./components/LoginForm.js";
import ResetPasswordForm from './components/ResetPasswordForm.js';

const EmptyModal = { template: "" };
//needed for close modal

const routes = [

  {
    path: "/",
    name: "home",
    components: { default: MapView },
  },

  //create subscription, component is presented in the modal
  {
    path: "/signup",
    name: "signup",
    components: {
      modal: SubscriptionModal,
    },
  },

  // log in page, also inside modal 
  {
    path: "/login",
    name: "login",
    components: {
      default: MapView,
      modal: LoginForm,
    },
    
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});


export default router;
