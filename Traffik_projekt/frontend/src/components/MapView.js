/* det här är kartan och de två knapparna, komponenten som är på / */
/* ska ersättas med riktiga kartan sen */

export default {
    name: 'MapView',
    props: ['isLoggedIn'],
    emits: ['open-login', 'open-signup', 'open-account'],
    template: `
      <div class="map-section">
        <iframe
          src="https://www.google.com/maps/embed"
          width="80%"
          height="80%"
          style="border:0;"
          allowfullscreen
          loading="lazy"
        ></iframe>
        <div class="buttons">
        <button 
          @click="isLoggedIn ? $emit('open-account') : $emit('open-login')" 
          class="button-secondary">
          {{ isLoggedIn ? 'Till min sida' : 'Logga in' }}
        </button>
          <button @click="$emit('open-signup')" class="button-primary">
            Prenumerera
          </button>
        </div>
      </div>
    `
  };
  