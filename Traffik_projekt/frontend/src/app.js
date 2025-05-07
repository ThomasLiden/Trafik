/* const { createApp } = Vue; */
import router from "./router.js";

import Modal from "./components/Modal.js";
import SubscriptionModal from "./components/SubscriptionModal.js";
import SignupForm from "./components/SignupForm.js";
import LoggedInUser from "./components/LoggedInUser.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";


/* 
import LoginForm from "./components/LoginForm.js";

 */

const app = Vue.createApp({
  components: {
    /*     
    LoginForm,
    ResetPasswordForm, 
     */
    Modal,
    SubscriptionModal,
    SignupForm,
    LoggedInUser,
    ResetPasswordForm
  },

  template: `
     <!-- Default-vyn: MapView -->
    <router-view v-slot="{ Component }"
                 @open-login="openLogin"
                 @open-signup="openSignup"
                 @open-account="openAccount">
      <component :is="Component" :is-logged-in="isLoggedIn" />
    </router-view>

    <!-- Modal-vyn -->

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
      /*    modalView: null,
      showSubscriptionModal: false,
      page: "map",

      */
      isLoggedIn: !!localStorage.getItem("access_token"),
      resetToken: null,
      /* userId: null, */
      userId: localStorage.getItem("user_id") || null,
      verifyToken: null,
      modalComponent: null,
    };
  },
  computed: {
    // Kollar om användaren är inloggad
    loggedIn() {
      return this.isLoggedIn;
    },
  },

  methods: {
/*     openModal(view) {
      if (view === "login" && this.loggedIn) {
        // Hoppa direkt till översikten
        this.page = "overview";
      } else {
        this.modalView = view;
      }
    }, */

    onLoginSuccess({ user_id, access_token }) {
      /* this.userId = payload.user_id; */
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("user_id", user_id);
      this.userId = user_id;
      /* this.page      = 'overview' */
      this.isLoggedIn = true;
     /*  this.closeModal(); */
/*       this.modalComponent = "LoggedInUser";
      this.$router.push({ name: "home" }); */
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
      /* this.page = "map"; */
     /*  this.modalView = null; */
   /*    this.showSubscriptionModal = false; */
      this.isLoggedIn = false;
      this.closeModal();
    },

    /*             goToMap() {
              this.page = 'map',
              window.location.hash = ''
            },  */
    openLogin() {
      this.$router.push({ name: "login" });
    },
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
    // Vid sidladdning: kolla om vi redan har token+userId
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

/*     if (p.get("type") === "recovery" && p.get("access_token")) {
      this.resetToken = p.get("access_token");
      this.view = "reset";
    } */
  },
});

app.use(router);
app.mount("#app");
