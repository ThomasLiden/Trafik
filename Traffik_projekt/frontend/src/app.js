import SignupForm from "./components/SignupForm.js";
import PaymentPage from "./components/PaymentPage.js";  
const { createApp } = Vue;

createApp({
  components: {
    SignupForm,               
    PaymentPage           
  }
}).mount("#app");