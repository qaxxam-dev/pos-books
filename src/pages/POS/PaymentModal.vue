<template>
  <Modal :open-modal="openModal" class="w-4/6 ml-auto mr-auto" :set-close-listener="false" @closemodal="$emit('toggleModal', 'Payment')">
    <div
      v-if="sinvDoc && sinvDoc.fieldMap"
      class="px-6 py-6 flex flex-col overflow-y-auto"
      style="max-height: 88vh;"
    >
      <div class="flex items-center justify-between border-b pb-3 mb-4 dark:border-gray-800">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
            {{ t`POS Payment & Settlement` }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t`Select payment methods, split payments, or apply write-off` }}
          </p>
        </div>
        <div class="text-right">
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
            {{ t`Grand Total` }}
          </span>
          <span class="text-2xl font-black text-teal-600 dark:text-teal-400">
            {{ fyo.format(grandTotal, 'Currency') }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-12 gap-6">
        <!-- Left Column: Payment Methods & Split Payments Table -->
        <div class="col-span-7 flex flex-col gap-4">
          <!-- Quick Add Payment Method Buttons -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
              {{ t`Add Payment Method` }}
            </label>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="method in allPaymentMethods"
                :key="method.name"
                :background="false"
                class="px-4 py-2 border rounded-md text-sm font-semibold transition-all duration-150 flex items-center gap-1.5"
                :class="
                  isMethodAdded(method.name)
                    ? 'bg-teal-50 border-teal-500 text-teal-700 dark:bg-teal-950 dark:border-teal-600 dark:text-teal-300'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
                "
                @click="togglePaymentMethod(method)"
              >
                <span>{{ method.name }}</span>
                <span v-if="isMethodAdded(method.name)" class="text-xs bg-teal-200 text-teal-800 dark:bg-teal-800 dark:text-teal-200 px-1.5 py-0.5 rounded-full font-bold">✓</span>
              </Button>
            </div>
          </div>

          <!-- Payment Entries Table -->
          <div class="bg-gray-50 dark:bg-gray-850 p-4 border rounded-lg dark:border-gray-800">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                {{ t`Payment Breakdown` }}
              </h3>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ localEntries.length }} {{ t`method(s) selected` }}
              </span>
            </div>

            <div v-if="localEntries.length === 0" class="text-center py-6 text-gray-400 text-sm">
              {{ t`No payment method selected. Click a payment method above.` }}
            </div>

            <div class="flex flex-col gap-3">
              <div
                v-for="(entry, index) in localEntries"
                :key="entry.id"
                class="p-3 bg-white dark:bg-gray-900 border rounded-md shadow-sm dark:border-gray-800 flex flex-col gap-2"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-gray-800 dark:text-gray-200 text-base">
                      {{ entry.paymentMethod }}
                    </span>
                    <span
                      class="text-xs px-2 py-0.5 rounded font-semibold"
                      :class="entry.isCash ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'"
                    >
                      {{ entry.isCash ? t`Cash` : t`Non-Cash` }}
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="text-xs font-semibold px-2 py-1 bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-900 dark:text-teal-200 rounded transition-colors"
                      @click="fillRemainingForEntry(index)"
                    >
                      {{ t`Fill Balance` }}
                    </button>
                    <button
                      type="button"
                      class="text-xs text-red-600 hover:text-red-800 dark:text-red-400 p-1 font-bold"
                      @click="removePaymentEntry(index)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-12 gap-2 items-center">
                  <div class="col-span-12">
                    <Currency
                      :df="{
                        label: t`Amount`,
                        fieldtype: 'Currency',
                        fieldname: `entry_amount_${index}`,
                      }"
                      :border="true"
                      :text-right="true"
                      :value="entry.amount"
                      @change="(amount: Money) => updateEntryAmount(index, amount)"
                    />
                  </div>
                </div>

                <!-- Non-Cash reference fields -->
                <div v-if="!entry.isCash" class="grid grid-cols-2 gap-2 pt-1 border-t dark:border-gray-800">
                  <Data
                    :df="{
                      label: t`Ref / Cheque No`,
                      fieldtype: 'Data',
                      fieldname: `entry_ref_${index}`,
                    }"
                    :show-label="true"
                    :border="true"
                    :value="entry.referenceId || ''"
                    @change="(val: string) => entry.referenceId = val"
                  />
                  <DateControl
                    :df="{
                      label: t`Clearance Date`,
                      fieldtype: 'Date',
                      fieldname: `entry_date_${index}`,
                    }"
                    :show-label="true"
                    :border="true"
                    :value="entry.clearanceDate || new Date()"
                    @change="(val: Date) => entry.clearanceDate = val"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Write Off Widget Section -->
          <div class="bg-amber-50/60 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-900 rounded-lg flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                  {{ t`Write Off / Shortage` }}
                </h4>
                <p class="text-xs text-amber-700 dark:text-amber-400">
                  {{ t`Waive small balance or fractional difference` }}
                  <span v-if="writeOffAccountName" class="font-semibold"> ({{ writeOffAccountName }})</span>
                </p>
              </div>
              <button
                type="button"
                class="text-xs font-semibold px-2.5 py-1 bg-amber-200 text-amber-900 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100 rounded transition-colors"
                @click="writeOffRemainingBalance"
              >
                {{ t`Write Off Balance` }}
              </button>
            </div>

            <div class="grid grid-cols-12 gap-2 items-center mt-1">
              <div class="col-span-12">
                <Currency
                  :df="{
                    label: t`Write Off Amount`,
                    fieldtype: 'Currency',
                    fieldname: 'writeOffAmount',
                  }"
                  :border="true"
                  :text-right="true"
                  :value="localWriteOff"
                  @change="(amount: Money) => localWriteOff = amount"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Summary & Calculations -->
        <div class="col-span-5 flex flex-col justify-between">
          <div class="bg-gray-50 dark:bg-gray-850 p-4 border rounded-lg dark:border-gray-800 flex flex-col gap-3">
            <h3 class="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 border-b pb-2 dark:border-gray-700">
              {{ t`Settlement Summary` }}
            </h3>

            <div class="flex justify-between items-center py-1 text-sm text-gray-600 dark:text-gray-400">
              <span>{{ t`Net Total` }}</span>
              <span class="font-medium text-gray-800 dark:text-gray-200">{{ fyo.format(sinvDoc?.netTotal, 'Currency') }}</span>
            </div>

            <div class="flex justify-between items-center py-1 text-sm text-gray-600 dark:text-gray-400">
              <span>{{ t`Taxes & Charges` }}</span>
              <span class="font-medium text-gray-800 dark:text-gray-200">{{ fyo.format(totalTaxedAmount, 'Currency') }}</span>
            </div>

            <div v-if="isDiscountingEnabled" class="flex justify-between items-center py-1 text-sm text-gray-600 dark:text-gray-400">
              <span>{{ t`Discounts` }}</span>
              <span class="font-medium text-gray-800 dark:text-gray-200">{{ fyo.format(itemDiscounts, 'Currency') }}</span>
            </div>

            <div class="flex justify-between items-center py-2 text-base font-bold border-t border-b dark:border-gray-700 text-gray-900 dark:text-gray-100">
              <span>{{ t`Grand Total` }}</span>
              <span>{{ fyo.format(grandTotal, 'Currency') }}</span>
            </div>

            <div class="flex justify-between items-center py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <span>{{ t`Total Paid` }}</span>
              <span>{{ fyo.format(totalPaid, 'Currency') }}</span>
            </div>

            <div v-if="!localWriteOff.isZero()" class="flex justify-between items-center py-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
              <span>{{ t`Write Off Amount` }}</span>
              <span>{{ fyo.format(localWriteOff, 'Currency') }}</span>
            </div>

            <div
              v-if="remainingBalance.gt(0)"
              class="flex justify-between items-center p-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded text-sm font-bold text-red-700 dark:text-red-300"
            >
              <span>{{ t`Unpaid Balance` }}</span>
              <span>{{ fyo.format(remainingBalance, 'Currency') }}</span>
            </div>

            <div
              v-if="paidChange.gt(0)"
              class="flex justify-between items-center p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded text-sm font-bold text-emerald-700 dark:text-emerald-300"
            >
              <span>{{ t`Paid Change` }}</span>
              <span>{{ fyo.format(paidChange, 'Currency') }}</span>
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="grid grid-cols-2 gap-3 mt-6">
            <Button
              class="col-span-2 py-4 bg-emerald-600 hover:bg-emerald-700 font-bold text-lg rounded-md uppercase transition-colors"
              @click="payAndPrintTransaction"
            >
              <slot>
                <span>{{ t`Pay & Print` }}</span>
              </slot>
            </Button>

            <Button
              class="col-span-1 py-3 bg-green-600 hover:bg-green-700 font-bold text-base rounded-md uppercase transition-colors"
              style="color: #ffffff !important;"
              @click="payTransaction"
            >
              <slot>
                <span style="color: #ffffff !important;">{{ t`Pay Only` }}</span>
              </slot>
            </Button>

            <Button
              class="col-span-1 py-3 bg-red-500 hover:bg-red-600 font-bold text-base rounded-md uppercase transition-colors"
              style="color: #ffffff !important;"
              @click="cancelTransaction"
            >
              <slot>
                <span style="color: #ffffff !important;">{{ t`Cancel` }}</span>
              </slot>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script lang="ts">
