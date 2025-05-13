export default {
  name: "ResetPasswordForm",
  template: `
    <div>
      <h2> Återställ lösenord </h2>
      <form @submit.prevent="resetPassword">
        <input v-model="newPassword" type="password" placeholder="Nytt lösenord" class="form-field" required />
        <button type="submit" class="button-primary">Byt lösenord</button>
      </form>
      <p v-if="message">{{ message }}</p>
    </div>
  `,
  data() {
    return {
      newPassword: "",
      accessToken: null,
      refreshToken: null,
      message: ""
    };
  },
  created() {
    console.log("🟢 Återställningsformulär laddat");

    const hash = window.location.hash;

    // Plocka ut access_token och refresh_token
    const accessTokenMatch = hash.match(/access_token=([^&]+)/);
    const refreshTokenMatch = hash.match(/refresh_token=([^&]+)/);

    this.accessToken = accessTokenMatch?.[1] || null;
    this.refreshToken = refreshTokenMatch?.[1] || null;

    if (this.accessToken && this.refreshToken) {
      console.log("🔑 access_token:", this.accessToken);
      console.log("🔁 refresh_token:", this.refreshToken);
      this.message = "Ange ditt nya lösenord.";
    } else {
      console.warn("⚠️ Saknar access eller refresh token.");
      this.message = "Ogiltig eller utgången återställningslänk.";
    }
  },
  methods: {
    async resetPassword() {
      if (!this.newPassword || !this.accessToken || !this.refreshToken) {
        this.message = "Saknar nödvändig information.";
        return;
      }

      try {
        const res = await fetch("http://localhost:5000/api/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
            new_password: this.newPassword
          })
        });

        const json = await res.json();

        if (res.ok) {
          this.message = "✅ Lösenordet har uppdaterats! Omdirigerar...";
          setTimeout(() => {
            window.location.href = "#/login";
          }, 2000);
        } else {
          console.error("🛑 Fel från server:", json.error);
          this.message = "Fel: " + json.error;
        }
      } catch (e) {
        console.error("🛑 Nätverksfel:", e);
        this.message = "Ett nätverksfel uppstod.";
      }
    }
  }
};
