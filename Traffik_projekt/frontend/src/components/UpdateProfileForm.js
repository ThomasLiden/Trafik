//Endast påbörjad!! 

export default {
    template: `
      <div>
        <h2>Ändra kontaktuppgifter</h2>
        <form @submit.prevent="updateProfile">
          <input v-model="name" type="text" placeholder="Namn" />
          <input v-model="email" type="email" placeholder="E-post" />
          <input v-model="phone" type="text" placeholder="Telefonnummer" />
          <button type="submit">Spara</button>
        </form>
        <p v-if="message">{{ message }}</p>
      </div>
    `,
    data() {
      return {
        name: "",
        email: "",
        phone: "",
        message: ""
      };
    },
    mounted() {
      const userId = localStorage.getItem("user_id");
      fetch(`http://127.0.0.1:5000/api/user-profile?user_id=${userId}`)
        .then(res => res.json())
        .then(data => {
          this.name = data.name;
          this.email = data.email;
          this.phone = data.phone;
        });
    },
    methods: {
      async updateProfile() {
        const user_id = localStorage.getItem("user_id");
        const res = await fetch("http://127.0.0.1:5000/api/update-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id,
            name: this.name,
            email: this.email,
            phone: this.phone
          })
        });
        const data = await res.json();
        this.message = data.message || data.error;
      }
    }
  };
  