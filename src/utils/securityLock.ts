import { ref } from 'vue';
import type { Router } from 'vue-router';
import { fyo } from '../initFyo';
import {
  generateOtpAuthUri,
  generateQrDataUrl,
  generateRecoveryCode,
  generateTotpSecret,
  verifyTotpCode,
} from './totp';

// Core reactive security states
export const is2faEnabled = ref<boolean>(false);
export const totpSecret = ref<string>('');
export const recoveryCode = ref<string>('');
export const isUnlocked = ref<boolean>(false);
export const showSetupModal = ref<boolean>(false);

// Idle timer configuration (2 minutes)
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let activityListenersAttached = false;

/**
 * Check if a given route path is protected
 */
export function isPathProtected(path: string): boolean {
  if (path === '/' || path === '/daybook') {
    return true;
  }
  if (path.startsWith('/report/') || path.startsWith('/report-print/')) {
    return true;
  }
  return false;
}

/**
 * Refresh reactive security states directly from SystemSettings
 */
export function refreshSecurityState() {
  const s = fyo.singles?.SystemSettings;
  if (!s) return;

  const raw = s.security2faEnabled;
  is2faEnabled.value =
    raw === true || raw === 1 || raw === '1.0' || raw === '1' || raw === 'true';

  totpSecret.value = (s.securityTotpSecret as string) || '';
  recoveryCode.value = (s.securityRecoveryCode as string) || '';
}

/**
 * Reset and restart the 2-minute inactivity timer
 */
export function resetInactivityTimer(currentPath: string) {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  // Only run idle timer if currently unlocked and on a protected screen
  if (
    !is2faEnabled.value ||
    !isUnlocked.value ||
    !isPathProtected(currentPath)
  ) {
    return;
  }

  idleTimer = setTimeout(() => {
    isUnlocked.value = false;
  }, INACTIVITY_TIMEOUT_MS);
}

/**
 * Lock immediately
 */
export function lockSecurityScreen() {
  isUnlocked.value = false;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/**
 * Verify TOTP code and unlock
 */
export async function verifyAndUnlock(
  token: string
): Promise<{ success: boolean; message?: string }> {
  refreshSecurityState();
  const secret = totpSecret.value;
  if (!secret) {
    isUnlocked.value = true;
    return { success: true };
  }

  const isValid = await verifyTotpCode(secret, token);
  if (isValid) {
    isUnlocked.value = true;
    return { success: true };
  }

  return { success: false, message: 'Invalid 6-digit code. Please try again.' };
}

/**
 * Verify emergency recovery code and unlock
 */
export function verifyRecoveryAndUnlock(enteredCode: string): {
  success: boolean;
  message?: string;
} {
  refreshSecurityState();
  const currentRecovery = recoveryCode.value;
  if (!currentRecovery) {
    return {
      success: false,
      message: 'No recovery code is set on this system.',
    };
  }

  const cleanEntered = enteredCode.trim().toUpperCase().replace(/-/g, '');
  const cleanStored = currentRecovery.trim().toUpperCase().replace(/-/g, '');

  if (cleanEntered === cleanStored) {
    isUnlocked.value = true;
    return { success: true };
  }

  return { success: false, message: 'Invalid emergency recovery code.' };
}

/**
 * Setup navigation listeners on the router to lock upon leaving protected screens
 */
export function setupSecurityRouterWatcher(router: Router) {
  router.beforeEach((to, from, next) => {
    refreshSecurityState();

    const isToProtected = isPathProtected(to.path);
    const isFromProtected = isPathProtected(from.path);

    // Leaving a protected screen to an unprotected screen -> lock
    if (isFromProtected && !isToProtected) {
      isUnlocked.value = false;
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    }

    // Entering a protected screen from an unprotected screen -> lock
    if (!isFromProtected && isToProtected) {
      isUnlocked.value = false;
    }

    next();
  });

  router.afterEach((to) => {
    resetInactivityTimer(to.path);
  });

  // Attach global activity listeners for inactivity auto-lock
  if (!activityListenersAttached && typeof window !== 'undefined') {
    const onUserActivity = () => {
      resetInactivityTimer(router.currentRoute.value.path);
    };

    window.addEventListener('mousemove', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity, { passive: true });
    window.addEventListener('click', onUserActivity, { passive: true });
    window.addEventListener('touchstart', onUserActivity, { passive: true });

    activityListenersAttached = true;
  }
}

/**
 * Prepare a new 2FA setup bundle (secret, recovery code, QR data URL)
 */
export async function prepare2faSetup(companyName = 'Frappe Books') {
  const secret = generateTotpSecret(16);
  const recovery = generateRecoveryCode();
  const uri = generateOtpAuthUri('Business Owner', companyName, secret);
  const qrDataUrl = await generateQrDataUrl(uri);

  return {
    secret,
    recoveryCode: recovery,
    otpAuthUri: uri,
    qrDataUrl,
  };
}

/**
 * Save new 2FA setup in SystemSettings after verifying test token
 */
export async function commit2faSetup(
  secret: string,
  recovery: string,
  testToken: string
): Promise<{ success: boolean; message?: string }> {
  const isValid = await verifyTotpCode(secret, testToken);
  if (!isValid) {
    return {
      success: false,
      message:
        'Verification failed. Please check the 6-digit code on your phone.',
    };
  }

  const systemSettings = fyo.singles.SystemSettings;
  if (!systemSettings) {
    return { success: false, message: 'SystemSettings not found.' };
  }

  await systemSettings.set('security2faEnabled', true);
  await systemSettings.set('securityTotpSecret', secret);
  await systemSettings.set('securityRecoveryCode', recovery);
  await systemSettings.sync();

  // Update reactive state immediately
  is2faEnabled.value = true;
  totpSecret.value = secret;
  recoveryCode.value = recovery;
  isUnlocked.value = false;

  return { success: true };
}

/**
 * Disable 2FA in SystemSettings after confirming token or recovery code
 */
export async function disable2fa(
  tokenOrRecovery: string
): Promise<{ success: boolean; message?: string }> {
  refreshSecurityState();
  const secret = totpSecret.value;
  const currentRecovery = recoveryCode.value;

  const isTotpValid = secret
    ? await verifyTotpCode(secret, tokenOrRecovery)
    : false;
  const cleanEntered = tokenOrRecovery.trim().toUpperCase().replace(/-/g, '');
  const cleanStored = currentRecovery.trim().toUpperCase().replace(/-/g, '');
  const isRecoveryValid = cleanStored && cleanEntered === cleanStored;

  if (!isTotpValid && !isRecoveryValid) {
    return {
      success: false,
      message: 'Invalid 6-digit code or recovery code.',
    };
  }

  const systemSettings = fyo.singles.SystemSettings;
  if (!systemSettings) {
    return { success: false, message: 'SystemSettings not found.' };
  }

  await systemSettings.set('security2faEnabled', false);
  await systemSettings.set('securityTotpSecret', '');
  await systemSettings.set('securityRecoveryCode', '');
  await systemSettings.sync();

  is2faEnabled.value = false;
  totpSecret.value = '';
  recoveryCode.value = '';
  isUnlocked.value = false;

  return { success: true };
}
