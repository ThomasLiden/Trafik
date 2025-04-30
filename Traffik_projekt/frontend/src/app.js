import SignupForm from "./components/SignupForm.js";
import LoginForm from "./components/LoginForm.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";
//import UpdateProfileForm from "./components/UpdateProfileForm.js";
const { createApp } = Vue;
import SubscriptionModal from "./components/SubscriptionModal.js";
import LoggedInUser from "./components/LoggedInUser.js";


createApp({
  components: {
    SignupForm,
    LoginForm,
    ResetPasswordForm, 
    SubscriptionModal,
    LoggedInUser
  },
  data() {
    return {
      modalView: null,
      showSubscriptionModal: false,
      userId: null, page: "map" 
    };
  },
  methods: {
    openModal(view) {
      this.modalView = view;
    },
    closeModal() {
      this.modalView = null;
    },
    onLoginSuccess(payload) {
      this.userId = payload.user_id;
      this.page = "overview";
      this.closeModal();
    },

    onSignupSuccess(payload) {
      // Här kan du både ta emot email/phone och
      // byta vidare till prenumerations-stegen i en flerstegs-modal
      console.log('Signup lyckades, payload:', payload);
      this.closeModal();
      // ex. this.openModal('subscriptionFlow');
    },
    onLogout() {
      this.userId = null;
      this.page   = 'map';
    }
  }
}).mount("#app");