import Button from 'src/components/Button.vue';
import Currency from 'src/components/Controls/Currency.vue';
import Data from 'src/components/Controls/Data.vue';
import DateControl from 'src/components/Controls/Date.vue';
import Modal from 'src/components/Modal.vue';
import { Money } from 'pesa';
import { SalesInvoice } from 'models/baseModels/SalesInvoice/SalesInvoice';
import { defineComponent, inject } from 'vue';
import { fyo } from 'src/initFyo';
import { ModelNameEnum } from 'models/types';
import { showToast } from 'src/utils/interactive';
import { POSPaymentEntry } from 'src/components/POS/types';

interface PaymentMethodObj {
  name: string;
  type: 'Cash' | 'Bank' | string;
}

export default defineComponent({
  name: 'PaymentModal',
  components: {
    Modal,
    Currency,
    Button,
    Data,
    DateControl,
  },
  props: {
    openModal: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    'createTransaction',
    'setPaidAmount',
    'setPaymentMethod',
    'setPaymentEntries',
    'setWriteOffAmount',
    'setTransferClearanceDate',
    'setTransferRefNo',
    'toggleModal',
  ],
  setup() {
    return {
      paidAmount: inject('paidAmount') as Money,
      paymentMethod: inject('paymentMethod') as string,
      isDiscountingEnabled: inject('isDiscountingEnabled') as boolean,
      itemDiscounts: inject('itemDiscounts') as Money,
      transferAmount: inject('transferAmount') as Money,
      sinvDoc: inject('sinvDoc') as SalesInvoice,
      transferRefNo: inject('transferRefNo') as string,
      transferClearanceDate: inject('transferClearanceDate') as Date,
      totalTaxedAmount: inject('totalTaxedAmount') as Money,
    };
  },
  data() {
    return {
      allPaymentMethods: [] as PaymentMethodObj[],
      localEntries: [] as POSPaymentEntry[],
      localWriteOff: fyo.pesa(0),
    };
  },
  computed: {
    fyo: () => fyo,
    writeOffAccountName(): string {
      return fyo.singles.POSSettings?.writeOffAccount || '';
    },
    grandTotal(): Money {
      return this.sinvDoc?.grandTotal ?? fyo.pesa(0);
    },
    totalPaid(): Money {
      let sum = fyo.pesa(0);
      for (const entry of this.localEntries) {
        if (entry.amount && !entry.amount.isZero()) {
          sum = sum.add(entry.amount as any);
        }
      }
      return sum;
    },
    totalCovered(): Money {
      return this.totalPaid.add((this.localWriteOff ?? fyo.pesa(0)) as any);
    },
    remainingBalance(): Money {
      const diff = this.grandTotal.sub(this.totalCovered as any);
      return diff.isPositive() ? diff : fyo.pesa(0);
    },
    paidChange(): Money {
      const diff = this.totalPaid.sub(this.grandTotal as any);
      return diff.isPositive() ? diff : fyo.pesa(0);
    },
  },
  watch: {
    openModal: {
      immediate: true,
      async handler(val: boolean) {
        if (val) {
          await this.loadPaymentMethods();
          this.initLocalState();
        }
      },
    },
  },
  async mounted() {
    await this.loadPaymentMethods();
  },
  methods: {
    async loadPaymentMethods() {
      const methods = (await fyo.db.getAll(ModelNameEnum.PaymentMethod, {
        fields: ['name', 'type'],
      })) as unknown as PaymentMethodObj[];

      this.allPaymentMethods = methods || [];
    },

    initLocalState() {
      this.localEntries = [];
      this.localWriteOff = fyo.pesa(0);

      const targetAmount = this.grandTotal;

      if (this.allPaymentMethods.length > 0) {
        const defaultCashMethod = this.allPaymentMethods.find(m => m.type === 'Cash') || this.allPaymentMethods[0];
        this.localEntries.push({
          id: String(Date.now()),
          paymentMethod: defaultCashMethod.name,
          amount: targetAmount,
          referenceId: '',
          clearanceDate: new Date(),
          isCash: defaultCashMethod.type === 'Cash',
        });
      }
    },

    isMethodAdded(methodName: string): boolean {
      return this.localEntries.some(e => e.paymentMethod === methodName);
    },

    togglePaymentMethod(method: PaymentMethodObj) {
      const existingIdx = this.localEntries.findIndex(e => e.paymentMethod === method.name);
      if (existingIdx !== -1) {
        if (this.localEntries.length > 1) {
          this.localEntries.splice(existingIdx, 1);
        }
        return;
      }

      const isCash = method.type === 'Cash';
      const remaining = this.remainingBalance;

      this.localEntries.push({
        id: String(Date.now() + Math.random()),
        paymentMethod: method.name,
        amount: remaining.gt(0) ? remaining : fyo.pesa(0),
        referenceId: '',
        clearanceDate: new Date(),
        isCash: isCash,
      });
    },

    removePaymentEntry(index: number) {
      if (this.localEntries.length > 1) {
        this.localEntries.splice(index, 1);
      } else {
        showToast({
          type: 'warning',
          message: fyo.t`At least one payment method is required.`,
        });
      }
    },

    updateEntryAmount(index: number, amount: Money) {
      if (this.localEntries[index]) {
        this.localEntries[index].amount = (amount as Money) || fyo.pesa(0);
      }
    },

    fillRemainingForEntry(index: number) {
      if (!this.localEntries[index]) return;

      let otherSum = fyo.pesa(0);
      for (let i = 0; i < this.localEntries.length; i++) {
        if (i !== index) {
          otherSum = otherSum.add((this.localEntries[i].amount ?? fyo.pesa(0)) as any);
        }
      }

      const coveredByOther = otherSum.add((this.localWriteOff ?? fyo.pesa(0)) as any);
      const remaining = this.grandTotal.sub(coveredByOther as any);

      this.localEntries[index].amount = remaining.gt(0) ? remaining : fyo.pesa(0);
    },

    writeOffRemainingBalance() {
      const currentPaid = this.totalPaid;
      const remaining = this.grandTotal.sub(currentPaid);

      if (remaining.gt(0)) {
        this.localWriteOff = remaining;
      } else {
        this.localWriteOff = fyo.pesa(0);
      }
    },

    syncStateToParent() {
      const activeEntries = this.localEntries.filter(e => e.amount && !e.amount.isZero());
      this.$emit('setPaymentEntries', activeEntries.length ? activeEntries : this.localEntries);
      this.$emit('setWriteOffAmount', this.localWriteOff);

      if (this.localEntries.length > 0) {
        this.$emit('setPaymentMethod', this.localEntries[0].paymentMethod);
        this.$emit('setPaidAmount', this.totalPaid);
      }
    },

    payTransaction() {
      if (this.localEntries.length === 0) {
        return showToast({
          type: 'error',
          message: fyo.t`Please select at least one payment method.`,
        });
      }

      this.syncStateToParent();
      this.$emit('createTransaction', false, true);
    },

    payAndPrintTransaction() {
      if (this.localEntries.length === 0) {
        return showToast({
          type: 'error',
          message: fyo.t`Please select at least one payment method.`,
        });
      }

      this.syncStateToParent();
      this.$emit('createTransaction', true, true);
    },

    cancelTransaction() {
      this.localEntries = [];
      this.localWriteOff = fyo.pesa(0);
      this.$emit('setPaidAmount', fyo.pesa(0));
      this.$emit('toggleModal', 'Payment');
    },
  },
});
</script>
