<template>
  <div class="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
    <div class="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
      <h2 class="mb-6 text-2xl font-bold text-gray-800 dark:text-white">App Activation</h2>
      
      <div class="mb-4">
        <label class="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">Your Machine ID</label>
        <div class="flex items-center">
          <input 
            type="text" 
            readonly 
            :value="machineId" 
            class="w-full rounded border px-3 py-2 text-gray-700 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <p class="mt-2 text-xs text-gray-500">Send this ID to the developer to get your activation key.</p>
      </div>

      <div class="mb-6">
        <label class="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">Activation Key</label>
        <input 
          v-model="activationKey" 
          type="text" 
          placeholder="Enter license key" 
          class="w-full rounded border px-3 py-2 text-gray-700 dark:bg-gray-700 dark:text-white"
        />
        <p v-if="errorMsg" class="mt-2 text-xs text-red-500">{{ errorMsg }}</p>
      </div>

      <button 
        @click="activate" 
        class="w-full rounded bg-blue-500 py-2 px-4 font-bold text-white hover:bg-blue-700"
      >
        Activate App
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
const machineId = ref('');
const activationKey = ref('');
const errorMsg = ref('');
const router = useRouter();

onMounted(async () => {
  machineId.value = await window.ipc.getMachineId();
});

const activate = async () => {
  const isValid = await window.ipc.verifyLicense(activationKey.value);
  
  if (isValid) {
    localStorage.setItem('app_license_key', activationKey.value.trim());
    router.push('/dashboard/daybook');
  } else {
    errorMsg.value = 'Invalid License Key';
  }
};
</script>
