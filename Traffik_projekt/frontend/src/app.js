import SignupForm from "./components/SignupForm.js";
import LoginForm from "./components/LoginForm.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";
//import UpdateProfileForm from "./components/UpdateProfileForm.js";
const { createApp } = Vue;
import SubscriptionModal from "./components/SubscriptionModal.js";


createApp({
  components: {
    SignupForm,
    LoginForm,
    ResetPasswordForm, 
    SubscriptionModal
  },
  data() {
    return {
      modalView: null,
      showSubscriptionModal: false
    };
  },
  methods: {
    openModal(view) {
      this.modalView = view;
    },
    closeModal() {
      this.modalView = null;
    }
  }
}).mount("#app");
