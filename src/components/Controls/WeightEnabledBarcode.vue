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
      :placeholder="t`Enter weight barcode`"
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
  name: 'WeightEnabledBarcode',
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
      if (this.cooldown === barcode) {
        return;
      }

      this.cooldown = barcode;
      setTimeout(() => (this.cooldown = ''), 100);

      const matchedItems = (await this.fyo.db.getAll('Item', {
        filters: { barcode },
        fields: ['name'],
      })) as { name: string }[];

      const itemName = matchedItems?.[0]?.name;

      if (itemName) {
        this.success(this.t`${itemName} quantity 1 added.`);
        this.$emit('item-selected', itemName);

        return;
      }

      const isWeightEnabled =
        this.fyo.singles.POSSettings?.weightEnabledBarcode;
      const checkDigits = this.fyo.singles.POSSettings?.checkDigits as number;
      const checkDigitsStr = checkDigits.toString();

      const itemCodeDigits = this.fyo.singles.POSSettings
        ?.itemCodeDigits as number;
      const itemWeightDigits = this.fyo.singles.POSSettings
        ?.itemWeightDigits as number;

      if (
        code.length !==
        checkDigitsStr.length + itemCodeDigits + itemWeightDigits
      ) {
        return this.error(this.t`Barcode ${barcode} has an invalid length.`);
      }

      if (!barcode.startsWith(checkDigitsStr)) {
        return this.error(this.t`Item with barcode ${barcode} not found.`);
      }

      const filters: Record<string, string> = {
        itemCode: barcode.slice(
          checkDigitsStr.length,
          checkDigitsStr.length + itemCodeDigits
        ),
      };

      const fields = ['name', 'unit'];

      const items =
        (await this.fyo.db.getAll('Item', { filters, fields })) || [];
      const { name, unit } = items[0] || {};

      if (!name) {
        return this.error(this.t`Item with barcode ${barcode} not found.`);
      }

      const quantity = isWeightEnabled
        ? this.parseBarcode(
            barcode,
            unit as string,
            checkDigitsStr.length + itemCodeDigits
          )
        : 1;

      this.success(this.t`${name as string} quantity ${quantity} added.`);
      this.$emit('item-selected', name, quantity);
    },

    parseBarcode(barcode: string, unitType: string, sliceDigit: number) {
      const weightRaw = parseInt(barcode.slice(sliceDigit));

      let itemQuantity = 0;

      switch (unitType) {
        case 'Kg':
          itemQuantity = Math.floor(weightRaw / 1000);
          break;
        case 'Gram':
          itemQuantity = weightRaw;
          break;
        case 'Unit':
        case 'Meter':
        case 'Hour':
        case 'Day':
          itemQuantity = weightRaw;
          break;
        default:
          throw new Error('Unknown unit type!');
      }

      return itemQuantity;
    },
    async scanListener(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
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
