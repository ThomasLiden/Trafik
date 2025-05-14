
import router from "./router.js";

import Modal from "./components/Modal.js";
import SubscriptionModal from "./components/SubscriptionModal.js";
import SignupForm from "./components/SignupForm.js";
import LoggedInUser from "./components/LoggedInUser.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";


const app = Vue.createApp({
  components: {
    Modal,
    SubscriptionModal,
    SignupForm,
    LoggedInUser,
    ResetPasswordForm
  },

  template: `
     <!-- Default: MapView -->
    <router-view v-slot="{ Component }"
                 @open-login="openLogin"
                 @open-signup="openSignup"
                 @open-account="openAccount">
      <component :is="Component" :is-logged-in="isLoggedIn" />
    </router-view>

    <!-- Modal -->

<router-view name="modal" v-slot="{ Component: ModalComp }">
  <Modal v-if="ModalComp || modalComponent" @close="closeModal">
    <component
      :is="modalComponent || ModalComp"
      @login-success="onLoginSuccess"
      @signup-success="onSignupSuccess"
      :user-id="userId"
      @logout="onLogout"
      @close="closeModal"
      :access-token="resetToken"
    />
  </Modal>
</router-view>
  `,

  data() {
    return {
      isLoggedIn: !!localStorage.getItem("access_token"),
      resetToken: null,
      /* userId: null, */
      userId: localStorage.getItem("user_id") || null,
      verifyToken: null,
      modalComponent: null,
    };
  },
  computed: {
    // check ig user is logged in
    loggedIn() {
      return this.isLoggedIn;
    },
  },

  methods: {

    onLoginSuccess({ user_id, access_token }) {
      /* this.userId = payload.user_id; */
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("user_id", user_id);
      this.userId = user_id;
      this.isLoggedIn = true;
      this.openAccount();
    },

    onSignupSuccess(payload) {
      console.log("Signup lyckades, payload:", payload);
      this.closeModal();
    },
    // Logout
    onLogout() {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
      this.userId = null;
      this.isLoggedIn = false;
      this.closeModal();
    },
    // push the log in to modal
    openLogin() {
      this.$router.push({ name: "login" });
    },

    //push sign up to modal
    openSignup() {
      this.$router.push({ name: "signup" });
    },
    openAccount() {
      this.modalComponent = 'LoggedInUser';
    },    
    openResetPassword() {
      this.modalComponent = 'ResetPasswordForm';
    },
    closeModal() {
      // Om vi är på en modal-route, skicka alltid hem
      this.$router.push({ name: "home" });
      this.modalComponent = null;
    },
  },

  mounted() {
    // Check if user is loggen in on page load
    if (this.loggedIn) {
      this.userId = localStorage.getItem("user_id");
    }

    const hash = window.location.hash.slice(1); // tar bort "#"
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');

    if (accessToken) {
      this.modalComponent = 'ResetPasswordForm'; // Öppna modal
      this.resetToken = accessToken;             // Spara token i data
    }
  },
});

app.use(router);
app.mount("#app");
