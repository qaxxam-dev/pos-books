<script lang="ts">
import { PeriodKey } from 'src/utils/types';
import { PropType } from 'vue';
import { defineComponent } from 'vue';

export default defineComponent({
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
  methods: {
    async periodChange() {
      this.$emit('period-change', this.period, this.customFrom, this.customTo);
      await this.setData();
    },
    async setData() {
      return Promise.resolve(null);
    },
  },
});
</script>
