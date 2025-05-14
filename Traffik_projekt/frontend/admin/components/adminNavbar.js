export default {
  name: "navbar",
  props: ["isLoggedIn", "role"],

  methods: {
    logout() {
      this.$emit("logout");
    },
    handleLoginLogout() {
      if (this.isLoggedIn) {
        this.logout();
      } else {
        this.$router.push("/admin/login");
      }
    }
  },

  template: `
    <nav>
      <ul>
        <li><router-link to="/admin">Startsida</router-link></li>
        <li><router-link to="/admin/subscriptions">Prenumerationer</router-link></li>
        <li><router-link to="/admin/pricing">Prissättning</router-link></li>
        <li><router-link to="/admin/account">Kontoinställningar</router-link></li>

        <li v-if="isLoggedIn && role === 'superadmin'">
          <router-link to="/admin/administration">Administration</router-link>
        </li>

        <li>
          <a href="#" @click.prevent="handleLoginLogout">
            {{ isLoggedIn ? 'Logga ut' : 'Logga in' }}
          </a>
        </li>
      </ul>
    </nav>
  `
};

