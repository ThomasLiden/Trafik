import SignupForm from "./components/SignupForm.js";
import LoginForm from "./components/LoginForm.js";
import ResetPasswordForm from "./components/ResetPasswordForm.js";
//import UpdateProfileForm from "./components/UpdateProfileForm.js";
const { createApp } = Vue;

createApp({
  components: {
    SignupForm,
    LoginForm,
    ResetPasswordForm,
    //UpdateProfileForm
  }
}).mount("#app");
