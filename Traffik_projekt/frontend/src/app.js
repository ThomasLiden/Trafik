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
      userId: null, page: "map", 
      showSubscriptionModal: false
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
      console.log('Signup lyckades, payload:', payload);
      this.closeModal();
    },
    onLogout() {
      this.userId = null;
      this.page   = 'map';
    }
  }
}).mount("#app");
