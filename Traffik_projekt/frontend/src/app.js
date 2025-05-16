import router from "./router.js"; // Från main

// Importera komponenter från main
import Modal from "./components/Modal.js";
import SubscriptionModal from "./components/SubscriptionModal.js";
import SignupForm from "./components/SignupForm.js";
import LoggedInUser from "./components/LoggedInUser.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";
// MapView kommer att användas av routern, så den behöver inte nödvändigtvis importeras här
// om den är korrekt registrerad i routern och används via <router-view>.

const app = Vue.createApp({
  components: {
    Modal,
    SubscriptionModal,
    SignupForm,
    LoggedInUser,
    ResetPasswordForm
  },

  template: `
    <router-view v-slot="{ Component }"
                 @open-login="openLogin"
                 @open-signup="openSignup"
                 @open-account="openAccount"
                 @back-to-map="closeModal"> 
            <component :is="Component" :is-logged-in="isLoggedIn" />
    </router-view>

    <router-view name="modal" v-slot="{ Component: ModalRouteComponent }">
      <Modal v-if="ModalRouteComponent || modalComponent" @close="closeModal">
        <component
          :is="modalComponent || ModalRouteComponent"
          @login-success="onLoginSuccess"
          @signup-success="onSignupSuccess" 
          :user-id="userId"
          @logout="onLogout"
          @close="closeModal"
          @profile-updated="onProfileUpdate" @cancel="closeModal" :access-token="resetToken" 
        />
      </Modal>
    </router-view>
  `,

  data() {
    return {
      isLoggedIn: !!localStorage.getItem("access_token"),
      resetToken: null, // Används för lösenordsåterställning
      userId: localStorage.getItem("user_id") || null,
      modalComponent: null, // Används för att dynamiskt ladda komponenter i den generella modalen (t.ex. LoggedInUser)
    };
  },

  computed: {
    loggedIn() {
        return this.isLoggedIn;
      }
     },

  methods: {
    // Alla metoder från main's app.js för att hantera login, modals etc. behålls.
    onLoginSuccess({ user_id, access_token }) {
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("user_id", user_id);
      this.userId = user_id;
      this.isLoggedIn = true;
      this.openAccount(); // Öppna kontosidan/modalen direkt efter inloggning
    },

    onSignupSuccess(payload) {
      console.log("Signup lyckades i app.js, payload:", payload);
      // Potentiellt logga in användaren direkt eller visa ett meddelande.
      // För nu, stäng modalen och låt användaren logga in manuellt.
      this.closeModal(); 
      // Kanske omdirigera till login eller visa ett "Registrering lyckad!" meddelande.
    },

    onLogout() {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
      this.userId = null;
      this.isLoggedIn = false;
      this.$router.push({ name: "home" }); // Gå till startsidan efter utloggning
      this.modalComponent = null;
    },

    openLogin() {
      this.modalComponent = null; // Rensa eventuell tidigare dynamisk modal
      this.$router.push({ name: "login" });
    },
    openSignup() {
      this.modalComponent = null;
      this.$router.push({ name: "signup" });
    },
    openAccount() {
        this.modalComponent = "LoggedInUser";
    },
    openResetPassword() {
      this.modalComponent = "ResetPasswordForm";
    },
    closeModal() {
      if (this.$route.meta.isModal) { // Om vi är på en modal route
        this.$router.push({ name: "home" }); // Gå tillbaka till hemskärmen
      }
      this.modalComponent = null; // Rensa alltid den dynamiska modalen
    },
    onProfileUpdate() {
        // Kan användas för att t.ex. ladda om LoggedInUser-komponenten eller visa meddelande
        console.log("Profil uppdaterad i app.js");
        this.modalComponent = null; // Stäng modalen för profiluppdatering
        this.openAccount(); // Öppna igen för att visa uppdaterad info (eller så uppdateras den reaktivt)
    }
  },

  mounted() {
    // Logik från main för att kolla login-status vid start
    if (this.isLoggedIn) {
      this.userId = localStorage.getItem("user_id");
    }
    // Kontrollera om vi är på reset-password-sidan via hash och öppna den modalen
    if (window.location.hash.includes("access_token") && window.location.hash.includes("/reset-password")) {
        // Routern hanterar nu detta, se router.js beforeEach
    }
  },
});

// Registrera komponenter som ska kunna laddas dynamiskt via `modalComponent`
app.component('LoggedInUser', LoggedInUser);
app.component('UpdateProfileForm', await import('./components/UpdateProfileForm.js').then(m => m.default)); // Om UpdateProfileForm används dynamiskt

app.use(router);
app.mount("#app");