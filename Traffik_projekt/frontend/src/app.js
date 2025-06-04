import router from "./router.js";

import Modal from "./Modal.js";
import SubscriptionModal from "./SubscriptionModal.js";
import SignupForm from "./SignupForm.js";
import LoggedInUser from "./LoggedInUser.js";
import ResetPasswordForm from "./ResetPasswordForm.js";
// MapView kommer att användas av routern, så den behöver inte nödvändigtvis importeras här
// om den är korrekt registrerad i routern och används via <router-view>.

// Funktion för att applicera anpassade stilar från URL:en
function applyCustomStylesFromUrl() {
  // Parametrar förväntas vara FÖRE hashen (#) i URL:en
  // t.ex. /kundmapp/index.html?fontFamily=Arial&primaryColor=red#/sökväg
  const urlParams = new URLSearchParams(window.location.search);
  const rootElement = document.documentElement; // Applicera CSS-variabler på <html> (eller document.getElementById('app'))

  // Hämta och applicera fontFamily
  const fontFamily = urlParams.get('fontFamily');
  if (fontFamily) {
      rootElement.style.setProperty('--app-font-family', fontFamily);
  }

  // Hämta och applicera primaryColor
  const primaryColor = urlParams.get('primaryColor');
  if (primaryColor) {
      rootElement.style.setProperty('--app-primary-color', primaryColor);
  }

  // Här kan vi lägga till logik för andra parametrar (textColor, fontSize, backgroundColor)
  // om och när de blir aktuella, t.ex.:
  // const textColor = urlParams.get('textColor');
  // if (textColor) {
  //     rootElement.style.setProperty('--app-text-color', textColor);
  // }
}



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
       const urlParams = new URLSearchParams(window.location.search);
    const resellerKey = urlParams.get("resellerKey");

    if (!resellerKey) {
      alert("Ingen resellerKey hittades i URL!");
      return;
    }

      this.$router.push({ name: "signup",
        query: { resellerKey }
       });
    },
    openAccount() {
      this.modalComponent = "LoggedInUser";
      this.$nextTick(() => {
        this.$refs.loggedInUser?.reloadProfile();
    });
    },
    openResetPassword() {
      this.modalComponent = "ResetPasswordForm";
    },
    closeModal() {
      this.$router.push({ name: "home" });
      this.modalComponent = null;
    },
  },

  async mounted() {
    // Anropa funktionen för att applicera stilar när appen är monterad
     applyCustomStylesFromUrl();

    if (this.loggedIn) {
      this.userId = localStorage.getItem("user_id");
    }

    // Visa SubscriptionModal om vi är på /subscription
    if (this.$route.name === 'subscription') {
      this.modalComponent = 'SubscriptionModal';
    }

    // Kontrollera om vi har en show_modal parameter i URL:en
    const showModal = this.$route.query.show_modal;
    if (showModal === 'true') {
      this.showSubscriptionModal = true;
    }

    // Kontrollera om vi har en session_id från Stripe
    const sessionId = this.$route.query.session_id;
    if (sessionId) {
      this.$router.push({ 
        path: '/subscription',
        query: { session_id: sessionId }
      });
    }

    try {
    } catch (error) {
      console.error("Error in mounted:", error);
    }
  },

  watch: {
    '$route'(to) {
      if (to.name === 'subscription') {
        this.modalComponent = 'SubscriptionModal';
      }
    }
  },
});

app.use(router);
app.mount("#app");
