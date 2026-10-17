<script>
import { t } from 'fyo';
import Badge from 'src/components/Badge.vue';
import { fyo } from 'src/initFyo';
import { fuzzyMatch } from 'src/utils';
import { getCreateFiltersFromListViewFilters } from 'src/utils/misc';
import { markRaw } from 'vue';
import AutoComplete from './AutoComplete.vue';

export default {
  name: 'MultiLabelLink',
  extends: AutoComplete,
  data() {
    return { results: [] };
  },
  watch: {
    value: {
      immediate: true,
      handler(newValue) {
        this.setLinkValue(newValue);
      },
    },
  },
  props: {
    thirdLink: String,
    showSecondaryLink: {
      type: Boolean,
      default: false,
    },
    secondaryLink: String,
    showClearButton: {
      type: Boolean,
      default: false,
    },
  },
  mounted() {
    if (this.value) {
      this.setLinkValue();
    }
  },
  methods: {
    async setLinkValue(newValue, isInput) {
      if (isInput) {
        return (this.linkValue = newValue || '');
      }

      const value = newValue ?? this.value;
      if (!value) {
        return (this.linkValue = '');
      }

      const schemaName = this.getTargetSchemaName();
      if (schemaName === 'Party' || this.secondaryLink === 'phone') {
        const party = await fyo.db.getAll('Party', {
          filters: { name: value },
          fields: ['name', 'phone'],
          limit: 1,
        });
        if (party && party[0]) {
          const p = party[0];
          if (p.phone && p.name && p.name !== p.phone) {
            return (this.linkValue = `${p.name} (${p.phone})`);
          }
          return (this.linkValue = p.phone || p.name);
        }
      }

      const { fieldname, target } = this.df ?? {};
      const linkDisplayField = fyo.schemaMap[target ?? '']?.linkDisplayField;

      if (!linkDisplayField) {
        return (this.linkValue = value);
      }

      const linkDoc = await this.doc?.loadAndGetLink(fieldname);
      this.linkValue = linkDoc?.get(linkDisplayField) ?? '';
    },
    getTargetSchemaName() {
      return this.df?.target;
    },
    async getOptions() {
      const schemaName = this.getTargetSchemaName();

      if (!schemaName) {
        return [];
      }

      if (this.results?.length) {
        return this.results;
      }

      const schema = fyo.schemaMap[schemaName];
      const filters = await this.getFilters();

      const fields = [
        ...new Set([
          'name',
          this.secondaryLink,
          schema.titleField,
          this.df.groupBy,
        ]),
      ].filter(Boolean);

      const results = await fyo.db.getAll(schemaName, {
        filters,
        fields,
      });

      return (this.results = results
        .map((r) => {
          let label = r[schema.titleField];
          const phone = r[this.secondaryLink] || r.phone;
          const name = r[schema.titleField] || r.name;

          if (schemaName === 'Party' || this.secondaryLink === 'phone') {
            if (phone && name && name !== phone) {
              label = `${name} (${phone})`;
            } else {
              label = phone || name;
            }
          } else if (r[this.secondaryLink] && this.showSecondaryLink) {
            label = `${r[schema.titleField]}  ` + `  ${r[this.secondaryLink]}`;
          }

          const option = {
            label,
            value: r.name,
            value2: r[this.secondaryLink],
          };

          if (this.df.groupBy) {
            option.group = r[this.df.groupBy];
          }
          return option;
        })
        .filter(Boolean));
    },
    async getSuggestions(keyword = '') {
      let options = await this.getOptions();

      if (keyword) {
        const clean = keyword.trim().toLowerCase();
        options = options
          .map((item) => {
            const matchLabel = fuzzyMatch(clean, item.label);
            const matchPhone = item.value2
              ? fuzzyMatch(clean, String(item.value2))
              : { isMatch: false, distance: 999 };
            const isMatch = matchLabel.isMatch || matchPhone.isMatch;
            const distance = Math.min(matchLabel.distance, matchPhone.distance);
            return { isMatch, distance, item };
          })
          .filter(({ isMatch }) => isMatch)
          .sort((a, b) => a.distance - b.distance)
          .map(({ item }) => item);
      }

      const schemaName = this.getTargetSchemaName();
      const isParty = schemaName === 'Party' || this.secondaryLink === 'phone';

      if (isParty && keyword) {
        const digitsOnly = keyword.trim().replace(/\D/g, '');
        if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
          const exactMatch = options.some(
            (opt) => opt.value2 === digitsOnly || opt.value === digitsOnly
          );
          if (!exactMatch) {
            options.unshift({
              label: t`+ Add Customer: ${digitsOnly}`,
              value: digitsOnly,
              isQuickCreate: true,
              action: async () => {
                await this.quickCreateCustomer(digitsOnly);
              },
              actionOnly: true,
            });
          }
        }
      } else if (this.doc && this.df.create) {
        options = options.concat(this.getCreateNewOption());
      }

      if (options.length === 0 && !this.df.emptyMessage) {
        return [
          {
            component: markRaw({
              template:
                '<span class="text-gray-600 dark:text-gray-400">{{ t`No results found` }}</span>',
            }),
            action: () => {},
            actionOnly: true,
          },
        ];
      }

      return options;
    },
    onInputFocus(e) {
      this.isFocused = true;
      e.target?.select?.();
    },
    async onInput(e, toggleDropdown) {
      if (this.isReadOnly) {
        return;
      }

      const rawVal = e.target.value;
      if (!rawVal || this.focInp) {
        e.target.value = null;
        this.focInp = false;
        toggleDropdown(false);
        return;
      }

      const schemaName = this.getTargetSchemaName();
      const isParty = schemaName === 'Party' || this.secondaryLink === 'phone';
      const digitsOnly = rawVal.trim().replace(/\D/g, '');

      // Seamless Indian POS: When 10 digits entered, immediately resolve or create customer!
      if (isParty && digitsOnly.length === 10) {
        toggleDropdown(false);
        await this.quickCreateCustomer(digitsOnly);
        return;
      }

      this.setLinkValue(rawVal, true);
      this.updateSuggestions(rawVal);
    },
    async onBlur(label, toggleDropdown) {
      this.isFocused = false;
      this.isDropdownOpen = false;

      const schemaName = this.getTargetSchemaName();
      const isParty = schemaName === 'Party' || this.secondaryLink === 'phone';
      const cleanVal = (label || this.linkValue || '').trim();
      const digitsOnly = cleanVal.replace(/\D/g, '');

      // On blur: If user typed 7-15 digits, auto-resolve or create without needing dropdown
      if (isParty && digitsOnly.length >= 7 && digitsOnly.length <= 15) {
        toggleDropdown(false);
        await this.quickCreateCustomer(digitsOnly);
        return;
      }

      if (!cleanVal && !this.value) {
        return;
      }
      if (!cleanVal) {
        this.triggerChange('');
        return;
      }

      if (this.suggestions.length === 0) {
        this.triggerChange(cleanVal);
        return;
      }

      const suggestion = this.suggestions.find((s) => s.label === cleanVal);
      if (suggestion && !suggestion.actionOnly) {
        this.setSuggestion(suggestion);
      } else if (this.suggestions[0] && !this.suggestions[0].actionOnly) {
        this.setSuggestion(this.suggestions[0]);
      }
    },
    async onPressEnter(e, toggleDropdown, selectHighlightedItem) {
      e.preventDefault();

      const schemaName = this.getTargetSchemaName();
      const isParty = schemaName === 'Party' || this.secondaryLink === 'phone';
      const inputVal = (e.target?.value || this.linkValue || '').trim();
      const digitsOnly = inputVal.replace(/\D/g, '');

      if (isParty && digitsOnly.length >= 7 && digitsOnly.length <= 15) {
        this.closeDropdown(e, toggleDropdown);
        await this.quickCreateCustomer(digitsOnly);
        return;
      }

      if (
        this.suggestions.length > 0 &&
        this.isFocused &&
        this.isDropdownOpen
      ) {
        await selectHighlightedItem();
        this.closeDropdown(e, toggleDropdown);
        return;
      }

      await this.updateSuggestions(this.linkValue || e.target.value);
      toggleDropdown(true);
      this.isDropdownOpen = true;
    },
    async quickCreateCustomer(phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone) return;

      try {
        const existing = await fyo.db.getAll('Party', {
          filters: { phone: cleanPhone },
          fields: ['name', 'phone'],
          limit: 1,
        });

        let customerName = cleanPhone;
        if (existing.length) {
          customerName = existing[0].name;
        } else {
          const existingByName = await fyo.db.getAll('Party', {
            filters: { name: cleanPhone },
            fields: ['name', 'phone'],
            limit: 1,
          });

          if (existingByName.length) {
            customerName = existingByName[0].name;
          } else {
            const newParty = fyo.doc.getNewDoc('Party', {
              name: cleanPhone,
              phone: cleanPhone,
              role: 'Customer',
            });
            await newParty.sync();
            customerName = newParty.name;
          }
        }

        this.results = [];
        this.triggerChange(customerName);
        await this.setLinkValue(customerName);
      } catch (err) {
        console.error('Failed to quick create customer', err);
      }
    },
    getCreateNewOption() {
      return {
        label: t`Create`,
        action: () => this.openNewDoc(),
        actionOnly: true,
        component: markRaw({
          template:
            '<div class="flex items-center font-semibold">{{ t`Create` }}' +
            '<Badge color="blue" class="ms-2" v-if="isNewValue">{{ linkValue }}</Badge>' +
            '</div>',
          computed: {
            value: () => this.value,
            linkValue: () => this.linkValue,
            isNewValue: () => {
              const values = this.suggestions.map((d) => d.label);
              return this.linkValue && !values.includes(this.linkValue);
            },
          },
          components: { Badge },
        }),
      };
    },
    async openNewDoc() {
      const schemaName = this.df.target;
      const name =
        this.linkValue || fyo.doc.getTemporaryName(fyo.schemaMap[schemaName]);
      const filters = await this.getCreateFilters();
      const { openQuickEdit } = await import('src/utils/ui');

      const doc = fyo.doc.getNewDoc(schemaName, { name, ...filters });
      openQuickEdit({ doc });

      doc.once('afterSync', () => {
        this.$router.back();
        this.results = [];
        this.triggerChange(doc.name);
      });
    },
    async getCreateFilters() {
      const { schemaName, fieldname } = this.df;

      const getCreateFilters =
        fyo.models[schemaName]?.createFilters?.[fieldname];
      let createFilters = await getCreateFilters?.(this.doc);

      if (createFilters !== undefined) {
        return createFilters;
      }

      const filters = await this.getFilters();
      return getCreateFiltersFromListViewFilters(filters);
    },
    async getFilters() {
      const { schemaName, fieldname } = this.df;
      const getFilters = fyo.models[schemaName]?.filters?.[fieldname];

      if (getFilters === undefined) {
        return {};
      }

      if (this.doc) {
        return (await getFilters(this.doc)) ?? {};
      }

      try {
        return (await getFilters()) ?? {};
      } catch {
        return {};
      }
    },
  },
};
</script>
