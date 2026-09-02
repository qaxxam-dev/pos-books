<template>
  <div class="h-screen flex flex-col" style="width: var(--w-desk)">
    <PageHeader :title="t`Daybook (Daily Log)`">
      <div
        class="
          border
          dark:border-gray-900
          rounded
          bg-gray-50
          dark:bg-gray-890
          focus-within:bg-gray-100
          dark:focus-within:bg-gray-900
          flex
          items-center
        "
      >
        <PeriodSelector
          class="px-3"
          :value="period"
          :options="['Today', 'This Month', 'This Quarter', 'This Year', 'YTD', 'Custom']"
          @change="(value) => (period = value)"
          @change-custom="handleCustomDateChange"
        />
      </div>
    </PageHeader>

    <div
      class="no-scrollbar overflow-auto dark:bg-gray-875 p-4 flex-1"
      style="height: calc(100vh - var(--h-row-largest) - 1px)"
    >
      <div v-if="loading" class="flex justify-center p-8">
        <feather-icon name="loader" class="w-8 h-8 animate-spin text-gray-400" />
      </div>
      <div v-else-if="!entries.length" class="text-center p-8 text-gray-500">
        {{ t`No transactions found for this period.` }}
      </div>
      <div v-else class="max-w-4xl mx-auto space-y-4 pb-12">
        <div 
          v-for="(entry, index) in displayedEntries" 
          :key="index"
          class="bg-white dark:bg-gray-850 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md cursor-pointer transition-shadow"
          @click="openDoc(entry)"
        >
          <div class="flex justify-between items-start">
            <div class="flex items-start space-x-3">
              <div 
                class="p-2 rounded-full mt-1 flex-shrink-0"
                :class="entry.badgeClass"
              >
                <feather-icon :name="entry.icon" class="w-5 h-5" />
              </div>
              <div>
                <div class="flex items-center space-x-2">
                  <span 
                    class="text-xs px-2 py-0.5 rounded font-medium"
                    :class="entry.badgeTextClass"
                  >{{ entry.typeLabel }}</span>
                </div>
                <p class="mt-1 text-gray-900 dark:text-white font-medium text-base">
                  {{ entry.description }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {{ entry.docId }} <span v-if="entry.party">&bull; {{ entry.party }}</span>
                </p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-1 font-medium">{{ entry.timeFormatted }}</p>
              <p v-if="entry.amount > 0" class="text-lg font-bold" :class="entry.amountClass">
                {{ fyo.format(entry.amount, 'Currency') }}
              </p>
            </div>
          </div>
        </div>
        
        <div v-if="displayedEntries.length < entries.length" class="text-center pt-4 pb-8">
          <button @click="loadMore" class="px-6 py-2 text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {{ t`Load More` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { fyo } from 'src/initFyo';
import { ModelNameEnum } from 'models/types';
import PageHeader from 'src/components/PageHeader.vue';
import PeriodSelector from 'src/pages/Dashboard/PeriodSelector.vue';
import { getDatesAndPeriodList } from 'src/utils/misc';
import { getFormRoute, routeTo } from 'src/utils/ui';
import { t } from 'fyo';
import { DateTime } from 'luxon';
import { PeriodKey } from 'src/utils/types';

interface DaybookEntry {
  timestamp: string;
  timeFormatted: string;
  type: string;
  typeLabel: string;
  description: string;
  amount: number;
  docId: string;
  schemaName: string;
  party: string;
  icon: string;
  badgeClass: string;
  badgeTextClass: string;
  amountClass: string;
}

export default defineComponent({
  name: 'Daybook',
  components: {
    PageHeader,
    PeriodSelector,
  },
  data() {
    return {
      period: 'Today' as PeriodKey,
      customFrom: '',
      customTo: '',
      loading: false,
      entries: [] as DaybookEntry[],
      displayedEntries: [] as DaybookEntry[],
      currentPage: 1,
      pageSize: 50,
    };
  },
  computed: {
    fyo() {
      return fyo;
    },
  },
  watch: {
    period: 'fetchData',
    customFrom: 'fetchData',
    customTo: 'fetchData',
  },
  methods: {
    t(strings: any, ...values: any[]) {
      return t(strings, ...values);
    },
    handleCustomDateChange(from: string, to: string) {
      this.customFrom = from;
      this.customTo = to;
    },
    async openDoc(entry: DaybookEntry) {
      const route = getFormRoute(entry.schemaName, entry.docId);
      await routeTo(route);
    },
    loadMore() {
      this.currentPage++;
      this.updateDisplayedEntries();
    },
    updateDisplayedEntries() {
      const end = this.currentPage * this.pageSize;
      this.displayedEntries = this.entries.slice(0, end);
    },
    async fetchData() {
      this.loading = true;
      try {
        const { fromDate, toDate } = getDatesAndPeriodList(
          this.period,
          this.customFrom,
          this.customTo
        );
        
        const fromIso = fromDate.startOf('day').toISO();
        const toIso = toDate.endOf('day').toISO();

        const allEntries: DaybookEntry[] = [];
        
        const filters = {
          submitted: true
        };

        const yieldThread = () => new Promise(resolve => setTimeout(resolve, 0));

        const parseDocDate = (doc: any) => {
          let dt = doc.date || doc.creation;
          if (!dt) return new Date();
          let jsDate = dt instanceof Date ? dt : new Date(dt);
          if (isNaN(jsDate.getTime())) jsDate = new Date();
          return jsDate;
        };

        // Sales Invoices
        const sales = await fyo.db.getAll(ModelNameEnum.SalesInvoice, {
          fields: ['*'],
          filters
        });
        for (let i = 0; i < sales.length; i++) {
          if (i % 50 === 0) await yieldThread();
          const doc = sales[i];
          const dt = parseDocDate(doc);
          const iso = dt.toISOString();
          if (iso < fromIso || iso > toIso) continue;
          
          allEntries.push({
            timestamp: dt.toISOString(),
            timeFormatted: DateTime.fromJSDate(dt).toFormat('t'),
            type: 'Sale',
            typeLabel: t`Sale`,
            description: t`Sale to ${(doc.party as string) || 'Customer'}`,
            amount: doc.grandTotal as number,
            docId: doc.name as string,
            schemaName: ModelNameEnum.SalesInvoice,
            party: doc.party as string,
            icon: 'trending-up',
            badgeClass: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
            badgeTextClass: 'bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-400',
            amountClass: 'text-green-600 dark:text-green-400'
          });
        }
        
        // Purchase Invoices
        const purchases = await fyo.db.getAll(ModelNameEnum.PurchaseInvoice, {
          fields: ['*'],
          filters
        });
        for (let i = 0; i < purchases.length; i++) {
          if (i % 50 === 0) await yieldThread();
          const doc = purchases[i];
          const dt = parseDocDate(doc);
          const iso = dt.toISOString();
          if (iso < fromIso || iso > toIso) continue;

          allEntries.push({
            timestamp: dt.toISOString(),
            timeFormatted: DateTime.fromJSDate(dt).toFormat('t'),
            type: 'Purchase',
            typeLabel: t`Purchase`,
            description: t`Purchase from ${(doc.party as string) || 'Supplier'}`,
            amount: doc.grandTotal as number,
            docId: doc.name as string,
            schemaName: ModelNameEnum.PurchaseInvoice,
            party: doc.party as string,
            icon: 'shopping-bag',
            badgeClass: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300',
            badgeTextClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400',
            amountClass: 'text-indigo-600 dark:text-indigo-400'
          });
        }

        // Payments
        const payments = await fyo.db.getAll(ModelNameEnum.Payment, {
          fields: ['*'],
          filters
        });
        for (let i = 0; i < payments.length; i++) {
          if (i % 50 === 0) await yieldThread();
          let doc = payments[i];
          const dt = parseDocDate(doc);
          const iso = dt.toISOString();
          if (iso < fromIso || iso > toIso) continue;

          if (!doc.paymentType) {
            // Re-fetch to compute formulas if missing from db
            const fullDoc = await fyo.doc.getDoc(ModelNameEnum.Payment, doc.name as string);
            if (fullDoc) doc = fullDoc as any;
          }

          const isReceive = doc.paymentType === 'Receive';
          
          let computedAmount = doc.amount;
          if (doc.writeoff && (doc.amount as any)?.sub) {
            computedAmount = (doc.amount as any).sub(doc.writeoff);
          } else if (doc.writeoff && typeof doc.amount === 'number') {
            computedAmount = doc.amount - (doc.writeoff as number);
          }

          allEntries.push({
            timestamp: dt.toISOString(),
            timeFormatted: DateTime.fromJSDate(dt).toFormat('t'),
            type: isReceive ? 'Payment Received' : 'Payment Paid',
            typeLabel: isReceive ? t`Received` : t`Paid`,
            description: isReceive ? t`Received payment from ${(doc.party as string) || 'Customer'}` : t`Paid to ${(doc.party as string) || 'Supplier'}`,
            amount: (computedAmount || (doc as any).amountPaid || 0) as number,
            docId: doc.name as string,
            schemaName: ModelNameEnum.Payment,
            party: doc.party as string,
            icon: isReceive ? 'arrow-down-left' : 'arrow-up-right',
            badgeClass: isReceive ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
            badgeTextClass: isReceive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' : 'bg-orange-50 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
            amountClass: isReceive ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
          });
        }

        // Journal Entries
        const journals = await fyo.db.getAll(ModelNameEnum.JournalEntry, {
          fields: ['*'],
          filters
        });
        for (let i = 0; i < journals.length; i++) {
          if (i % 50 === 0) await yieldThread();
          const doc = journals[i];
          const dt = parseDocDate(doc);
          const iso = dt.toISOString();
          if (iso < fromIso || iso > toIso) continue;

          allEntries.push({
            timestamp: dt.toISOString(),
            timeFormatted: DateTime.fromJSDate(dt).toFormat('t'),
            type: 'Journal',
            typeLabel: t`Expense / Adj`,
            description: (doc as any).userRemark ? ((doc as any).userRemark as string) : t`Journal Entry`,
            amount: 0,
            docId: doc.name as string,
            schemaName: ModelNameEnum.JournalEntry,
            party: '',
            icon: 'file-text',
            badgeClass: 'bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300',
            badgeTextClass: 'bg-pink-50 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400',
            amountClass: 'text-gray-900 dark:text-white'
          });
        }

        // Stock Movements
        const stockMovements = await fyo.db.getAll(ModelNameEnum.StockMovement, {
          fields: ['*'],
          filters
        });
        for (let i = 0; i < stockMovements.length; i++) {
          if (i % 50 === 0) await yieldThread();
          const doc = stockMovements[i];
          const dt = parseDocDate(doc);
          const iso = dt.toISOString();
          if (iso < fromIso || iso > toIso) continue;

          allEntries.push({
            timestamp: dt.toISOString(),
            timeFormatted: DateTime.fromJSDate(dt).toFormat('t'),
            type: 'Stock',
            typeLabel: t`Stock`,
            description: t`Stock Movement: ${(doc.movementType as string) || 'Adjustment'}`,
            amount: (doc.amount || 0) as number,
            docId: doc.name as string,
            schemaName: ModelNameEnum.StockMovement,
            party: '',
            icon: 'box',
            badgeClass: 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300',
            badgeTextClass: 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
            amountClass: 'text-gray-400'
          });
        }

        // Sort by timestamp descending
        this.entries = allEntries.sort((a, b) => {
          const timeA = DateTime.fromISO(a.timestamp).toMillis();
          const timeB = DateTime.fromISO(b.timestamp).toMillis();
          return timeB - timeA;
        });

        this.currentPage = 1;
        this.updateDisplayedEntries();

      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
    }
  },
  mounted() {
    this.fetchData();
  }
});
</script>
