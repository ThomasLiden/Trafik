// this is the modal, it has no content on default. Works as a container for login and sigup

export default {
    name: 'Modal',
    emits: ['close'],
    template: `
      <div class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-container">
          <button class="modal-close-btn" @click="$emit('close')">&times;</button>
          <div class="modal-content">
            <slot @close="$emit('close')"/>
          </div>
        </div>
      </div>
    `
  };
  