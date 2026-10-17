<template>
  <div
    class="
      px-2
      w-36
      flex
      items-center
      border
      rounded
      bg-gray-50
      dark:text-gray-200
      dark:border-gray-800
      dark:bg-gray-890
      dark:focus-within:bg-gray-900
      focus-within:bg-gray-100
    "
  >
    <input
      ref="scanner"
      type="text"
      class="text-base placeholder-gray-600 w-full bg-transparent outline-none"
      :placeholder="t`Enter barcode`"
      @change="handleChange"
    />
    <feather-icon
      name="maximize"
      class="w-3 h-3 text-gray-600 dark:text-gray-400 cursor-text"
      @click="() => ($refs.scanner as HTMLInputElement).focus()"
    />
  </div>
</template>

<script lang="ts">
import { showToast } from 'src/utils/interactive';
import { defineComponent } from 'vue';
export default defineComponent({
  emits: ['item-selected'],
  data() {
    return {
      timerId: null,
      barcode: '',
      cooldown: '',
      hasListener: false,
    } as {
      timerId: null | ReturnType<typeof setTimeout>;
      barcode: string;
      cooldown: string;
      hasListener: boolean;
    };
  },
  mounted() {
    this.addScanListener();
  },
  unmounted() {
    this.removeScanListener();
  },
  activated() {
    this.addScanListener();
  },
  deactivated() {
    this.removeScanListener();
  },
  methods: {
    addScanListener() {
      if (!this.hasListener) {
        document.addEventListener('keydown', this.scanListener);
        this.hasListener = true;
      }
    },
    removeScanListener() {
      if (this.hasListener) {
        document.removeEventListener('keydown', this.scanListener);
        this.hasListener = false;
      }
      this.clearInterval();
      this.barcode = '';
    },
    handleChange(e: Event) {
      const elem = e.target as HTMLInputElement;
      this.selectItem(elem.value);
      elem.value = '';
    },
    async selectItem(code: string) {
      const barcode = (code || '').trim();
      if (!barcode || barcode.length < 2) {
        return;
      }

      /**
       * Between two entries of the same item, this adds
       * a cooldown period of 100ms. This is to prevent
       * double entry.
       */
      if (this.cooldown === barcode) {
        return;
      }
      this.cooldown = barcode;
      setTimeout(() => (this.cooldown = ''), 100);

      const items = (await this.fyo.db.getAll('Item', {
        filters: { barcode },
        fields: ['name'],
      })) as { name: string }[];

      const name = items?.[0]?.name;

      if (!name) {
        return this.error(this.t`Item with barcode ${barcode} not found.`);
      }

      this.success(this.t`${name} quantity 1 added.`);
      this.$emit('item-selected', name);
    },
    async scanListener(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // Do not intercept if user is typing into any form field (e.g. Qty, Rate, Search, etc.)
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable) &&
        target !== this.$refs.scanner
      ) {
        return;
      }

      const { key, code } = e;
      const keyCode = Number(key);
      const isEnter = code === 'Enter';
      if (Number.isNaN(keyCode) && !isEnter) {
        return;
      }

      if (isEnter) {
        if (this.barcode.trim().length >= 2) {
          return await this.setItemFromBarcode();
        }
        this.barcode = '';
        this.clearInterval();
        return;
      }

      this.clearInterval();

      this.barcode += key;
      this.timerId = setTimeout(async () => {
        if (this.barcode.trim().length >= 3) {
          await this.setItemFromBarcode();
        }
        this.barcode = '';
      }, 50);
    },
    async setItemFromBarcode() {
      await this.selectItem(this.barcode);

      this.barcode = '';
      this.clearInterval();
    },
    clearInterval() {
      if (this.timerId === null) {
        return;
      }

      clearInterval(this.timerId);
      this.timerId = null;
    },
    error(message: string) {
      showToast({ type: 'error', message });
    },
    success(message: string) {
      showToast({ type: 'success', message });
    },
  },
});
</script>
