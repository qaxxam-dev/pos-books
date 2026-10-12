<template>
  <div v-if="(fields ?? []).length > 0">
    <div
      v-if="showTitle && title"
      class="flex justify-between items-center select-none"
      :class="[collapsed ? '' : 'mb-4', collapsible ? 'cursor-pointer' : '']"
      @click="toggleCollapsed"
    >
      <h2 class="text-base text-gray-900 dark:text-gray-25 font-semibold">
        {{ title }}
      </h2>
      <feather-icon
        v-if="collapsible"
        :name="collapsed ? 'chevron-up' : 'chevron-down'"
        class="w-4 h-4 text-gray-600 dark:text-gray-400"
      />
    </div>
    <div v-if="!collapsed" class="grid gap-4 gap-x-8 grid-cols-2">
      <div
        v-for="field of fields"
        :key="field.fieldname"
        :class="[
          field.fieldtype === 'Table' ? 'col-span-2 text-base' : '',
          field.fieldtype === 'AttachImage' ? 'row-span-2' : '',
          field.fieldtype === 'Check' ? 'mt-auto' : 'mb-auto',
          field.fieldname === 'termsAndConditions' ? 'col-span-2' : '',
          field.invisible ? 'invisible' : '',
        ]"
        :style="field.invisible ? 'visibility: hidden;' : ''"
      >
        <Table
          v-if="field.fieldtype === 'Table'"
          ref="fields"
          :show-label="true"
          :border="true"
          :df="field"
          :value="tableValue(doc[field.fieldname])"
          @editrow="(doc: Doc) => $emit('editrow', doc)"
          @change="(value: DocValue) => $emit('value-change', field, value)"
          @row-change="(field:Field, value:DocValue, parentfield:Field) => $emit('row-change',field, value, parentfield)"
        />
        <FormControl
          v-else
          :ref="field.fieldname === 'name' ? 'nameField' : 'fields'"
          :size="field.fieldtype === 'AttachImage' ? 'form' : undefined"
          :show-label="true"
          :border="true"
          :df="field"
          :value="doc[field.fieldname]"
          @editrow="(doc: Doc) => $emit('editrow', doc)"
          @change="(value: DocValue) => $emit('value-change', field, value)"
          @row-change="(field:Field, value:DocValue, parentfield:Field) => $emit('row-change',field, value, parentfield)"
        />
        <div
          v-if="field.fieldname === 'barcode' && doc?.schemaName === 'Item'"
          class="mt-1 flex items-center justify-between gap-2"
        >
          <button
            type="button"
            class="
              text-xs text-blue-600
              dark:text-blue-400
              hover:underline
              flex
              items-center
              gap-1
              font-medium
              cursor-pointer
            "
            @click="generateBarcodeForItem"
          >
            <feather-icon name="refresh-cw" class="w-3 h-3" />
            {{ t`Generate Barcode` }}
          </button>
          <button
            v-if="doc.barcode"
            type="button"
            class="
              text-xs text-gray-700
              dark:text-gray-300
              hover:text-black
              dark:hover:text-white
              flex
              items-center
              gap-1
              font-medium
              cursor-pointer
            "
            @click="printBarcodeForItem"
          >
            <feather-icon name="printer" class="w-3 h-3" />
            {{ t`Print Sticker` }}
          </button>
        </div>
        <div
          v-if="
            field.fieldname === 'barcode' &&
            doc?.schemaName === 'Item' &&
            doc.barcode
          "
          class="
            mt-2
            p-2
            bg-white
            dark:bg-gray-800
            border
            dark:border-gray-700
            rounded
            flex
            justify-center
            max-w-xs
          "
          v-html="getBarcodePreview(String(doc.barcode))"
        />
        <div v-if="errors?.[field.fieldname]" class="text-sm text-red-600 mt-1">
          {{ errors[field.fieldname] }}
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DocValue } from 'fyo/core/types';
import { Doc } from 'fyo/model/doc';
import { Field } from 'schemas/types';
import FormControl from 'src/components/Controls/FormControl.vue';
import Table from 'src/components/Controls/Table.vue';
import { focusOrSelectFormControl } from 'src/utils/ui';
import { openBarcodePrintModal } from 'src/utils/printBarcode';
import { generateBarcode128SVG } from 'src/utils/barcode128';
import { defineComponent, PropType } from 'vue';

export default defineComponent({
  components: { FormControl, Table },
  props: {
    title: { type: String, default: '' },
    errors: {
      type: Object as PropType<Record<string, string>>,
      required: true,
    },
    showTitle: Boolean,
    doc: { type: Object as PropType<Doc>, required: true },
    collapsible: { type: Boolean, default: true },
    fields: { type: Array as PropType<Field[]>, required: true },
  },
  emits: ['editrow', 'value-change', 'row-change'],
  data() {
    return { collapsed: false } as {
      collapsed: boolean;
    };
  },
  mounted() {
    focusOrSelectFormControl(this.doc, this.$refs.nameField);
  },
  methods: {
    tableValue(value: unknown): unknown[] {
      if (Array.isArray(value)) {
        return value;
      }

      return [];
    },
    toggleCollapsed() {
      if (!this.collapsible) {
        return;
      }

      this.collapsed = !this.collapsed;
    },
    async generateBarcodeForItem() {
      try {
        const { generateNextBarcode } = await import(
          'models/inventory/helpers'
        );
        const code = await generateNextBarcode(this.doc.fyo);
        await this.doc.set('barcode', code);
        const barcodeField = (this.fields ?? []).find(
          (f) => f.fieldname === 'barcode'
        );
        if (barcodeField) {
          this.$emit('value-change', barcodeField, code);
        }
      } catch (err) {
        // non-blocking error handling
      }
    },
    printBarcodeForItem() {
      openBarcodePrintModal([
        {
          item: this.doc.name as string,
          itemName: this.doc.name as string,
          barcode: this.doc.barcode as string,
          rate: this.doc.rate as number,
          quantity: 1,
        },
      ]);
    },
    getBarcodePreview(code: string): string {
      return generateBarcode128SVG(code, {
        height: 32,
        barWidth: 1.5,
        fontSize: 10,
        includeText: true,
      });
    },
  },
});
</script>
