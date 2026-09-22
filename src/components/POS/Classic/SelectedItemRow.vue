<template>
  <feather-icon
    :name="isExapanded ? 'chevron-up' : 'chevron-down'"
    class="w-4 h-4 inline-flex cursor-pointer text-gray-700 dark:text-gray-200"
    @click="toggleExpand"
  />

  <div class="relative" @click="toggleExpandAndEmit">
    <Link
      class="pt-2"
      :df="{
        fieldname: 'item',
        fieldtype: 'Data',
        label: 'item',
      }"
      size="small"
      :border="false"
      :value="row.item"
      :read-only="true"
    />
    <p
      v-if="row.isFreeItem"
      class="absolute flex top-0 font-medium text-xs ml-2 text-green-800"
      style="font-size: 0.6rem"
    >
      {{ row.pricingRule }}
    </p>
  </div>

  <div class="flex items-center">
    <Int
      :df="{
        fieldname: 'quantity',
        fieldtype: 'Int',
        label: 'Quantity',
      }"
      size="small"
      :border="false"
      :value="getDisplayTransferQuantity()"
      :read-only="true"
    />
    <div class="flex flex-col ml-1">
      <feather-icon
        name="chevron-up"
        class="
          w-3
          h-3
          cursor-pointer
          hover:text-blue-500
          text-gray-700
          dark:text-gray-200
        "
        @click="adjustQuantity(1)"
      />
      <feather-icon
        name="chevron-down"
        class="
          w-3
          h-3
          cursor-pointer
          hover:text-blue-500
          text-gray-700
          dark:text-gray-200
        "
        @click="adjustQuantity(-1)"
      />
    </div>
  </div>

  <Link
    class="ml-5"
    :df="{
      fieldname: 'transferUnit',
      fieldtype: 'Data',
      label: 'Unit',
    }"
    size="small"
    :border="false"
    :value="row.transferUnit || row.unit"
    :read-only="true"
  />

  <Currency
    :df="{
      fieldtype: 'Currency',
      fieldname: 'rate',
      label: 'rate',
    }"
    size="small"
    :border="false"
    :value="row.rate"
    :read-only="true"
  />

  <Currency
    :df="{
      fieldtype: 'Currency',
      fieldname: 'amount',
      label: t`Amount`,
    }"
    size="small"
    :border="false"
    :value="displayAmount"
    :read-only="true"
  />

  <div class="px-4">
    <feather-icon
      name="trash"
      class="w-4 text-xl text-red-500"
      @click="removeAddedItem(row)"
    />
  </div>

  <div></div>

  <template v-if="isExapanded">
    <div class="px-4 pt-6 col-span-1">
      <Int
        v-if="isUOMConversionEnabled"
        :df="{
          fieldtype: 'Int',
          fieldname: 'transferQuantity',
          label: 'Transfer Quantity',
        }"
        size="medium"
        :border="true"
        :show-label="true"
        :value="getDisplayTransferQuantity()"
        @change="(value:string) => row.set('transferQuantity', value)"
        :read-only="isReadOnly"
      />
    </div>

    <div class="px-4 pt-6 col-span-2">
      <AutoComplete
        v-if="isUOMConversionEnabled && transferUnitOptions.length"
        :key="row.item"
        :df="{
          fieldtype: 'AutoComplete',
          fieldname: 'transferUnit',
          label: t`Transfer Unit`,
          options: transferUnitOptions,
        }"
        class="flex-1"
        :show-label="true"
        :border="true"
        :value="row.transferUnit ?? ''"
        @change="(value:string) => row.set('transferUnit', value)"
        :read-only="isReadOnly"
      />
    </div>

    <div class="px-4 pt-6 col-span-2">
      <Float
        :df="{
          fieldname: 'quantity',
          fieldtype: 'Float',
          label: 'Quantity',
        }"
        size="medium"
        :min="0"
        :border="true"
        :show-label="true"
        :value="row.quantity"
        @change="(value:number) => setQuantity(value)"
        :read-only="isUOMConversionEnabled"
      />
    </div>

    <div></div>
    <div></div>

    <div class="px-4 pt-6">
      <Currency
        :df="{
          fieldtype: 'Currency',
          fieldname: 'rate',
          label: 'Rate',
        }"
        size="medium"
        :show-label="true"
        :border="true"
        :value="row.rate"
        :read-only="isRateReadOnly()"
        @change="(value:Money) => setRate((row.rate = value))"
      />
    </div>
    <div class="px-6 pt-6 col-span-2">
      <Currency
        v-if="isDiscountingEnabled"
        :df="{
          fieldtype: 'Currency',
          fieldname: 'discountAmount',
          label: 'Discount Amount',
        }"
        class="col-span-2"
        size="medium"
        :show-label="true"
        :border="true"
        :value="row.itemDiscountAmount"
        :read-only="isDiscountsReadOnly(row.itemDiscountPercent as number > 0)"
        @change="(value:number) => setItemDiscount('amount', value)"
      />
    </div>

    <div class="px-4 pt-6 col-span-2">
      <Float
        v-if="isDiscountingEnabled"
        :df="{
          fieldtype: 'Float',
          fieldname: 'itemDiscountPercent',
          label: 'Discount Percent',
        }"
        size="medium"
        :show-label="true"
        :border="true"
        :value="row.itemDiscountPercent"
        :read-only="isDiscountsReadOnly(!row.itemDiscountAmount?.isZero())"
        @change="(value:number) => setItemDiscount('percent', value)"
      />
    </div>

    <div class="px-4 pt-6 col-span-2">
      <div v-if="isRateCipherEnabled">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs text-gray-500 font-medium">{{ t`Incoming Rate` }}</span>
          <button
            type="button"
            class="p-0.5 text-gray-400 hover:text-gray-700 focus:outline-none transition-colors cursor-pointer"
            :title="isPeekingRate ? t`Hide Rate` : t`Reveal Rate`"
            @click="togglePeekRate"
          >
            <feather-icon :name="isPeekingRate ? 'eye-off' : 'eye'" class="w-3.5 h-3.5" />
          </button>
        </div>
        <div
          class="w-full text-end px-3 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 text-gray-800 font-mono tracking-wider select-none cursor-pointer"
          :class="{ 'font-sans tracking-normal font-medium': isPeekingRate }"
          :title="t`Click to toggle reveal`"
          @click="togglePeekRate"
        >
          {{ displayedValuationRate }}
        </div>
      </div>
      <Currency
        v-else
        :df="{
          fieldtype: 'Currency',
          fieldname: 'valuationRate',
          label: 'Incoming Rate',
        }"
        size="medium"
        :show-label="true"
        :border="true"
        :value="valuationRate"
        :read-only="true"
      />
    </div>

    <div class=""></div>

    <div
      v-if="row.links?.item && row.links?.item.hasBatch"
      class="pl-6 px-4 pt-6 col-span-2"
    >
      <Link
        :df="{
          fieldname: 'batch',
          fieldtype: 'Link',
          target: 'Batch',
          label: t`Batch`,
          filters: { item: row.item as string},
        }"
        :value="row.batch"
        :border="true"
        :show-label="true"
        :read-only="false"
        @change="(value:string) => setBatch(value)"
      />
    </div>

    <div v-if="showAvlQuantityInBatch" class="px-5 pt-6 col-span-2">
      <Float
        :df="{
          fieldname: 'availableQtyInBatch',
          fieldtype: 'Float',
          label: t`Qty in Batch`,
        }"
        size="medium"
        :min="0"
        :value="availableQtyInBatch"
        :show-label="true"
        :border="true"
        :read-only="true"
        :text-right="true"
      />
    </div>

    <div v-if="hasSerialNumber" class="px-6 pt-6 col-span-3">
      <Text
        :df="{
          label: t`Serial Number`,
          fieldtype: 'Text',
          fieldname: 'serialNumber',
        }"
        :value="itemSerialNumbers[row.item as string] || row.serialNumber"
        :show-label="true"
        :border="true"
        :required="hasSerialNumber"
        @change="(value:string)=> setSerialNumber(value)"
      />
    </div>
  </template>
