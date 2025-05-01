const { createApp } = Vue;

import SignupForm from "./components/SignupForm.js";
import LoginForm from "./components/LoginForm.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";
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
      userId: null, 
      page: "map",
      isLoggedIn: !!localStorage.getItem('access_token')
    };
  },
  computed: {
    // Kollar om användaren är inloggad
    loggedIn() {
      return this.isLoggedIn
    }
  },

  methods: {
    openModal(view) {
      if (view === 'login' && this.loggedIn) {
        // Hoppa direkt till översikten
        this.page = 'overview'
      } else {
        this.modalView = view
      }
    },

    closeModal() {
      this.modalView = null;
    },

    onLoginSuccess({user_id, access_token}) {
      /* this.userId = payload.user_id; */
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('user_id',    user_id)
      this.userId = user_id
      this.page      = 'overview'
      this.isLoggedIn = true
      this.closeModal();
    },

    onSignupSuccess(payload) {
      console.log('Signup lyckades, payload:', payload);
      this.closeModal();
    },
          // Logout
          onLogout() {
            localStorage.removeItem('access_token')
            localStorage.removeItem('user_id')
            this.userId = null
            this.page   = 'map'
            this.modalView = null
            this.showSubscriptionModal = false
            this.isLoggedIn = false 
            },

            goToMap() {
              this.page = 'map'
            }
         
  },

  mounted() {
    // Vid sidladdning: kolla om vi redan har token+userId
    if (this.loggedIn) {
      this.userId = localStorage.getItem('user_id')
    }
  }

}).mount("#app");
