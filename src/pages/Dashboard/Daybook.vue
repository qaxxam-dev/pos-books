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
          :options="[
            'Today',
            'This Month',
            'This Quarter',
            'This Year',
            'YTD',
            'Custom',
          ]"
          @change="(value) => (period = value)"
          @change-custom="handleCustomDateChange"
        />
      </div>
    </PageHeader>

    <!-- Transaction Type Filter Tabs -->
    <div
      class="
        px-4
        py-2
        border-b border-gray-200
        dark:border-gray-800
        bg-white
        dark:bg-gray-850
        flex
        items-center
        space-x-2
        overflow-x-auto
        no-scrollbar
        flex-shrink-0
      "
    >
      <button
        v-for="tab in filterTabs"
        :key="tab.key"
        class="
          px-3
          py-1.5
          text-xs
          font-medium
          rounded-full
          transition-colors
          flex
          items-center
          space-x-1.5
          whitespace-nowrap
        "
        :class="
          activeFilter === tab.key
            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
        "
        @click="setFilter(tab.key)"
      >
        <span>{{ tab.label }}</span>
        <span
          class="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
          :class="
            activeFilter === tab.key
              ? 'bg-white/20 dark:bg-black/20 text-white dark:text-gray-900'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          "
        >
          {{ counts[tab.key] || 0 }}
        </span>
      </button>
    </div>

    <div
      class="no-scrollbar overflow-auto dark:bg-gray-875 p-4 flex-1"
      style="height: calc(100vh - var(--h-row-largest) - 49px)"
    >
      <div v-if="loading" class="flex justify-center p-8">
        <feather-icon
          name="loader"
          class="w-8 h-8 animate-spin text-gray-400"
        />
      </div>
      <div
        v-else-if="!filteredEntries.length"
        class="text-center p-8 text-gray-500"
      >
        {{
          activeFilter === 'All'
            ? t`No transactions found for this period.`
            : t`No ${activeFilterLabel} transactions found for this period.`
        }}
      </div>
      <div v-else class="max-w-4xl mx-auto space-y-4 pb-12">
        <div
          v-for="(entry, index) in displayedEntries"
          :key="index"
          class="
            bg-white
            dark:bg-gray-850
            p-4
            rounded-lg
            shadow-sm
            border border-gray-100
            dark:border-gray-800
            hover:shadow-md
            cursor-pointer
            transition-shadow
          "
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
                    >{{ entry.typeLabel }}</span
                  >
                </div>
                <p
                  class="
                    mt-1
                    text-gray-900
                    dark:text-white
                    font-medium
                    text-base
                  "
                >
                  {{ entry.description }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {{ entry.docId }}
                  <span v-if="entry.party">&bull; {{ entry.party }}</span>
                </p>
              </div>
            </div>
            <div class="text-right">
              <p
                class="
                  text-sm text-gray-500
                  dark:text-gray-400
                  mb-1
                  font-medium
                "
              >
                {{ entry.timeFormatted }}
              </p>
              <p
                v-if="entry.amount > 0"
                class="text-lg font-bold"
                :class="entry.amountClass"
              >
                {{ fyo.format(entry.amount, 'Currency') }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="displayedEntries.length < filteredEntries.length"
          class="text-center pt-4 pb-8"
        >
          <button
            class="
              px-6
              py-2
              text-sm
              font-medium
              bg-gray-100
              text-gray-700
              dark:bg-gray-800 dark:text-gray-300
              rounded
              hover:bg-gray-200
              dark:hover:bg-gray-700
              transition-colors
            "
            @click="loadMore"
          >
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
      activeFilter: 'All',
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
    filterTabs() {
      return [
        { key: 'All', label: t`All` },
        { key: 'Sale', label: t`Sales` },
        { key: 'Purchase', label: t`Purchases` },
        { key: 'Payment', label: t`Payments` },
        { key: 'Journal', label: t`Journals` },
        { key: 'Stock', label: t`Stock` },
      ];
    },
    activeFilterLabel(): string {
      const currentTab = this.filterTabs.find(
        (t) => t.key === this.activeFilter
      );
      return currentTab ? currentTab.label : '';
    },
    counts(): Record<string, number> {
      const c: Record<string, number> = {
        All: this.entries.length,
        Sale: 0,
        Purchase: 0,
        Payment: 0,
        Journal: 0,
        Stock: 0,
      };
      for (const e of this.entries) {
        if (e.type === 'Sale') c.Sale++;
        else if (e.type === 'Purchase') c.Purchase++;
        else if (e.type === 'Payment' || e.type.startsWith('Payment'))
          c.Payment++;
        else if (e.type === 'Journal') c.Journal++;
        else if (e.type === 'Stock') c.Stock++;
      }
      return c;
    },
    filteredEntries(): DaybookEntry[] {
      if (this.activeFilter === 'All') return this.entries;
      return this.entries.filter((e) => {
        if (this.activeFilter === 'Payment') {
          return e.type === 'Payment' || e.type.startsWith('Payment');
        }
        return e.type === this.activeFilter;
      });
    },
  },
  watch: {
    period: 'fetchData',
    customFrom: 'fetchData',
    customTo: 'fetchData',
  },
  methods: {
    t(strings: any, ...values: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
    setFilter(filter: string) {
      this.activeFilter = filter;
      this.currentPage = 1;
      this.updateDisplayedEntries();
    },
    loadMore() {
      this.currentPage++;
      this.updateDisplayedEntries();
    },
    updateDisplayedEntries() {
      const end = this.currentPage * this.pageSize;
      this.displayedEntries = this.filteredEntries.slice(0, end);
    },
    async fetchData() {
      this.loading = true;
      try {
        const { fromDate, toDate } = getDatesAndPeriodList(
          this.period,
          this.customFrom,
          this.customTo
        );

        const fromMillis = fromDate.startOf('day').toMillis();
        const toMillis = toDate.endOf('day').toMillis();

        const allEntries: DaybookEntry[] = [];

        const filters = {
          submitted: true,
        };

        const yieldThread = () =>
          new Promise((resolve) => setTimeout(resolve, 0));

        const parseDocDates = (doc: any) => {
          let rawDate = doc.date;
          let rawCreated = doc.created || doc.creation;

          let postingDt: DateTime | null = null;
          if (rawDate instanceof Date) {
            postingDt = DateTime.fromJSDate(rawDate);
          } else if (typeof rawDate === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
              postingDt = DateTime.fromISO(rawDate).startOf('day');
            } else {
              postingDt = DateTime.fromISO(rawDate);
            }
          }

          let createdDt: DateTime | null = null;
          if (rawCreated instanceof Date) {
            createdDt = DateTime.fromJSDate(rawCreated);
          } else if (typeof rawCreated === 'string') {
            createdDt = DateTime.fromISO(rawCreated);
          }

          if (!postingDt && createdDt) {
            postingDt = createdDt;
          } else if (!postingDt) {
            postingDt = DateTime.now();
          }

          return { postingDt, createdDt };
        };

        // 1. Sales Invoices
        const sales = await fyo.db.getAll(ModelNameEnum.SalesInvoice, {
          fields: ['*'],
          filters,
        });
        for (let i = 0; i < sales.length; i++) {
          if (i % 50 === 0) await yieldThread();
          const doc = sales[i];
          const { postingDt, createdDt } = parseDocDates(doc);
          const docMillis = postingDt.toMillis();
          if (docMillis < fromMillis || docMillis > toMillis) continue;

          const timeFormatted =
            postingDt.hour !== 0 || postingDt.minute !== 0
              ? postingDt.toFormat('t')
              : createdDt
              ? createdDt.toFormat('t')
              : postingDt.toFormat('t');

          allEntries.push({
            timestamp: (createdDt || postingDt).toISO(),
            timeFormatted,
            type: 'Sale',
            typeLabel: t`Sale`,
            description: t`Sale to ${(doc.party as string) || 'Customer'}`,
            amount: doc.grandTotal as number,
            docId: doc.name as string,
            schemaName: ModelNameEnum.SalesInvoice,
            party: doc.party as string,
            icon: 'trending-up',
            badgeClass:
              'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
            badgeTextClass:
              'bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-400',
            amountClass: 'text-green-600 dark:text-green-400',
          });
        }

        // 2. Purchase Invoices
        const purchases = await fyo.db.getAll(ModelNameEnum.PurchaseInvoice, {
          fields: ['*'],
          filters,
        });
        for (let i = 0; i < purchases.length; i++) {
          if (i % 50 === 0) await yieldThread();
          const doc = purchases[i];
          const { postingDt, createdDt } = parseDocDates(doc);
          const docMillis = postingDt.toMillis();
          if (docMillis < fromMillis || docMillis > toMillis) continue;

          const timeFormatted =
            postingDt.hour !== 0 || postingDt.minute !== 0
              ? postingDt.toFormat('t')
              : createdDt
              ? createdDt.toFormat('t')
              : postingDt.toFormat('t');

          allEntries.push({
            timestamp: (createdDt || postingDt).toISO(),
            timeFormatted,
            type: 'Purchase',
            typeLabel: t`Purchase`,
            description: t`Purchase from ${
              (doc.party as string) || 'Supplier'
            }`,
            amount: doc.grandTotal as number,
            docId: doc.name as string,
            schemaName: ModelNameEnum.PurchaseInvoice,
            party: doc.party as string,
            icon: 'shopping-bag',
            badgeClass:
              'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300',
            badgeTextClass:
              'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400',
            amountClass: 'text-indigo-600 dark:text-indigo-400',
          });
        }

        // 3. Payments
        const payments = await fyo.db.getAll(ModelNameEnum.Payment, {
          fields: ['*'],
          filters,
        });
        for (let i = 0; i < payments.length; i++) {
          if (i % 50 === 0) await yieldThread();
          let doc = payments[i];
          const { postingDt, createdDt } = parseDocDates(doc);
          const docMillis = postingDt.toMillis();
          if (docMillis < fromMillis || docMillis > toMillis) continue;

          if (!doc.paymentType) {
            const fullDoc = await fyo.doc.getDoc(
              ModelNameEnum.Payment,
              doc.name as string
            );
            if (fullDoc) doc = fullDoc as any;
          }

          const isReceive = doc.paymentType === 'Receive';

          let computedAmount = doc.amount;
          if (doc.writeoff && (doc.amount as any)?.sub) {
            computedAmount = (doc.amount as any).sub(doc.writeoff);
          } else if (doc.writeoff && typeof doc.amount === 'number') {
            computedAmount = doc.amount - (doc.writeoff as number);
          }

          const timeFormatted =
            postingDt.hour !== 0 || postingDt.minute !== 0
              ? postingDt.toFormat('t')
              : createdDt
              ? createdDt.toFormat('t')
              : postingDt.toFormat('t');

          allEntries.push({
            timestamp: (createdDt || postingDt).toISO(),
            timeFormatted,
            type: isReceive ? 'Payment Received' : 'Payment Paid',
            typeLabel: isReceive ? t`Received` : t`Paid`,
            description: isReceive
              ? t`Received payment from ${(doc.party as string) || 'Customer'}`
              : t`Paid to ${(doc.party as string) || 'Supplier'}`,
            amount: (computedAmount || (doc as any).amountPaid || 0) as number,
            docId: doc.name as string,
            schemaName: ModelNameEnum.Payment,
            party: doc.party as string,
            icon: isReceive ? 'arrow-down-left' : 'arrow-up-right',
            badgeClass: isReceive
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
            badgeTextClass: isReceive
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
              : 'bg-orange-50 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
            amountClass: isReceive
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-orange-600 dark:text-orange-400',
          });
        }

        // 4. Journal Entries
        const journals = await fyo.db.getAll(ModelNameEnum.JournalEntry, {
          fields: ['*'],
          filters,
        });

        const matchingJournals: {
          doc: any;
          postingDt: DateTime;
          createdDt: DateTime | null;
        }[] = [];
        for (let i = 0; i < journals.length; i++) {
          const doc = journals[i];
          const { postingDt, createdDt } = parseDocDates(doc);
          const docMillis = postingDt.toMillis();
          if (docMillis >= fromMillis && docMillis <= toMillis) {
            matchingJournals.push({ doc, postingDt, createdDt });
          }
        }

        // Fetch accounts for all matching journal entries
        const accountsByParent: Record<string, any[]> = {};
        if (matchingJournals.length > 0) {
          const journalNames = matchingJournals.map(
            (j) => j.doc.name as string
          );
          try {
            const accounts = await fyo.db.getAll(
              ModelNameEnum.JournalEntryAccount,
              {
                fields: ['*'],
                filters: {
                  parent: ['in', journalNames],
                },
              }
            );
            for (const acc of accounts) {
              const parent = acc.parent as string;
              if (!accountsByParent[parent]) {
                accountsByParent[parent] = [];
              }
              accountsByParent[parent].push(acc);
            }
          } catch (err) {
            console.error('Error fetching JournalEntryAccount:', err);
          }
        }

        const formatAccList = (list: string[]) => {
          if (list.length === 0) return '';
          if (list.length <= 2) return list.join(', ');
          return `${list.slice(0, 2).join(', ')} (+${list.length - 2} more)`;
        };

        for (let i = 0; i < matchingJournals.length; i++) {
          if (i % 50 === 0) await yieldThread();
          const { doc, postingDt, createdDt } = matchingJournals[i];
          const docAccounts = accountsByParent[doc.name as string] || [];

          let totalDebit = 0;
          const debitAccounts: string[] = [];
          const creditAccounts: string[] = [];

          for (const row of docAccounts) {
            const rawDebit: any = row.debit;
            const dr =
              typeof rawDebit === 'number'
                ? rawDebit
                : rawDebit &&
                  typeof rawDebit === 'object' &&
                  'store' in rawDebit
                ? parseFloat(String(rawDebit.store))
                : parseFloat(String(rawDebit)) || 0;

            const rawCredit: any = row.credit;
            const cr =
              typeof rawCredit === 'number'
                ? rawCredit
                : rawCredit &&
                  typeof rawCredit === 'object' &&
                  'store' in rawCredit
                ? parseFloat(String(rawCredit.store))
                : parseFloat(String(rawCredit)) || 0;

            if (dr > 0) {
              totalDebit += dr;
              if (row.account && !debitAccounts.includes(String(row.account))) {
                debitAccounts.push(String(row.account));
              }
            }
            if (cr > 0) {
              if (
                row.account &&
                !creditAccounts.includes(String(row.account))
              ) {
                creditAccounts.push(String(row.account));
              }
            }
          }

          // Build account flow description
          const drText = formatAccList(debitAccounts);
          const crText = formatAccList(creditAccounts);
          const userRemark = doc.userRemark ? String(doc.userRemark) : '';
          let description = '';
          if (drText && crText) {
            description = `${drText} → ${crText}`;
          } else if (drText || crText) {
            description = drText || crText;
          } else if (userRemark) {
            description = userRemark;
          } else {
            description = (doc.entryType as string) || t`Journal Entry`;
          }

          const partyRemark = userRemark;

          const isSameDay =
            createdDt && postingDt.toISODate() === createdDt.toISODate();
          const timeFormatted =
            isSameDay && createdDt
              ? createdDt.toFormat('t')
              : postingDt.toFormat('LLL dd');

          const sortTimestamp =
            isSameDay && createdDt
              ? createdDt.toISO()
              : postingDt.endOf('day').toISO();

          allEntries.push({
            timestamp: sortTimestamp,
            timeFormatted,
            type: 'Journal',
            typeLabel: (doc.entryType as string) || t`Journal Entry`,
            description,
            amount: totalDebit,
            docId: doc.name as string,
            schemaName: ModelNameEnum.JournalEntry,
            party: partyRemark,
            icon: 'file-text',
            badgeClass:
              'bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300',
            badgeTextClass:
              'bg-pink-50 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400',
            amountClass: 'text-gray-900 dark:text-white',
          });
        }

        // 5. Stock Movements
        const stockMovements = await fyo.db.getAll(
          ModelNameEnum.StockMovement,
          {
            fields: ['*'],
            filters,
          }
        );
        for (let i = 0; i < stockMovements.length; i++) {
          if (i % 50 === 0) await yieldThread();
          const doc = stockMovements[i];
          const { postingDt, createdDt } = parseDocDates(doc);
          const docMillis = postingDt.toMillis();
          if (docMillis < fromMillis || docMillis > toMillis) continue;

          const timeFormatted =
            postingDt.hour !== 0 || postingDt.minute !== 0
              ? postingDt.toFormat('t')
              : createdDt
              ? createdDt.toFormat('t')
              : postingDt.toFormat('t');

          allEntries.push({
            timestamp: (createdDt || postingDt).toISO(),
            timeFormatted,
            type: 'Stock',
            typeLabel: t`Stock`,
            description: t`Stock Movement: ${
              (doc.movementType as string) || 'Adjustment'
            }`,
            amount: (doc.amount || 0) as number,
            docId: doc.name as string,
            schemaName: ModelNameEnum.StockMovement,
            party: '',
            icon: 'box',
            badgeClass:
              'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300',
            badgeTextClass:
              'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
            amountClass: 'text-gray-400',
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
    },
  },
  mounted() {
    this.fetchData();
  },
});
</script>