</template>

<script lang="ts">
import Currency from 'src/components/Controls/Currency.vue';
import Data from 'src/components/Controls/Data.vue';
import Float from 'src/components/Controls/Float.vue';
import Int from 'src/components/Controls/Int.vue';
import Link from 'src/components/Controls/Link.vue';
import Text from 'src/components/Controls/Text.vue';
import { inject } from 'vue';
import { fyo } from 'src/initFyo';
import { defineComponent, PropType } from 'vue';
import { SalesInvoiceItem } from 'models/baseModels/SalesInvoiceItem/SalesInvoiceItem';
import { Money } from 'pesa';
import { DiscountType } from '../types';
import { validateSerialNumberCount, getPOSRateCipherConfig, getItemDisplayAmount } from 'src/utils/pos';
import { encodeNumberToCipher } from 'src/utils/cipher';
import { getItemVisibility, validateQty } from 'models/helpers';
import { InvoiceItem } from 'models/baseModels/InvoiceItem/InvoiceItem';
import { SalesInvoice } from 'models/baseModels/SalesInvoice/SalesInvoice';
import { showToast } from 'src/utils/interactive';
import { ModelNameEnum } from 'models/types';
import AutoComplete from 'src/components/Controls/AutoComplete.vue';
import { getExistingActiveSerialNumbersForItem } from 'models/inventory/helpers';

