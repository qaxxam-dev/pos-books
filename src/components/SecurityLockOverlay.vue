<template>
  <div
    v-if="shouldShowLock"
    class="
      absolute
      inset-0
      z-50
      flex
      items-center
      justify-center
      bg-gray-100
      dark:bg-gray-900
      p-4
    "
  >
    <div
      class="
        bg-white
        dark:bg-gray-850
        border
        dark:border-gray-800
        rounded-lg
        text-gray-900
        dark:text-gray-25
        p-6
        shadow-xl
        w-dialog
        flex flex-col
        gap-4
      "
      :class="{ 'animate-shake': hasError }"
    >
      <!-- Frappe Dialog Header -->
      <div
        class="
          flex
          items-center
          justify-between
          pb-2
          border-b
          dark:border-gray-800
        "
      >
        <h1 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ isRecoveryMode ? 'Emergency Recovery' : 'Protected Screen' }}
        </h1>
        <FeatherIcon name="lock" class="w-5 h-5 text-gray-500" />
      </div>

      <!-- Description -->
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{
          isRecoveryMode
            ? 'Enter your 12-character emergency code to unlock.'
            : 'Enter the 6-digit code from Google Authenticator to view financial data.'
        }}
      </p>

      <!-- Standard TOTP Mode -->
      <div v-if="!isRecoveryMode" class="space-y-3">
        <div>
          <input
            ref="totpInput"
            v-model="totpCode"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="000 000"
            class="
              w-full
              h-10
              px-3
              text-center text-lg
              font-mono font-medium
              tracking-widest
              bg-white
              dark:bg-gray-800
              border border-gray-300
              dark:border-gray-700
              rounded-md
              text-gray-900
              dark:text-gray-100
              focus:border-black
              dark:focus:border-gray-400
              outline-none
            "
            @input="onTotpInput"
            @keyup.enter="submitTotp"
          />
        </div>

        <div v-if="errorMessage" class="text-xs text-red-500">
          {{ errorMessage }}
        </div>
      </div>

      <!-- Emergency Recovery Code Mode -->
      <div v-else class="space-y-3">
        <div>
          <input
            ref="recoveryInput"
            v-model="recoveryCodeInput"
            type="text"
            placeholder="XXXX-XXXX-XXXX"
            class="
              w-full
              h-10
              px-3
              text-center text-sm
              font-mono
              uppercase
              tracking-wider
              bg-white
              dark:bg-gray-800
              border border-gray-300
              dark:border-gray-700
              rounded-md
              text-gray-900
              dark:text-gray-100
              focus:border-black
              dark:focus:border-gray-400
              outline-none
            "
            @keyup.enter="submitRecovery"
          />
        </div>

        <div v-if="errorMessage" class="text-xs text-red-500">
          {{ errorMessage }}
        </div>
      </div>

      <!-- Action Buttons (Frappe Style) -->
      <div
        class="
          flex
          items-center
          justify-between
          pt-2
          border-t
          dark:border-gray-800
        "
      >
        <button
          type="button"
          class="
            text-xs text-gray-500
            hover:text-gray-900
            dark:hover:text-gray-200
            underline
          "
          @click="toggleRecoveryMode"
        >
          {{ isRecoveryMode ? 'Use Google Authenticator' : 'Lost phone?' }}
        </button>

        <div class="flex gap-2">
          <Button type="secondary" @click="goToPos"> POS </Button>
          <Button
            type="primary"
            :disabled="isVerifying || !isInputValid"
            @click="isRecoveryMode ? submitRecovery() : submitTotp()"
          >
            {{ isVerifying ? 'Verifying...' : 'Unlock' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Button from './Button.vue';
import FeatherIcon from './FeatherIcon.vue';
import {
  is2faEnabled,
  isPathProtected,
  isUnlocked,
  refreshSecurityState,
  verifyAndUnlock,
  verifyRecoveryAndUnlock,
} from '../utils/securityLock';

onMounted(() => {
  refreshSecurityState();
});

const router = useRouter();
const route = useRoute();

const totpCode = ref('');
const totpInput = ref<HTMLInputElement | null>(null);

const isRecoveryMode = ref(false);
const recoveryCodeInput = ref('');
const recoveryInput = ref<HTMLInputElement | null>(null);

const isVerifying = ref(false);
const errorMessage = ref('');
const hasError = ref(false);

const shouldShowLock = computed(() => {
  return is2faEnabled.value && isPathProtected(route.path) && !isUnlocked.value;
});

const isInputValid = computed(() => {
  if (isRecoveryMode.value) {
    return recoveryCodeInput.value.trim().length >= 8;
  }
  return totpCode.value.trim().length === 6;
});

watch(
  shouldShowLock,
  (show) => {
    if (show) {
      totpCode.value = '';
      recoveryCodeInput.value = '';
      errorMessage.value = '';
      hasError.value = false;
      nextTick(() => {
        if (isRecoveryMode.value) {
          recoveryInput.value?.focus();
        } else {
          totpInput.value?.focus();
        }
      });
    }
  },
  { immediate: true }
);

function onTotpInput() {
  totpCode.value = totpCode.value.replace(/\D/g, '').slice(0, 6);
  errorMessage.value = '';
  hasError.value = false;

  if (totpCode.value.length === 6) {
    submitTotp();
  }
}

async function submitTotp() {
  const code = totpCode.value.trim();
  if (code.length !== 6) return;

  isVerifying.value = true;
  errorMessage.value = '';
  hasError.value = false;

  try {
    const res = await verifyAndUnlock(code);
    if (!res.success) {
      triggerError(res.message || 'Invalid code');
      totpCode.value = '';
      totpInput.value?.focus();
    }
  } catch (err) {
    triggerError('Verification error');
  } finally {
    isVerifying.value = false;
  }
}

function submitRecovery() {
  const code = recoveryCodeInput.value.trim();
  if (!code) return;

  isVerifying.value = true;
  errorMessage.value = '';
  hasError.value = false;

  const res = verifyRecoveryAndUnlock(code);
  if (!res.success) {
    triggerError(res.message || 'Invalid recovery code');
  }
  isVerifying.value = false;
}

function triggerError(msg: string) {
  errorMessage.value = msg;
  hasError.value = true;
  setTimeout(() => {
    hasError.value = false;
  }, 400);
}

function toggleRecoveryMode() {
  isRecoveryMode.value = !isRecoveryMode.value;
  errorMessage.value = '';
  hasError.value = false;
  nextTick(() => {
    if (isRecoveryMode.value) {
      recoveryInput.value?.focus();
    } else {
      totpInput.value?.focus();
    }
  });
}

function goToPos() {
  router.push('/pos');
}
</script>

<style scoped>
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-6px);
  }
  75% {
    transform: translateX(6px);
  }
}

.animate-shake {
  animation: shake 0.3s ease-in-out;
}
</style>
