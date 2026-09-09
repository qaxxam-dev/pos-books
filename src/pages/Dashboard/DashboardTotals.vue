<template>
  <div class="p-4">
    <SectionHeader>
      <template #title>{{ t`Summary` }}</template>
    </SectionHeader>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
      <!-- Sales -->
      <div
        class="
          bg-white
          dark:bg-gray-850
          p-4
          rounded-lg
          shadow-sm
          border border-gray-100
          dark:border-gray-800
          flex
          items-center
        "
      >
        <div
          class="
            p-3
            rounded-full
            bg-blue-100
            text-blue-600
            dark:bg-blue-900 dark:text-blue-300
            mr-4
          "
        >
          <feather-icon name="trending-up" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {{ t`Sales` }}
          </p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">
            {{ fyo.format(sales, 'Currency') }}
          </p>
        </div>
      </div>

      <!-- Purchase -->
      <div
        class="
          bg-white
          dark:bg-gray-850
          p-4
          rounded-lg
          shadow-sm
          border border-gray-100
          dark:border-gray-800
          flex
          items-center
        "
      >
        <div
          class="
            p-3
            rounded-full
            bg-indigo-100
            text-indigo-600
            dark:bg-indigo-900 dark:text-indigo-300
            mr-4
          "
        >
          <feather-icon name="shopping-bag" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {{ t`Purchase` }}
          </p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">
            {{ fyo.format(purchase, 'Currency') }}
          </p>
        </div>
      </div>

      <!-- Expense -->
      <div
        class="
          bg-white
          dark:bg-gray-850
          p-4
          rounded-lg
          shadow-sm
          border border-gray-100
          dark:border-gray-800
          flex
          items-center
        "
      >
        <div
          class="
            p-3
            rounded-full
            bg-pink-100
            text-pink-600
            dark:bg-pink-900 dark:text-pink-300
            mr-4
          "
        >
          <feather-icon name="credit-card" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {{ t`Expense` }}
          </p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">
            {{ fyo.format(expense, 'Currency') }}
          </p>
        </div>
      </div>

      <!-- Profit -->
      <div
        class="
          bg-white
          dark:bg-gray-850
          p-4
          rounded-lg
          shadow-sm
          border border-gray-100
          dark:border-gray-800
          flex
          items-center
        "
      >
        <div
          class="
            p-3
            rounded-full
            bg-green-100
            text-green-600
            dark:bg-green-900 dark:text-green-300
            mr-4
          "
        >
          <feather-icon name="dollar-sign" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {{ t`Profit after expence & tax` }}
          </p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">
            {{ fyo.format(profit, 'Currency') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Payment Methods -->
    <div
      v-if="paymentMethodTotals.length"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4"
    >
      <div
        v-for="item in paymentMethodTotals"
        :key="item.name"
        class="
          bg-white
          dark:bg-gray-850
          p-4
          rounded-lg
          shadow-sm
          border border-gray-100
          dark:border-gray-800
          flex
          items-center
        "
      >
        <div class="p-3 rounded-full mr-4" :class="item.iconBgClass">
          <feather-icon :name="item.icon" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {{ item.name }}
          </p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">
            {{ fyo.format(item.amount, 'Currency') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ModelNameEnum } from 'models/types';
import { fyo } from 'src/initFyo';
import { getDatesAndPeriodList } from 'src/utils/misc';
import { defineComponent, PropType } from 'vue';
import SectionHeader from './SectionHeader.vue';
import { t } from 'fyo';
import { PeriodKey } from 'src/utils/types';
import { DateTime } from 'luxon';

interface PaymentMethodCard {
  name: string;
  amount: number;
  icon: string;
  iconBgClass: string;
}

interface RawPaymentItem {
  name: string;
  paymentMethod?: string;
  paymentType?: string;
  amount?: unknown;
  referenceType?: string;
  date?: string | Date;
}

export default defineComponent({
  name: 'DashboardTotals',
  components: {
    SectionHeader,
  },
  props: {
    commonPeriod: { type: String as PropType<PeriodKey>, default: 'Today' },
    commonCustomFrom: { type: String, default: '' },
    commonCustomTo: { type: String, default: '' },
  },
  emits: ['period-change'],
  data() {
    return {
      period: 'Today' as PeriodKey,
      customFrom: '',
      customTo: '',
      periodOptions: [
        'Today',
        'This Month',
        'This Quarter',
        'This Year',
        'YTD',
        'Custom',
      ] as PeriodKey[],
      sales: 0,
      purchase: 0,
      expense: 0,
      profit: 0,
      paymentMethodTotals: [] as PaymentMethodCard[],
    };
  },
  computed: {
    fyo() {
      return fyo;
    },
  },
  watch: {
    period: 'periodChange',
    customFrom: 'periodChange',
    customTo: 'periodChange',
    commonPeriod(val: PeriodKey) {
      if (!this.periodOptions.includes(val)) {
        return;
      }
      this.period = val;
    },
    commonCustomFrom(val: string) {
      this.customFrom = val;
    },
    commonCustomTo(val: string) {
      this.customTo = val;
    },
  },
  async mounted() {
    await this.setData();
  },
  async activated() {
    await this.setData();
  },
  methods: {
    t(strings: unknown, ...values: unknown[]) {
      return t(strings, ...values);
    },
    getPaymentMethodStyle(name: string, type?: string) {
      const lower = (name || '').toLowerCase();
      const typeLower = (type || '').toLowerCase();

      if (lower.includes('cash') || typeLower === 'cash') {
        return {
          icon: 'dollar-sign',
          iconBgClass:
            'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300',
        };
      }
      if (
        lower.includes('upi') ||
        lower.includes('gpay') ||
        lower.includes('phonepe') ||
        lower.includes('paytm')
      ) {
        return {
          icon: 'smartphone',
          iconBgClass:
            'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
        };
      }
      if (lower.includes('bank') || typeLower === 'bank') {
        return {
          icon: 'home',
          iconBgClass:
            'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300',
        };
      }
      if (
        lower.includes('transfer') ||
        lower.includes('neft') ||
        lower.includes('rtgs') ||
        lower.includes('wire')
      ) {
        return {
          icon: 'repeat',
          iconBgClass:
            'bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-300',
        };
      }
      if (
        lower.includes('card') ||
        lower.includes('credit') ||
        lower.includes('debit') ||
        lower.includes('pos')
      ) {
        return {
          icon: 'credit-card',
          iconBgClass:
            'bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-300',
        };
      }
      if (lower.includes('cheque') || lower.includes('check')) {
        return {
          icon: 'file-text',
          iconBgClass:
            'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
        };
      }
      return {
        icon: 'credit-card',
        iconBgClass:
          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      };
    },
    parseDateToMillis(val: unknown): number | null {
      if (!val) return null;
      if (val instanceof Date) return val.getTime();
      if (typeof val === 'string') {
        if (val.length === 10 && val.includes('-')) {
          const dt = DateTime.fromISO(val);
          if (dt.isValid) return dt.startOf('day').toMillis();
        }
        const dt = DateTime.fromISO(val);
        if (dt.isValid) return dt.toMillis();
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.getTime();
      }
      return null;
    },
    parseMoneyToFloat(val: unknown): number {
      if (val == null) return 0;
      if (typeof val === 'number') return val;
      if (
        typeof val === 'object' &&
        'float' in (val as Record<string, unknown>)
      ) {
        return Number((val as { float: number }).float) || 0;
      }
      if (typeof val === 'string') {
        return parseFloat(val) || 0;
      }
      return 0;
    },
    async periodChange() {
      this.$emit('period-change', this.period, this.customFrom, this.customTo);
      await this.setData();
    },
    async setData() {
      const { fromDate, toDate } = getDatesAndPeriodList(
        this.period,
        this.customFrom,
        this.customTo
      );

      const fromIso = fromDate.toISO();
      const toIso = toDate.toISO();

      // Get Sales
      const salesData = await fyo.db.getTotalOutstanding(
        ModelNameEnum.SalesInvoice,
        fromIso,
        toIso
      );
      this.sales = salesData.total ?? 0;

      // Get Purchases
      const purchaseData = await fyo.db.getTotalOutstanding(
        ModelNameEnum.PurchaseInvoice,
        fromIso,
        toIso
      );
      this.purchase = purchaseData.total ?? 0;

      // Get Income & Expenses
      const data = await fyo.db.getIncomeAndExpenses(fromIso, toIso);
      this.expense = data.expense.reduce((sum, d) => sum + d.balance, 0);
      const totalIncome = data.income.reduce((sum, d) => sum + d.balance, 0);

      const cogsList = (data as { cogs?: { balance: number }[] }).cogs || [];
      const cogs = cogsList.reduce((sum: number, d) => sum + d.balance, 0);

      this.profit = totalIncome - this.expense - cogs;

      // Get Payment Method Totals
      try {
        const paymentMethods = (await fyo.db.getAll(
          ModelNameEnum.PaymentMethod,
          {
            fields: ['name', 'type'],
          }
        )) as Array<{ name: string; type?: string }>;

        const payments = (await fyo.db.getAll(ModelNameEnum.Payment, {
          fields: [
            'name',
            'paymentMethod',
            'paymentType',
            'amount',
            'referenceType',
            'date',
            'submitted',
            'cancelled',
          ],
          filters: {
            submitted: true,
            cancelled: false,
          },
        })) as RawPaymentItem[];

        const fromMillis = fromDate.startOf('day').toMillis();
        const toMillis = toDate.endOf('day').toMillis();

        const methodMap: Record<string, { type?: string; amount: number }> = {};
        for (const pm of paymentMethods) {
          if (pm.name) {
            methodMap[pm.name] = { type: pm.type, amount: 0 };
          }
        }

        for (const p of payments) {
          if (!p.paymentMethod) continue;
          const pMillis = this.parseDateToMillis(p.date);
          if (pMillis === null) continue;
          if (pMillis < fromMillis || pMillis > toMillis) continue;

          const numAmount = this.parseMoneyToFloat(p.amount);

          if (!methodMap[p.paymentMethod]) {
            methodMap[p.paymentMethod] = { amount: 0 };
          }

          if (p.paymentType === 'Receive') {
            methodMap[p.paymentMethod].amount += numAmount;
          } else if (
            p.paymentType === 'Pay' &&
            p.referenceType === ModelNameEnum.SalesInvoice
          ) {
            methodMap[p.paymentMethod].amount -= numAmount;
          }
        }

        this.paymentMethodTotals = Object.entries(methodMap).map(
          ([name, val]) => {
            const style = this.getPaymentMethodStyle(name, val.type);
            return {
              name,
              amount: val.amount,
              icon: style.icon,
              iconBgClass: style.iconBgClass,
            };
          }
        );
      } catch {
        this.paymentMethodTotals = [];
      }
    },
  },
});
</script>
