<template>
  <div class="p-6 max-w-3xl space-y-6">
    <!-- Main Card -->
    <div
      class="
        bg-white
        dark:bg-gray-850
        border
        dark:border-gray-800
        rounded-lg
        p-6
        space-y-6
      "
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <FeatherIcon
            name="shield"
            class="w-6 h-6 text-gray-700 dark:text-gray-300 mt-0.5"
          />
          <div>
            <h2
              class="text-base font-semibold text-gray-900 dark:text-gray-100"
            >
              Two-Factor Authentication (Google Authenticator)
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Protect Dashboard Overview, Daybook, and Financial Reports with
              offline 6-digit rotating TOTP codes.
            </p>
          </div>
        </div>

        <span
          class="
            inline-flex
            items-center
            px-2.5
            py-0.5
            rounded
            text-xs
            font-medium
          "
          :class="
            is2faEnabled
              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
              : 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
          "
        >
          {{ is2faEnabled ? 'Protected' : 'Disabled' }}
        </span>
      </div>

      <div
        class="
          text-xs text-gray-500
          dark:text-gray-400
          space-y-1
          bg-gray-50
          dark:bg-gray-800/50
          p-3
          rounded-md
          border
          dark:border-gray-800
        "
      >
        <div>
          • <strong>Protected Views:</strong> Dashboard Overview, Daybook, and
          Reports
        </div>
        <div>
          • <strong>Lock Rule:</strong> Instantly locks when switching to any
          billing screen + 2-min inactivity timeout
        </div>
        <div>
          • <strong>Network:</strong> 100% offline standard TOTP (zero internet
          or SMS cost)
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <Button v-if="!is2faEnabled" type="primary" @click="startSetup">
          Enable 2FA Protection
        </Button>
        <template v-else>
          <Button type="secondary" @click="openRecoveryModal">
            View Recovery Code
          </Button>
          <Button
            type="secondary"
            class="text-red-600 dark:text-red-400"
            @click="openDisableModal"
          >
            Disable 2FA
          </Button>
        </template>
      </div>
    </div>

    <!-- Setup Modal -->
    <div
      v-if="showSetup"
      class="backdrop z-30 flex justify-center items-center"
      @click="showSetup = false"
    >
      <div
        class="
          bg-white
          dark:bg-gray-850
          border
          dark:border-gray-800
          rounded-lg
          p-6
          shadow-2xl
          w-dialog
          space-y-4
        "
        @click.stop
      >
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
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            Setup Google Authenticator
          </h3>
          <button
            type="button"
            class="
              text-gray-400
              hover:text-gray-600
              dark:hover:text-gray-200
              text-sm
            "
            @click="showSetup = false"
          >
            ✕
          </button>
        </div>

        <!-- Step 1: QR -->
        <div class="text-center space-y-2">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Scan this QR code with Google Authenticator:
          </p>
          <div class="inline-block p-2 bg-white rounded border border-gray-200">
            <img
              :src="setupData.qrDataUrl"
              alt="QR"
              class="w-40 h-40 mx-auto"
            />
          </div>
          <div class="text-xs text-gray-500">
            Secret Key:
            <code
              class="
                font-mono font-semibold
                select-all
                text-gray-800
                dark:text-gray-200
                ml-1
              "
            >
              {{ setupData.secret }}
            </code>
          </div>
        </div>

        <!-- Step 2: Recovery Code -->
        <div
          class="
            p-3
            bg-gray-50
            dark:bg-gray-800
            rounded
            border
            dark:border-gray-700
            space-y-1
          "
        >
          <div class="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Emergency Recovery Code (Save this):
          </div>
          <div
            class="
              font-mono
              text-sm
              font-bold
              text-gray-900
              dark:text-gray-100
              tracking-wider
              select-all
            "
          >
            {{ setupData.recoveryCode }}
          </div>
          <p class="text-[11px] text-gray-500 dark:text-gray-400">
            Use this code if you ever lose access to your authenticator phone.
          </p>
        </div>

        <!-- Step 3: Enter Code -->
        <div class="space-y-1">
          <label
            class="block text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            Enter 6-digit Authenticator Code:
          </label>
          <input
            v-model="setupTestCode"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="000000"
            class="
              w-full
              h-9
              px-3
              text-center
              font-mono font-semibold
              text-base
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
            @keyup.enter="confirmSetup"
          />
          <p v-if="setupError" class="text-xs text-red-500">{{ setupError }}</p>
        </div>

        <!-- Dialog Buttons -->
        <div class="flex justify-end gap-2 pt-2 border-t dark:border-gray-800">
          <Button type="secondary" @click="showSetup = false"> Cancel </Button>
          <Button
            type="primary"
            :disabled="isSubmitting || setupTestCode.length !== 6"
            @click="confirmSetup"
          >
            {{ isSubmitting ? 'Verifying...' : 'Activate' }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Confirm TOTP Modal (For Disabling or Viewing Recovery) -->
    <div
      v-if="showAuthPrompt"
      class="backdrop z-30 flex justify-center items-center"
      @click="showAuthPrompt = false"
    >
      <div
        class="
          bg-white
          dark:bg-gray-850
          border
          dark:border-gray-800
          rounded-lg
          p-6
          shadow-2xl
          w-dialog
          space-y-4
        "
        @click.stop
      >
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
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {{
              authPromptAction === 'disable'
                ? 'Disable 2FA'
                : 'Security Verification'
            }}
          </h3>
          <button
            type="button"
            class="
              text-gray-400
              hover:text-gray-600
              dark:hover:text-gray-200
              text-sm
            "
            @click="showAuthPrompt = false"
          >
            ✕
          </button>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400">
          Enter your current 6-digit Authenticator code (or Recovery Code) to
          proceed:
        </p>

        <input
          v-model="authPromptInput"
          type="text"
          placeholder="6-digit code or Recovery Code"
          class="
            w-full
            h-9
            px-3
            text-center
            font-mono
            text-sm
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
          @keyup.enter="handleAuthPromptSubmit"
        />

        <p v-if="authPromptError" class="text-xs text-red-500">
          {{ authPromptError }}
        </p>

        <div class="flex justify-end gap-2 pt-2 border-t dark:border-gray-800">
          <Button type="secondary" @click="showAuthPrompt = false">
            Cancel
          </Button>
          <Button
            type="primary"
            :disabled="!authPromptInput.trim()"
            @click="handleAuthPromptSubmit"
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>

    <!-- View Recovery Code Modal -->
    <div
      v-if="showRecoveryDisplay"
      class="backdrop z-30 flex justify-center items-center"
      @click="showRecoveryDisplay = false"
    >
      <div
        class="
          bg-white
          dark:bg-gray-850
          border
          dark:border-gray-800
          rounded-lg
          p-6
          shadow-2xl
          w-dialog
          space-y-4
        "
        @click.stop
      >
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
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            Emergency Recovery Code
          </h3>
          <button
            type="button"
            class="
              text-gray-400
              hover:text-gray-600
              dark:hover:text-gray-200
              text-sm
            "
            @click="showRecoveryDisplay = false"
          >
            ✕
          </button>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400">
          Save this code in a secure location. It can unlock the screen if you
          lose your phone.
        </p>

        <div
          class="
            p-3
            bg-gray-50
            dark:bg-gray-800
            rounded
            border
            dark:border-gray-700
            font-mono
            text-center
            font-bold
            text-base text-gray-900
            dark:text-gray-100
            select-all
            tracking-wider
          "
        >
          {{ recoveryCode }}
        </div>

        <div class="flex justify-end pt-2 border-t dark:border-gray-800">
          <Button type="secondary" @click="showRecoveryDisplay = false">
            Close
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from './Button.vue';
import FeatherIcon from './FeatherIcon.vue';
import {
  commit2faSetup,
  disable2fa,
  is2faEnabled,
  prepare2faSetup,
  recoveryCode,
  refreshSecurityState,
  totpSecret,
} from '../utils/securityLock';
import { verifyTotpCode } from '../utils/totp';

onMounted(() => {
  refreshSecurityState();
});

const showSetup = ref(false);
const setupData = ref({
  secret: '',
  recoveryCode: '',
  otpAuthUri: '',
  qrDataUrl: '',
});
const setupTestCode = ref('');
const setupError = ref('');
const isSubmitting = ref(false);

const showAuthPrompt = ref(false);
const authPromptAction = ref<'disable' | 'viewRecovery'>('disable');
const authPromptInput = ref('');
const authPromptError = ref('');

const showRecoveryDisplay = ref(false);

async function startSetup() {
  setupError.value = '';
  setupTestCode.value = '';
  setupData.value = await prepare2faSetup('Frappe Books');
  showSetup.value = true;
}

async function confirmSetup() {
  if (setupTestCode.value.length !== 6) return;

  isSubmitting.value = true;
  setupError.value = '';

  const res = await commit2faSetup(
    setupData.value.secret,
    setupData.value.recoveryCode,
    setupTestCode.value
  );

  isSubmitting.value = false;

  if (res.success) {
    showSetup.value = false;
    refreshSecurityState();
  } else {
    setupError.value = res.message || 'Verification failed';
  }
}

function openDisableModal() {
  authPromptAction.value = 'disable';
  authPromptInput.value = '';
  authPromptError.value = '';
  showAuthPrompt.value = true;
}

function openRecoveryModal() {
  authPromptAction.value = 'viewRecovery';
  authPromptInput.value = '';
  authPromptError.value = '';
  showAuthPrompt.value = true;
}

async function handleAuthPromptSubmit() {
  const entered = authPromptInput.value.trim();
  if (!entered) return;

  authPromptError.value = '';

  if (authPromptAction.value === 'disable') {
    const res = await disable2fa(entered);
    if (res.success) {
      showAuthPrompt.value = false;
      refreshSecurityState();
    } else {
      authPromptError.value = res.message || 'Invalid code';
    }
  } else if (authPromptAction.value === 'viewRecovery') {
    const secret = totpSecret.value;
    const isValid = secret ? await verifyTotpCode(secret, entered) : false;
    const cleanEntered = entered.toUpperCase().replace(/-/g, '');
    const cleanStored = recoveryCode.value.toUpperCase().replace(/-/g, '');
    if (isValid || (cleanStored && cleanEntered === cleanStored)) {
      showAuthPrompt.value = false;
      showRecoveryDisplay.value = true;
    } else {
      authPromptError.value = 'Invalid code';
    }
  }
}
</script>
