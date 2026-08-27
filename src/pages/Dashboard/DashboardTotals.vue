<template>
  <div class="p-4">
    <SectionHeader>
      <template #title>{{ t`Summary` }}</template>
    </SectionHeader>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
      <!-- Sales -->
      <div class="bg-white dark:bg-gray-850 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 flex items-center">
        <div class="p-3 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 mr-4">
          <feather-icon name="trending-up" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">{{ t`Sales` }}</p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">{{ fyo.format(sales, 'Currency') }}</p>
        </div>
      </div>

      <!-- Purchase -->
      <div class="bg-white dark:bg-gray-850 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 flex items-center">
        <div class="p-3 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300 mr-4">
          <feather-icon name="shopping-bag" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">{{ t`Purchase` }}</p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">{{ fyo.format(purchase, 'Currency') }}</p>
        </div>
      </div>

      <!-- Expense -->
      <div class="bg-white dark:bg-gray-850 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 flex items-center">
        <div class="p-3 rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300 mr-4">
          <feather-icon name="credit-card" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">{{ t`Expense` }}</p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">{{ fyo.format(expense, 'Currency') }}</p>
        </div>
      </div>

      <!-- Profit -->
      <div class="bg-white dark:bg-gray-850 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 flex items-center">
        <div class="p-3 rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300 mr-4">
          <feather-icon name="dollar-sign" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">{{ t`Profit after expence & tax` }}</p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">{{ fyo.format(profit, 'Currency') }}</p>
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
    };
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
  computed: {
    fyo() {
      return fyo;
    },
  },
  methods: {
    t(strings: any, ...values: any[]) {
      return t(strings, ...values);
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
      
      const cogsList = (data as any).cogs || [];
      const cogs = cogsList.reduce((sum: number, d: any) => sum + d.balance, 0);
      
      this.profit = totalIncome - this.expense - cogs;
    },
  },
  async activated() {
    await this.setData();
  },
});
</script>
