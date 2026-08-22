<template>
  <div>
    <div v-if="showLabel" :class="labelClasses">
      {{ df.label }}
    </div>
    <Popover placement="bottom-end">
      <template #target="{ togglePopover }">
        <div
          tabindex="0"
          :class="[inputClasses, containerClasses]"
          @click="!isReadOnly && togglePopover()"
          @paste="onPaste"
        >
          <div class="flex items-center">
            <div
              v-if="value"
              class="w-3 h-3 rounded me-1 flex-shrink-0"
              :style="{ backgroundColor: value }"
            ></div>
            <span v-if="value">
              {{ selectedColorLabel }}
            </span>
            <span v-else class="text-gray-400 dark:text-gray-600">
              {{ inputPlaceholder }}
            </span>
          </div>
        </div>
      </template>
      <template #content>
        <div class="text-sm p-2 text-center">
          <div v-if="colors && colors.length">
            <Row :column-count="5" gap="0.5rem">
              <div
                v-for="color in colors"
                :key="color.value"
                class="w-4 h-4 rounded cursor-pointer border"
                :style="{ backgroundColor: color.value }"
                @click="setColorValue(color.value)"
              ></div>
            </Row>
          </div>
          <div class="mt-3 w-28 mx-auto">
            <input
              type="color"
              :placeholder="t`Custom Hex`"
              :class="[inputClasses, containerClasses]"
              :value="validHexColor"
              style="padding: 0; cursor: pointer"
              @input="(e) => setColorValue(e.target.value)"
              @change="(e) => setColorValue(e.target.value)"
            />
          </div>
        </div>
      </template>
    </Popover>
  </div>
</template>

<script>
import Popover from 'src/components/Popover.vue';
import Row from 'src/components/Row.vue';
import Base from './Base.vue';

export default {
  name: 'Color',
  components: {
    Popover,
    Row,
  },
  extends: Base,
  computed: {
    colors() {
      return this.df.options;
    },
    selectedColorLabel() {
      if (!this.colors) return this.value;
      const color = this.colors.find((c) => this.value === c.value);
      return color ? color.label : this.value;
    },
    validHexColor() {
      if (/^#[0-9A-F]{6}$/i.test(this.value)) {
        return this.value;
      }
      return '#000000';
    },
  },
  methods: {
    setColorValue(value) {
      if (!value) return;
      let clean = String(value).trim();
      if (!clean.startsWith('#')) {
        clean = '#' + clean;
      }
      if (/^#([0-9A-F]{3,4}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(clean)) {
        this.triggerChange(clean);
      }
    },
    onPaste(e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData)?.getData('text');
      if (text) {
        this.setColorValue(text);
      }
    },
  },
};
</script>