export default defineComponent({
  name: 'SelectedItemRow',
  components: { Currency, Data, Float, Int, Link, Text, AutoComplete },
  props: {
    row: { type: SalesInvoiceItem, required: true },
    batchAdded: { type: Boolean, default: false },
    expandedBatchId: {
      type: String as PropType<string | null | undefined>,
      default: undefined,
    },
  },
  emits: [
    'runSinvFormulas',
    'applyPricingRule',
    'selectedRow',
    'setExpandedBatchId',
  ],
  setup() {
    return {
      isDiscountingEnabled: inject('isDiscountingEnabled') as boolean,
      itemSerialNumbers: inject('itemSerialNumbers') as {
        [item: string]: string;
      },
      isTaxInclusive: inject('isTaxInclusive', false),
    };
  },
  data() {
    return {
      isExapanded: false,
      batches: [] as string[],
      availableQtyInBatch: 0,
      itemVisibility: '',
      defaultRate: this.row.rate as Money,
      profileDiscountSetting: null as boolean | null,
      profileRateSetting: null as boolean | null,
      transferUnitOptions: [] as Array<{ label: string; value: string }>,
      isMounted: false,
      pendingTransferUnitChange: false,
      transferUnitChangeOldQty: 0,
      valuationRate: 0,
      profileCipherSetting: false,
      profileCipherWord: '',
      isPeekingRate: false,
      peekTimer: null as any,
    };
  },
  watch: {
    expandedBatchId(newVal) {
      if (newVal !== this.row.name) {
        this.isExapanded = false;
      }
    },
    'row.batch': {
      async handler(newBatch) {
        if (newBatch) {
          this.availableQtyInBatch = await this.getAvailableQtyInBatch();
          this.isExapanded = true;
          this.$emit('setExpandedBatchId', this.row.name);
        }
      },
      immediate: true,
    },
    'row.item': {
      async handler(newItem) {
        if (newItem) {
          await this.updateTransferUnitOptions();
        } else {
          this.transferUnitOptions = [];
        }
      },
      immediate: true,
    },
    'row.quantity': {
      async handler(newQuantity, oldQuantity) {
        if (
          this.hasSerialNumber &&
          newQuantity &&
          newQuantity > 0 &&
          this.isMounted &&
          newQuantity !== oldQuantity
        ) {
          await this.fetchSerialNumbers(false, true);
        }
      },
      immediate: false,
    },
    'row.transferQuantity': {
      async handler(newTransferQuantity, oldTransferQuantity) {
        if (
          this.pendingTransferUnitChange &&
          newTransferQuantity !== this.transferUnitChangeOldQty
        ) {
          this.pendingTransferUnitChange = false;
          this.transferUnitChangeOldQty = 0;

          await this.fetchSerialNumbers(true, false);
          return;
        }

        if (
          this.isUOMConversionEnabled &&
          this.hasSerialNumber &&
          newTransferQuantity &&
          newTransferQuantity > 0 &&
          this.isMounted &&
          newTransferQuantity !== oldTransferQuantity &&
          !this.pendingTransferUnitChange
        ) {
          await this.fetchSerialNumbers(false, false);
        }
      },
      immediate: false,
    },
    'row.transferUnit': {
      async handler(newTransferUnit, oldTransferUnit) {
        if (
          this.isUOMConversionEnabled &&
          this.hasSerialNumber &&
          newTransferUnit &&
          oldTransferUnit &&
          newTransferUnit !== oldTransferUnit &&
          this.isMounted
        ) {
          delete this.itemSerialNumbers[this.row.item as string];
          await this.row.set('serialNumber', '');

          this.pendingTransferUnitChange = true;
          this.transferUnitChangeOldQty = this.row.transferQuantity ?? 0;
        }
      },
      immediate: false,
    },
  },
  computed: {
    isRateCipherEnabled(): boolean {
      const posSettings =
        this.fyo?.singles?.POSSettings || fyo.singles.POSSettings;
      return Boolean(
        this.profileCipherSetting || posSettings?.encodeIncomingRate
      );
    },
    rateCipherWord(): string {
      const posSettings =
        this.fyo?.singles?.POSSettings || fyo.singles.POSSettings;
      return (
        this.profileCipherWord ||
        posSettings?.rateCipherWord ||
        'BLACKHORSE'
      )
        .trim()
        .toUpperCase();
    },
    displayedValuationRate(): string {
      if (this.isPeekingRate) {
        return this.fyo.format(this.valuationRate, {
          fieldtype: 'Currency',
          fieldname: 'valuationRate',
          label: 'Incoming Rate',
        });
      }
      return encodeNumberToCipher(this.valuationRate, this.rateCipherWord);
    },
    isUOMConversionEnabled(): boolean {
      return !!fyo.singles.InventorySettings?.enableUomConversions;
    },
    hasSerialNumber(): boolean {
      return !!(this.row.links?.item && this.row.links?.item.hasSerialNumber);
    },
    displayAmount(): Money {
      const isInclusive = Boolean(
        (typeof this.isTaxInclusive === 'object' && this.isTaxInclusive !== null && 'value' in (this.isTaxInclusive as any)
          ? (this.isTaxInclusive as any).value
          : this.isTaxInclusive) ?? this.row.parentdoc?.taxInclusive
      );
      return getItemDisplayAmount(this.row, isInclusive, this.fyo);
    },
    isReadOnly() {
      return this.row.isFreeItem;
    },
    showAvlQuantityInBatch() {
      return (
        this.row.links?.item &&
        this.row.links?.item.hasBatch &&
        this.itemVisibility
      );
    },
  },

  beforeUnmount() {
    if (this.peekTimer) {
      clearTimeout(this.peekTimer);
    }
  },

  async mounted() {
    const posProfileName = this.fyo.singles.POSSettings?.posProfile;

    if (posProfileName) {
      const profile = await this.fyo.doc.getDoc(
        ModelNameEnum.POSProfile,
        posProfileName as string
      );

      this.profileDiscountSetting =
        !!profile?.canEditDiscount ||
        !!this.fyo.singles.POSSettings?.canEditDiscount;

      this.profileRateSetting =
        !!profile?.canChangeRate ||
        !!this.fyo.singles.POSSettings?.canChangeRate;

      this.itemVisibility = await getItemVisibility(this.fyo);
    } else {
      this.profileDiscountSetting =
        !!this.fyo.singles.POSSettings?.canEditDiscount;

      this.profileRateSetting = !!this.fyo.singles.POSSettings?.canChangeRate;
      this.itemVisibility = await getItemVisibility(this.fyo);
    }

    const cipherConfig = await getPOSRateCipherConfig(
      this.fyo,
      posProfileName as string
    );
    this.profileCipherSetting = cipherConfig.encodeIncomingRate;
    this.profileCipherWord = cipherConfig.rateCipherWord;

    await this.$nextTick();

    this.isMounted = true;

    if (this.hasSerialNumber) {
      await this.fetchSerialNumbers();
    }
  },

  methods: {
    togglePeekRate() {
      this.isPeekingRate = !this.isPeekingRate;
      if (this.peekTimer) {
        clearTimeout(this.peekTimer);
        this.peekTimer = null;
      }
      if (this.isPeekingRate) {
        this.peekTimer = setTimeout(() => {
          this.isPeekingRate = false;
          this.peekTimer = null;
        }, 4000);
      }
    },
    toggleExpand() {
      if (this.isExapanded) {
        this.isExapanded = false;
        this.$emit('setExpandedBatchId', undefined);
      } else {
        this.isExapanded = true;
        this.fetchValuationRate();
        this.$emit('setExpandedBatchId', this.row.name);
      }
    },
    toggleExpandAndEmit() {
      this.toggleExpand();
      this.$emit('selectedRow', this.row);
    },
    emitSelectedRow() {
      this.$emit('selectedRow', this.row);
    },
    adjustQuantity(change: number) {
      let currentQuantity = this.row.quantity ?? 1;
      let newQuantity = currentQuantity + change;

      if (newQuantity === 0) {
        return;
      }

      this.setQuantity(newQuantity);
    },
    async updateTransferUnitOptions() {
      if (!this.row.item) {
        this.transferUnitOptions = [];
        return;
      }

      const itemDoc = await fyo.doc.getDoc('Item', this.row.item as string);

      const conversions = (itemDoc?.uomConversions ?? []) as Array<{
        uom: string;
        conversionFactor: number;
      }>;

      const allowedUoms = new Set<string>();

      if (typeof itemDoc?.unit === 'string') {
        allowedUoms.add(itemDoc.unit);
      }

      for (const c of conversions) {
        if (typeof c.uom === 'string') {
          allowedUoms.add(c.uom);
        }
      }

      this.transferUnitOptions = [...allowedUoms].map((uom) => ({
        label: uom,
        value: uom,
      }));
    },

    async fetchValuationRate() {
      if (this.valuationRate) return;

      const sles = await fyo.db.getAll('StockLedgerEntry', {
        fields: ['name', 'rate', 'quantity'],
        filters: { item: this.row.item as string },
        orderBy: ['date', 'created'],
        order: 'desc',
        limit: 10,
      });

      const inwardSle = sles?.find((s: any) => (s.quantity as number) > 0);

      if (inwardSle && inwardSle.rate) {
        this.valuationRate = inwardSle.rate as number;
      } else {
        const pii = await fyo.db.getAll('PurchaseInvoiceItem', {
          fields: ['name', 'rate'],
          filters: { item: this.row.item as string },
          limit: 1,
        });
        if (pii && pii.length > 0 && pii[0].rate) {
          this.valuationRate = pii[0].rate as number;
        }
      }
    },

    async getAvailableQtyInBatch(): Promise<number> {
      if (!this.row.batch) {
        return 0;
      }

      return (
        (await fyo.db.getStockQuantity(
          this.row.item as string,
          undefined,
          undefined,
          undefined,
          this.row.batch
        )) ?? 0
      );
    },

    getDisplayTransferQuantity() {
      const transferQty = this.row.transferQuantity;

      if (!this.isUOMConversionEnabled) {
        return transferQty;
      }

      const hasValidQuantity = transferQty && transferQty;

      if (this.row.isReturn && hasValidQuantity) {
        return -Math.abs(transferQty);
      }

      return transferQty;
    },

    isDiscountsReadOnly(isValidDiscount: boolean) {
      const canEditDiscount = this.profileDiscountSetting;

      return this.row.isFreeItem || !canEditDiscount || isValidDiscount;
    },
    async setBatch(batch: string) {
      this.row.set('batch', batch);
      await this.getAvailableQtyInBatch();
    },
    setSerialNumber(serialNumber: string) {
      if (!serialNumber) {
        return;
      }

      this.row.set('serialNumber', serialNumber);
      this.itemSerialNumbers[this.row.item as string] = serialNumber;

      validateSerialNumberCount(
        serialNumber,
        Math.abs(this.row.quantity ?? 0),
        this.row.item!
      );
    },
    async fetchSerialNumbers(forceRefetch = false, useDirectQuantity = false) {
      if (!this.hasSerialNumber) {
        return;
      }

      let quantity = 0;
      if (useDirectQuantity) {
        quantity = Math.abs(this.row.quantity ?? 0);
      } else if (this.isUOMConversionEnabled && this.row.transferQuantity) {
        quantity = Math.abs(this.row.transferQuantity);
      } else if (this.row.quantity) {
        quantity = Math.abs(this.row.quantity);
      }

      if (quantity <= 0) {
        return;
      }

      const existingSerialNumbers =
        this.itemSerialNumbers[this.row.item as string];

      if (existingSerialNumbers && !forceRefetch) {
        const existingCount = existingSerialNumbers
          .split('\n')
          .filter((s) => s.trim()).length;

        if (existingCount === quantity) {
          return;
        } else {
        }
      }

      try {
        const serialNumbers = await getExistingActiveSerialNumbersForItem(
          this.fyo,
          this.row.item as string,
          quantity
        );

        if (serialNumbers) {
          await this.row.set('serialNumber', serialNumbers);
          this.itemSerialNumbers[this.row.item as string] = serialNumbers;
        } else {
        }
      } catch (error) {}
    },
    isRateReadOnly() {
      const canChangeRate = this.profileRateSetting;
      return this.row.isFreeItem || !canChangeRate;
    },
    setItemDiscount(type: DiscountType, value: Money | number) {
      if (type === 'percent') {
        this.row.set('setItemDiscountAmount', false);
        this.row.set('itemDiscountPercent', value as number);
        return;
      }
      this.row.set('setItemDiscountAmount', true);
      this.row.set('itemDiscountAmount', value as Money);
    },
    setRate(rate: Money) {
      this.row.setRate = rate;
      this.$emit('runSinvFormulas');
    },
    async setQuantity(quantity: number) {
      const hasManualDiscount = this.row.setItemDiscountAmount;
      const isPercentageDiscount =
        !hasManualDiscount && this.row.itemDiscountPercent !== 0;
      const manualDiscountAmount = this.row.itemDiscountAmount;
      const manualDiscountPercent = this.row.itemDiscountPercent;

      if (!this.row.isReturn && quantity <= 0) {
        showToast({
          type: 'error',
          message: 'Quantity must be greater than zero.',
          duration: 'short',
        });

        quantity = this.row.quantity ?? 1;
      }

      this.row.set('quantity', quantity);

      const existingItems =
        (this.row.parentdoc as SalesInvoice).items?.filter(
          (invoiceItem: InvoiceItem) =>
            invoiceItem.item === this.row.item && !invoiceItem.isFreeItem
        ) ?? [];

      quantity = this.row.quantity ?? 1;

      try {
        await validateQty(
          this.row.parentdoc as SalesInvoice,
          this.row,
          existingItems
        );
      } catch (error) {
        this.row.set('quantity', quantity);

        return showToast({
          type: 'error',
          message: this.t`${error as string}`,
          duration: 'short',
        });
      }

      if (!this.row.isFreeItem) {
        this.$emit('applyPricingRule');
        this.$emit('runSinvFormulas');

        if (!hasManualDiscount && !isPercentageDiscount) {
          this.row.set('setItemDiscountAmount', false);
          this.row.set('itemDiscountPercent', 0);
        }

        if (hasManualDiscount) {
          this.row.set('setItemDiscountAmount', true);
          this.row.set('itemDiscountAmount', manualDiscountAmount);
        } else if (isPercentageDiscount) {
          this.row.set('setItemDiscountAmount', false);
          this.row.set('itemDiscountPercent', manualDiscountPercent);
        }
      }
    },
    async removeAddedItem(row: SalesInvoiceItem) {
      this.row.parentdoc?.remove('items', row?.idx as number);
      this.row.runFormulas();
      if (!row.isFreeItem) {
        this.$emit('applyPricingRule');
      }
    },
  },
});
</script>
