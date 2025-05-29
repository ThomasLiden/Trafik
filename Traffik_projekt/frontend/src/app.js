import router from "./router.js";

import Modal from "./components/Modal.js";
import SubscriptionModal from "./components/SubscriptionModal.js";
import SignupForm from "./components/SignupForm.js";
import LoggedInUser from "./components/LoggedInUser.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";
// MapView kommer att användas av routern, så den behöver inte nödvändigtvis importeras här
// om den är korrekt registrerad i routern och används via <router-view>.

// Mounta Vue-applikationen
const app = Vue.createApp({
  components: {
    Modal,
    SubscriptionModal,
    SignupForm,
    LoggedInUser,
    ResetPasswordForm,
  },

  template: `
    <router-view v-slot="{ Component }"
                 @open-login="openLogin"
                 @open-signup="openSignup"
                 @open-account="openAccount">
      <component :is="Component" :is-logged-in="isLoggedIn" />
    </router-view>

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
      userId: localStorage.getItem("user_id") || null,
      modalComponent: null,
    };
  },

  computed: {
    loggedIn() {
      return this.isLoggedIn;
    },
  },

  methods: {
    onLoginSuccess({ user_id, access_token }) {
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

    onLogout() {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
      this.userId = null;
      this.isLoggedIn = false;
      this.closeModal();
    },

    openLogin() {
      this.$router.push({ name: "login" });
    },
    openSignup() {
      this.$router.push({ name: "signup" });
    },
    openAccount() {
      this.modalComponent = "LoggedInUser";
    },
    openResetPassword() {
      this.modalComponent = "ResetPasswordForm";
    },
    closeModal() {
      this.$router.push({ name: "home" });
      this.modalComponent = null;
    },
  },

  mounted() {
    if (this.loggedIn) {
      this.userId = localStorage.getItem("user_id");
    }
  },
});

app.use(router);
app.mount("#app");
