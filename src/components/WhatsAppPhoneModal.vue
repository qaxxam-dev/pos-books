<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="
          fixed
          inset-0
          z-50
          flex
          items-center
          justify-center
          bg-black/50
          backdrop-blur-sm
          p-4
        "
        @click.self="handleCancel"
      >
        <div
          class="
            bg-white
            dark:bg-gray-850
            border
            dark:border-gray-800
            rounded-xl
            text-gray-900
            dark:text-gray-25
            p-6
            shadow-2xl
            w-full
            max-w-md
            flex flex-col
            gap-4
          "
        >
          <!-- Header -->
          <div
            class="
              flex
              items-center
              justify-between
              border-b
              pb-3
              dark:border-gray-800
            "
          >
            <div class="flex items-center gap-2.5">
              <div
                class="
                  w-9
                  h-9
                  rounded-full
                  bg-emerald-100
                  dark:bg-emerald-950/60
                  flex
                  items-center
                  justify-center
                  text-emerald-600
                  dark:text-emerald-400
                "
              >
                <feather-icon name="message-circle" class="w-5 h-5" />
              </div>
              <div>
                <h3
                  class="text-base font-bold text-gray-900 dark:text-gray-100"
                >
                  {{ title || t`Share on WhatsApp` }}
                </h3>
                <p
                  v-if="partyName"
                  class="text-xs text-gray-500 dark:text-gray-400"
                >
                  {{ t`Customer:` }}
                  <span
                    class="font-semibold text-gray-700 dark:text-gray-300"
                    >{{ partyName }}</span
                  >
                </p>
              </div>
            </div>
            <button
              type="button"
              class="
                text-gray-400
                hover:text-gray-600
                dark:hover:text-gray-200
                p-1
                rounded-md
                hover:bg-gray-100
                dark:hover:bg-gray-800
                transition-colors
              "
              @click="handleCancel"
            >
              <feather-icon name="x" class="w-4 h-4" />
            </button>
          </div>

          <!-- Body / Input -->
          <div class="flex flex-col gap-2">
            <label
              class="
                block
                text-xs
                font-bold
                uppercase
                tracking-wider
                text-gray-600
                dark:text-gray-400
              "
            >
              {{ t`Customer Phone / WhatsApp Number` }}
            </label>
            <div class="relative">
              <input
                ref="phoneInput"
                v-model="phone"
                type="tel"
                :placeholder="t`Enter 10-digit number (e.g. 9876543210)`"
                class="
                  w-full
                  px-3.5
                  py-2.5
                  border
                  rounded-lg
                  text-sm
                  font-medium
                  bg-gray-50
                  dark:bg-gray-900
                  border-gray-300
                  dark:border-gray-700
                  text-gray-900
                  dark:text-gray-100
                  focus:outline-none
                  focus:ring-2
                  focus:ring-emerald-500
                  focus:bg-white
                  dark:focus:bg-gray-900
                  transition-all
                "
                @keydown.enter.prevent="handleSubmit"
                @keydown.esc.prevent="handleCancel"
              />
            </div>
            <p v-if="error" class="text-xs font-semibold text-red-500 mt-0.5">
              {{ error }}
            </p>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500">
              {{ t`Country code will be added automatically if omitted.` }}
            </p>
          </div>

          <!-- Checkbox to save to customer -->
          <div
            v-if="canSaveToParty"
            class="
              flex
              items-center
              gap-2.5
              p-2.5
              bg-emerald-50/60
              dark:bg-emerald-950/30
              rounded-lg
              border border-emerald-100
              dark:border-emerald-900/40
            "
          >
            <input
              id="saveToPartyCheckbox"
              v-model="saveToParty"
              type="checkbox"
              class="
                h-4
                w-4
                rounded
                border-gray-300
                text-emerald-600
                focus:ring-emerald-500
                cursor-pointer
              "
            />
            <label
              for="saveToPartyCheckbox"
              class="
                text-xs
                font-medium
                text-emerald-900
                dark:text-emerald-200
                cursor-pointer
                select-none
              "
            >
              {{ t`Save phone number to customer record` }}
            </label>
          </div>

          <!-- Footer Buttons -->
          <div class="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="secondary"
              class="px-4 py-2 text-sm font-semibold"
              @click="handleCancel"
            >
              {{ t`Cancel` }}
            </Button>
            <Button
              class="
                px-5
                py-2
                text-sm
                font-bold
                rounded-md
                text-white
                flex
                items-center
                gap-1.5
                shadow-sm
                transition-all
              "
              style="
                background-color: #059669 !important;
                color: #ffffff !important;
              "
              @click="handleSubmit"
            >
              <feather-icon name="send" class="w-4 h-4 text-white" />
              <span>{{ t`Continue to WhatsApp` }}</span>
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { t } from 'fyo';
import Button from 'src/components/Button.vue';

export default defineComponent({
  name: 'WhatsAppPhoneModal',
  components: {
    Button,
  },
  props: {
    title: {
      type: String,
      default: '',
    },
    partyName: {
      type: String,
      default: '',
    },
    initialPhone: {
      type: String,
      default: '',
    },
    canSaveToParty: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['submit', 'cancel'],
  data() {
    return {
      open: true,
      phone: this.initialPhone || '',
      saveToParty: true,
      error: '',
    };
  },
  mounted() {
    this.$nextTick(() => {
      const input = this.$refs.phoneInput as HTMLInputElement | undefined;
      input?.focus();
    });
  },
  methods: {
    t,
    handleCancel() {
      this.open = false;
      this.$emit('cancel');
    },
    handleSubmit() {
      const trimmed = this.phone.trim();
      const digitsOnly = trimmed.replace(/[^0-9]/g, '');

      if (!digitsOnly || digitsOnly.length < 7) {
        this.error = t`Please enter a valid phone number (at least 7 digits).`;
        return;
      }

      this.error = '';
      this.open = false;
      this.$emit('submit', {
        phone: trimmed,
        saveToParty: this.canSaveToParty ? this.saveToParty : false,
      });
    },
  },
});
</script>
